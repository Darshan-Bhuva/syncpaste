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

// In-memory shared state
let sharedClipboard = {
  text: '',
  type: 'text', // 'text' or 'code'
  updatedAt: null,
  updatedBy: null
};

let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  io.emit('clients', connectedClients);

  // Send current clipboard to new connection
  socket.emit('clipboard:sync', sharedClipboard);

  // When a client updates clipboard
  socket.on('clipboard:update', (data) => {
    sharedClipboard = {
      text: data.text || '',
      type: data.type || 'text',
      updatedAt: new Date().toISOString(),
      updatedBy: socket.id.slice(0, 6)
    };
    // Broadcast to all OTHER clients
    socket.broadcast.emit('clipboard:sync', sharedClipboard);
  });

  socket.on('disconnect', () => {
    connectedClients--;
    io.emit('clients', connectedClients);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
