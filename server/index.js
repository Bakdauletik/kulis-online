const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Game } = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, '../public')));

const rooms = {};

io.on('connection', (socket) => {
  console.log('connected', socket.id);
  
  socket.on('createRoom', ({ name }) => {
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    rooms[roomId] = { players: [{ id: socket.id, name: name || 'Ойыншы' }], game: null };
    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
    io.to(roomId).emit('lobby', rooms[roomId].players);
  });

  socket.on('joinRoom', ({ roomId, name }) => {
    roomId = roomId.toUpperCase().trim();
    if (!rooms[roomId]) { socket.emit('errorMsg', 'Бөлме табылмады'); return; }
    if (rooms[roomId].players.length >= 4) { socket.emit('errorMsg', 'Бөлме толы'); return; }
    rooms[roomId].players.push({ id: socket.id, name: name || 'Ойыншы' });
    socket.join(roomId);
    // 2 ойыншы болса ойын басталады
    if (rooms[roomId].players.length >= 2 && !rooms[roomId].game) {
      rooms[roomId].game = new Game(rooms[roomId].players);
    }
    const game = rooms[roomId].game;
    if (game) {
      io.to(roomId).emit('state', game.stateFor(socket.id));
      // барлық ойыншыларға өз state-ін жіберу
      rooms[roomId].players.forEach(p => {
        io.to(p.id).emit('state', game.stateFor(p.id));
      });
    } else {
      io.to(roomId).emit('lobby', rooms[roomId].players);
    }
  });

  socket.on('action', ({ roomId, action }) => {
    const room = rooms[roomId];
    if (!room || !room.game) return;
    try {
      room.game.act(socket.id, action);
      room.players.forEach(p => {
        io.to(p.id).emit('state', room.game.stateFor(p.id));
      });
      if (room.game.status === 'finished') {
        io.to(roomId).emit('gameOver', { winnerId: room.game.winnerId, log: room.game.log });
      }
    } catch (e) {
      socket.emit('errorMsg', e.message);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        if (room.game) room.game.markDisconnected(socket.id);
        room.players.splice(idx, 1);
        if (room.players.length === 0) delete rooms[roomId];
        else io.to(roomId).emit('lobby', room.players);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server on', PORT));
