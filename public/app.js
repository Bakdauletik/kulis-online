const socket=io();let roomId=null,playerId=null,room=null,state=null,selected=-1;
const $=id=>document.getElementById(id);
function msg(s){$("message").textContent=s||""}
function call(event,data={}){return new Promise(resolve=>socket.emit(event,data,r=>{if(!r?.ok){msg(r?.error||"Қате");resolve(null)}else{msg("");resolve(r)}}))}
function enterLobby(info){roomId=info.roomId;playerId=info.playerId;room=info.room;$("entry").classList.add("hidden");$("lobby").classList.remove("hidden");$("roomId").textContent=roomId;paintRoom();}
$("create").onclick=async()=>{const r=await call("room:create",{name:$("name").value});if(r)enterLobby(r)};
$("join").onclick=async()=>{const r=await call("room:join",{name:$("name").value,roomId:$("roomCode").value});if(r)enterLobby(r)};
$("copy").onclick=async()=>{try{await navigator.clipboard.writeText(roomId);msg("Бөлме коды көшірілді")}catch{msg("Бөлме коды: "+roomId)}};
$("leave").onclick=async()=>{await call("room:leave");roomId=null;playerId=null;$("lobby").classList.add("hidden");$("game").classList.add("hidden");$("entry").classList.remove("hidden")};
$("start").onclick=async()=>{const r=await call("game:start");if(r)showGame(r.state)};
socket.on("room:update",r=>{room=r;paintRoom()});
function paintRoom(){if(!room)return;$("players").innerHTML=room.players.map(p=>`<div class="player">${esc(p.name)}${p.id===room.host?" · 👑":""}<div class="muted">${p.connected?"Қосылған":"Байланыс жоқ"}</div></div>`).join("");$("start").disabled=room.host!==playerId||room.players.filter(p=>p.connected).length<2;}
socket.on("game:state",showGame);
function showGame(s){state=s;$("lobby").classList.add("hidden");$("game").classList.remove("hidden");$("pot").textContent=fmt(s.pot);$("bet").textContent=fmt(s.currentBet);$("trump").textContent=s.trump?s.trump.r+s.trump.s:"—";$("wallet").textContent="Сенің фишкаң: "+fmt(s.self?.money||0)+" ₸";$("gamePlayers").innerHTML=s.players.map(p=>`<div class="player">${esc(p.name)}${p.folded?" · Пас":""}${p.id===s.turnPlayerId?" · ▶":""}<div class="muted">${p.cardCount} карта · ${fmt(p.money)} ₸</div></div>`).join("");$("battle").innerHTML=(s.battle||[]).map(b=>card(b.card,b.name)).join("");$("hand").innerHTML = s.self?.seen
  ? (s.self.hand || []).map((c,i) =>
      <div class="card ${c.red ? "red" : ""} ${i===selected ? "pick" : ""}" data-i="${i}">${c.r}${c.s}</div>
    ).join("")
  : '<div class="card card-back">🂠</div><div class="card card-back">🂠</div><div class="card card-back">🂠</div>';$("hand").querySelectorAll("[data-i]").forEach(el=>el.onclick=()=>{selected=+el.dataset.i;showGame(state)});const mine=s.turnPlayerId===playerId&&s.status==="playing";$("turnMsg").textContent=s.status==="finished"?(s.winnerId===playerId?"СЕН ЖЕҢДІҢ!":"Ойын аяқталды"):(mine?"Сенің кезегің":"Қарсыластың кезегі");$("betActions").classList.toggle("hidden",!mine||s.phase!=="betting");$("duelActions").classList.toggle("hidden",!mine||s.phase!=="duel");$("result").textContent=s.status==="finished"?(s.players.find(p=>p.id===s.winnerId)?.name+" жеңімпаз! Банк: "+fmt(s.pot)):"";$("log").textContent=(s.log||[]).join("\n");}
function card(c,n){return `<div><div class="muted">${esc(n)}</div><div class="card ${c.red?"red":""}">${c.r}${c.s}</div></div>`}
$("betActions").querySelectorAll("[data-act]").forEach(b=>b.onclick=async()=>{const type=b.dataset.act;const r=await call("game:action",{type,amount:100});if(r)selected=-1});
$("reveal").onclick=async()=>{const r=await call("game:action",{type:"reveal"});if(r)selected=-1};
$("play").onclick=async()=>{if(selected<0){msg("Алдымен карта таңда");return}const r=await call("game:action",{type:"play",cardIndex:selected});if(r)selected=-1};
socket.on("connect",()=>msg("Серверге қосылды"));socket.on("disconnect",()=>msg("Байланыс үзілді. Қайта қосылуда…"));
function fmt(n){return Number(n||0).toLocaleString("ru-RU")}function esc(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
