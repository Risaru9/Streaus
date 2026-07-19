const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const RoomManager = require('./roomManager');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const roomManager = new RoomManager();

const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer configurations
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Keep original file name but prepend a timestamp to avoid naming conflicts
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB file limit for local streaming
});

// CORS setup
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
}));

app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e8 // Increase default payload size limits
});

// ──────────────────────────────────────
// REST endpoints
// ──────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', rooms: roomManager.rooms.size });
});

app.get('/api/room/:id', (req, res) => {
  const room = roomManager.getRoom(req.params.id);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json(roomManager.serializeRoom(room));
});

app.post('/api/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    fileName: req.file.filename,
    originalName: req.file.originalname,
    url: `/uploads/${req.file.filename}`
  });
});

// ──────────────────────────────────────
// WebSocket event handlers
// ──────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ─── Room events ───

  socket.on('room:create', ({ userName }, callback) => {
    if (!userName || typeof userName !== 'string' || userName.trim().length === 0) {
      return callback({ error: 'Display name is required' });
    }

    const room = roomManager.createRoom(userName.trim(), socket.id);
    socket.join(room.id);

    console.log(`[room:create] ${userName} created room ${room.id}`);
    callback({ room: roomManager.serializeRoom(room) });
  });

  socket.on('room:join', ({ roomId, userName }, callback) => {
    if (!userName || !roomId) {
      return callback({ error: 'Room ID and display name are required' });
    }

    const room = roomManager.joinRoom(roomId.toUpperCase(), userName.trim(), socket.id);
    if (!room) {
      return callback({ error: 'Room not found' });
    }

    socket.join(room.id);

    // Notify others
    socket.to(room.id).emit('room:user-joined', {
      user: room.users.get(socket.id),
      users: Array.from(room.users.values()),
    });

    // Send system chat message
    const sysMsg = roomManager.addChatMessage(room.id, {
      type: 'system',
      userName: 'System',
      text: `${userName.trim()} joined the room`,
    });
    io.to(room.id).emit('chat:message', sysMsg);

    console.log(`[room:join] ${userName} joined room ${room.id}`);
    callback({ room: roomManager.serializeRoom(room) });
  });

  socket.on('room:leave', () => {
    handleDisconnect(socket);
  });

  socket.on('room:delete', (data, callback) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) {
      if (callback) callback();
      return;
    }
    
    const room = roomManager.getRoom(roomId);
    if (!room || room.host !== socket.id) {
      if (callback) callback();
      return;
    }
    
    roomManager.deleteRoom(roomId);
    
    // Notify all users in the room
    io.to(roomId).emit('room:deleted', { reason: 'Host closed the room.' });
    
    // Make everyone leave the socket room
    io.in(roomId).socketsLeave(roomId);
    
    console.log(`[room:delete] Host ${socket.id} deleted room ${roomId}`);
    if (callback) callback();
  });

  socket.on('room:transfer-host', ({ targetUserId }) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    if (!room || room.host !== socket.id) return; // Only host can transfer

    if (room.users.has(targetUserId)) {
      room.host = targetUserId;
      
      const newHost = room.users.get(targetUserId);
      const oldHost = room.users.get(socket.id);

      io.to(roomId).emit('room:user-left', {
        users: Array.from(room.users.values()),
        newHost: targetUserId,
      });

      const sysMsg = roomManager.addChatMessage(roomId, {
        type: 'system',
        userName: 'System',
        text: `${oldHost.name} transferred host permissions to ${newHost.name}.`,
      });
      io.to(roomId).emit('chat:message', sysMsg);
    }
  });

  // ─── Queue events ───

  socket.on('queue:add', ({ fileName, url }) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    const user = room.users.get(socket.id);
    const updatedQueue = roomManager.addToQueue(roomId, { fileName, url, addedBy: user.name });
    io.to(roomId).emit('queue:updated', updatedQueue);
  });

  socket.on('queue:remove', ({ index }) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;
    const room = roomManager.getRoom(roomId);
    if (!room || room.host !== socket.id) return; // Only host can remove for now
    const updatedQueue = roomManager.removeFromQueue(roomId, index);
    if (updatedQueue) {
      io.to(roomId).emit('queue:updated', updatedQueue);
    }
  });

  socket.on('queue:next', () => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;
    const room = roomManager.getRoom(roomId);
    if (!room || room.host !== socket.id) return;
    const result = roomManager.getNextInQueue(roomId);
    if (result) {
      const { nextVideo, queue } = result;
      roomManager.updatePlaybackState(roomId, {
        videoName: nextVideo.fileName,
        videoDuration: 0,
        isUrl: true,
        videoUrl: nextVideo.url,
        isPlaying: true,
        currentTime: 0
      });
      io.to(roomId).emit('queue:updated', queue);
      io.to(roomId).emit('player:video-info', {
        videoName: nextVideo.fileName,
        videoDuration: 0,
        isUrl: true,
        videoUrl: nextVideo.url
      });
      io.to(roomId).emit('player:play', { currentTime: 0, serverTime: Date.now() });
    }
  });

  // ─── Player sync events ───

  socket.on('player:play', ({ currentTime }) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;

    const state = roomManager.updatePlaybackState(roomId, {
      isPlaying: true,
      currentTime,
    });

    const room = roomManager.getRoom(roomId);
    const user = room?.users.get(socket.id);

    socket.to(roomId).emit('player:play', {
      currentTime,
      triggeredBy: user?.name || 'Unknown',
      serverTime: Date.now(),
    });

    // System message
    const sysMsg = roomManager.addChatMessage(roomId, {
      type: 'system',
      userName: 'System',
      text: `${user?.name || 'Someone'} pressed play`,
    });
    io.to(roomId).emit('chat:message', sysMsg);
  });

  socket.on('player:pause', ({ currentTime }) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;

    roomManager.updatePlaybackState(roomId, {
      isPlaying: false,
      currentTime,
    });

    const room = roomManager.getRoom(roomId);
    const user = room?.users.get(socket.id);

    socket.to(roomId).emit('player:pause', {
      currentTime,
      triggeredBy: user?.name || 'Unknown',
      serverTime: Date.now(),
    });

    const sysMsg = roomManager.addChatMessage(roomId, {
      type: 'system',
      userName: 'System',
      text: `${user?.name || 'Someone'} paused`,
    });
    io.to(roomId).emit('chat:message', sysMsg);
  });

  socket.on('player:seek', ({ currentTime }) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;

    roomManager.updatePlaybackState(roomId, { currentTime });

    const room = roomManager.getRoom(roomId);
    const user = room?.users.get(socket.id);

    socket.to(roomId).emit('player:seek', {
      currentTime,
      triggeredBy: user?.name || 'Unknown',
      serverTime: Date.now(),
    });
  });

  socket.on('player:heartbeat', ({ currentTime }) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    if (!room || room.host !== socket.id) return; // Only host can send heartbeat

    roomManager.updatePlaybackState(roomId, { currentTime });
    socket.to(roomId).emit('player:heartbeat', { currentTime });
  });

  socket.on('player:video-loaded', ({ videoName, videoDuration, isUrl, videoUrl }) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;

    roomManager.updatePlaybackState(roomId, { videoName, videoDuration, isUrl, videoUrl });

    const room = roomManager.getRoom(roomId);
    const user = room?.users.get(socket.id);

    const sysMsg = roomManager.addChatMessage(roomId, {
      type: 'system',
      userName: 'System',
      text: `${user?.name || 'Someone'} loaded: ${videoName}`,
    });
    io.to(roomId).emit('chat:message', sysMsg);
    io.to(roomId).emit('player:video-info', { videoName, videoDuration, isUrl, videoUrl });
  });

  socket.on('player:request-change', ({ fileName, url }) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const requester = room.users.get(socket.id);
    if (!requester) return;

    // Send the request directly to the host
    io.to(room.host).emit('player:request-change', {
      requesterName: requester.name,
      requesterSocketId: socket.id,
      fileName,
      url
    });

    const sysMsg = roomManager.addChatMessage(roomId, {
      type: 'system',
      userName: 'System',
      text: `${requester.name} requested to change the video to: ${fileName}`,
    });
    io.to(roomId).emit('chat:message', sysMsg);
  });

  socket.on('player:respond-change', ({ approved, requesterSocketId, fileName, url }) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    if (!room || room.host !== socket.id) return; // Only host can respond

    const hostUser = room.users.get(socket.id);
    const guestUser = room.users.get(requesterSocketId);

    if (approved) {
      // Update room state with the new uploaded video URL
      roomManager.updatePlaybackState(roomId, {
        videoName: fileName,
        videoDuration: 0,
        isUrl: true,
        isPlaying: false,
        currentTime: 0
      });

      // Notify all users in the room to load the new video URL
      io.to(roomId).emit('player:video-info', { 
        videoName: fileName, 
        videoDuration: 0, 
        isUrl: true,
        videoUrl: url 
      });

      const sysMsg = roomManager.addChatMessage(roomId, {
        type: 'system',
        userName: 'System',
        text: `Host ${hostUser?.name || 'Host'} approved video change request from ${guestUser?.name || 'Guest'}. Playing: ${fileName}`,
      });
      io.to(roomId).emit('chat:message', sysMsg);
    } else {
      // Notify the requester that their request was rejected
      io.to(requesterSocketId).emit('player:change-rejected', {
        rejectedBy: hostUser?.name || 'Host'
      });

      const sysMsg = roomManager.addChatMessage(roomId, {
        type: 'system',
        userName: 'System',
        text: `Host ${hostUser?.name || 'Host'} rejected video change request from ${guestUser?.name || 'Guest'}.`,
      });
      io.to(roomId).emit('chat:message', sysMsg);
    }
  });

  socket.on('player:buffering', ({ isBuffering }) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const user = room.users.get(socket.id);
    if (user) {
      user.isBuffering = isBuffering;
    }

    // Check if anyone is buffering
    const anyoneBuffering = Array.from(room.users.values()).some(u => u.isBuffering);

    io.to(roomId).emit('player:buffer-status', {
      anyoneBuffering,
      bufferingUser: user?.name || 'Unknown',
      isBuffering,
    });
  });

  socket.on('player:sync-request', (callback) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return callback?.({ error: 'Not in a room' });

    const room = roomManager.getRoom(roomId);
    if (!room) return callback?.({ error: 'Room not found' });

    callback?.({ playbackState: room.playbackState, serverTime: Date.now() });
  });

  // ─── Chat events ───

  socket.on('chat:message', ({ text }) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    const user = room?.users.get(socket.id);
    if (!user) return;

    if (!text || typeof text !== 'string' || text.trim().length === 0) return;

    const message = roomManager.addChatMessage(roomId, {
      type: 'user',
      userId: socket.id,
      userName: user.name,
      text: text.trim().substring(0, 500), // Limit message length
    });

    io.to(roomId).emit('chat:message', message);
  });

  socket.on('chat:reaction', ({ emoji }) => {
    const roomId = roomManager.findRoomBySocket(socket.id);
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    const user = room?.users.get(socket.id);
    if (!user) return;

    io.to(roomId).emit('chat:reaction', {
      userId: socket.id,
      userName: user.name,
      emoji,
      timestamp: Date.now(),
    });
  });

  // ─── Disconnect ───

  socket.on('disconnect', (reason) => {
    console.log(`[disconnect] ${socket.id} — ${reason}`);
    handleDisconnect(socket);
  });
});

function handleDisconnect(socket) {
  const roomId = roomManager.findRoomBySocket(socket.id);
  if (!roomId) return;

  const room = roomManager.getRoom(roomId);
  const user = room?.users.get(socket.id);
  const userName = user?.name || 'Unknown';

  const { wasHost, newHost, deleted } = roomManager.leaveRoom(roomId, socket.id);
  socket.leave(roomId);

  if (deleted) {
    console.log(`[room:delete] Room ${roomId} deleted (empty)`);
    return;
  }

  const updatedRoom = roomManager.getRoom(roomId);

  // Notify remaining users
  io.to(roomId).emit('room:user-left', {
    userName,
    users: Array.from(updatedRoom.users.values()),
    newHost,
  });

  const sysMsg = roomManager.addChatMessage(roomId, {
    type: 'system',
    userName: 'System',
    text: wasHost
      ? `${userName} (host) left. ${updatedRoom.users.get(newHost)?.name || 'Someone'} is now the host.`
      : `${userName} left the room`,
  });
  io.to(roomId).emit('chat:message', sysMsg);
}

// ──────────────────────────────────────
// Start server
// ──────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n  🎬 Watch Party Server running on http://localhost:${PORT}\n`);
});
