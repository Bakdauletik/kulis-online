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
  socket.on('createRoom', ({ name }) => {
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    rooms[roomId] = { players: [{ id: socket.id, name: name || 'Ойыншы1' }], game: null };
    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
    io.to(roomId).emit('lobby', { roomId, players: rooms[roomId].players });
  });

  socket.on('joinRoom', ({ roomId, name }) => {
    roomId = roomId.toUpperCase().trim();
    if (!rooms[roomId]) { socket.emit('errorMsg', 'Бөлме табылмады'); return; }
    const room = rooms[roomId];
    // Дубликат қосылмасын
    if (!room.players.find(p=>p.id===socket.id)) {
      if (room.players.length >= 4) { socket.emit('errorMsg', 'Бөлме толы'); return; }
      room.players.push({ id: socket.id, name: name || 'Ойыншы' });
    }
    socket.join(roomId);
    if (room.players.length >= 2 && !room.game) {
      room.game = new Game(room.players);
    }
    if (room.game) {
      room.players.forEach(p => io.to(p.id).emit('state', room.game.stateFor(p.id)));
      io.to(roomId).emit('roomCode', { roomId }); // кодты әрқашан жібер
    } else {
      io.to(roomId).emit('lobby', { roomId, players: room.players });
    }
  });

  socket.on('action', ({ roomId, action }) => {
    const room = rooms[roomId]; if (!room || !room.game) return;
    try {
      room.game.act(socket.id, action);
      room.players.forEach(p => io.to(p.id).emit('state', room.game.stateFor(p.id)));
    } catch (e) { socket.emit('errorMsg', e.message); }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.players.length === 0) delete rooms[roomId];
        break;
      }
    }
  });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server on', PORT));
