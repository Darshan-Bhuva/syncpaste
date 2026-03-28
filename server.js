const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// In-memory rooms: { roomCode: { text, type, updatedAt, updatedBy, clients } }
const rooms = {};

function getRoom(code) {
  if (!rooms[code]) {
    rooms[code] = {
      text: '',
      type: 'text',
      updatedAt: null,
      updatedBy: null,
      clients: 0
    };
  }
  return rooms[code];
}

function cleanupRoom(code) {
  if (rooms[code] && rooms[code].clients <= 0) {
    delete rooms[code];
  }
}

io.on('connection', (socket) => {
  let currentRoom = null;

  // Join a room
  socket.on('room:join', (code) => {
    if (!code || typeof code !== 'string') return;

    const roomCode = code.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 32);
    if (!roomCode) return;

    // Leave previous room
    if (currentRoom) {
      socket.leave(currentRoom);
      if (rooms[currentRoom]) {
        rooms[currentRoom].clients--;
        io.to(currentRoom).emit('clients', rooms[currentRoom].clients);
        cleanupRoom(currentRoom);
      }
    }

    // Join new room
    currentRoom = roomCode;
    socket.join(roomCode);
    const room = getRoom(roomCode);
    room.clients++;

    // Send current state to new joiner
    socket.emit('clipboard:sync', {
      text: room.text,
      type: room.type,
      updatedAt: room.updatedAt,
      updatedBy: room.updatedBy
    });

    // Notify room of new client count
    io.to(roomCode).emit('clients', room.clients);
  });

  // Clipboard update
  socket.on('clipboard:update', (data) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    room.text = data.text || '';
    room.type = data.type || 'text';
    room.updatedAt = new Date().toISOString();
    room.updatedBy = socket.id.slice(0, 6);

    socket.to(currentRoom).emit('clipboard:sync', {
      text: room.text,
      type: room.type,
      updatedAt: room.updatedAt,
      updatedBy: room.updatedBy
    });
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].clients--;
      io.to(currentRoom).emit('clients', rooms[currentRoom].clients);
      cleanupRoom(currentRoom);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});