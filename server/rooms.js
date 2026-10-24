const crypto = require("crypto");
const { Game } = require("./game");

const MAX_PLAYERS=9, MIN_PLAYERS=2;
function code(){return crypto.randomBytes(3).toString("hex").toUpperCase();}
class RoomManager {
  constructor(io){this.io=io;this.rooms=new Map();this.bySocket=new Map();}
  create(socket,{name}) {
    this.leave(socket);
    const id=code();
    const room={id,host:socket.id,players:[],game:null,createdAt:Date.now()};
    this.rooms.set(id,room);
    const player=this.addPlayer(room,socket,name);
    socket.join(id);
    return {roomId:id,playerId:player.id,room:this.publicRoom(room)};
  }
  join(socket,{roomId,name}) {
    this.leave(socket);
    const room=this.rooms.get(String(roomId||"").trim().toUpperCase());
    if(!room) throw Error("Бөлме табылмады");
    if(room.game && room.game.status!=="lobby") throw Error("Ойын басталып кетті");
    if(room.players.length>=MAX_PLAYERS) throw Error("Бөлме толы (ең көбі 9 адам)");
    const player=this.addPlayer(room,socket,name);
    socket.join(room.id);
    this.emitRoom(room);
    return {roomId:room.id,playerId:player.id,room:this.publicRoom(room)};
  }
  addPlayer(room,socket,name) {
    const player={id:socket.id,name:String(name||"Ойыншы").trim().slice(0,20)||"Ойыншы",connected:true};
    room.players.push(player); this.bySocket.set(socket.id,room.id); return player;
  }
  leave(socket) {
    const id=this.bySocket.get(socket.id); if(!id)return;
    const room=this.rooms.get(id); this.bySocket.delete(socket.id); socket.leave(id);
    if(!room)return;
    room.players=room.players.filter(p=>p.id!==socket.id);
    if(room.host===socket.id) room.host=room.players[0]?.id || null;
    if(!room.players.length){this.rooms.delete(id);return;}
    if(room.game && room.game.status==="playing") room.game.markDisconnected(socket.id);
    this.emitRoom(room);
  }
  disconnect(socket) {
    const id=this.bySocket.get(socket.id); if(!id)return;
    const room=this.rooms.get(id);
    if(room) {
      const p=room.players.find(p=>p.id===socket.id);
      if(p) p.connected=false;
      if(room.game) room.game.markDisconnected(socket.id);
      this.emitRoom(room);
      // Current prototype leaves player seat reserved for 90 seconds; reclaiming identity is TODO.
      setTimeout(()=> {
        const current=this.rooms.get(id);
        if(!current)return;
        const still=current.players.find(p=>p.id===socket.id);
        if(still && !still.connected) {
          current.players=current.players.filter(p=>p.id!==socket.id);
          if(current.host===socket.id)current.host=current.players[0]?.id||null;
          this.bySocket.delete(socket.id);
          if(!current.players.length)this.rooms.delete(id); else this.emitRoom(current);
        }
      },90000);
    }
  }
  start(socket) {
    const room=this.roomFor(socket);
    if(room.host!==socket.id) throw Error("Ойынды тек бөлме иесі бастайды");
    if(room.players.filter(p=>p.connected).length<MIN_PLAYERS)throw Error("Кемінде 2 ойыншы керек");
    room.game=new Game(room.players.filter(p=>p.connected));
    this.emitGame(room);
    return {state:room.game.stateFor(socket.id)};
  }
  action(socket,action) {
    const room=this.roomFor(socket);
    if(!room.game || room.game.status!=="playing")throw Error("Ойын басталмаған");
    room.game.act(socket.id,action);
    this.emitGame(room);
    return {state:room.game.stateFor(socket.id)};
  }
  roomFor(socket){const id=this.bySocket.get(socket.id),room=this.rooms.get(id);if(!room)throw Error("Бөлмеге қосылмағансыз");return room;}
  publicRoom(room){return {id:room.id,host:room.host,players:room.players.map(p=>({id:p.id,name:p.name,connected:p.connected})),status:room.game?.status||"lobby"};}
  emitRoom(room){this.io.to(room.id).emit("room:update",this.publicRoom(room));}
  emitGame(room){for(const p of room.players){const s=this.io.sockets.sockets.get(p.id);if(s)s.emit("game:state",room.game.stateFor(p.id));}}
}
module.exports={RoomManager};
