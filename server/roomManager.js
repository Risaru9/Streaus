const { v4: uuidv4 } = require('uuid');

class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
  }

  /**
   * Create a new room.
   * @param {string} hostName - Display name of the host
   * @param {string} hostSocketId - Socket ID of the host
   * @returns {Room}
   */
  createRoom(hostName, hostSocketId) {
    const roomId = this._generateRoomCode();
    const room = {
      id: roomId,
      host: hostSocketId,
      createdAt: Date.now(),
      users: new Map(), // socketId -> { id, name, isBuffering }
      chatHistory: [],
      queue: [], // Array of { fileName, url, addedBy }
      playbackState: {
        videoName: null,
        videoDuration: 0,
        currentTime: 0,
        isPlaying: false,
        isUrl: false,
        videoUrl: null
      }
    };

    room.users.set(hostSocketId, { id: hostSocketId, name: hostName, isBuffering: false });
    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Join an existing room.
   * @param {string} roomId
   * @param {string} userName
   * @param {string} socketId
   * @returns {Room|null}
   */
  joinRoom(roomId, userName, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.users.set(socketId, { id: socketId, name: userName, isBuffering: false });
    return room;
  }

  /**
   * Remove a user from a room. Deletes room if empty.
   * @param {string} roomId
   * @param {string} socketId
   * @returns {{ room: Room|null, wasHost: boolean, newHost: string|null, deleted: boolean }}
   */
  leaveRoom(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return { room: null, wasHost: false, newHost: null, deleted: false };

    const wasHost = room.host === socketId;
    room.users.delete(socketId);

    if (room.users.size === 0) {
      this.rooms.delete(roomId);
      return { room: null, wasHost, newHost: null, deleted: true };
    }

    let newHost = null;
    if (wasHost) {
      // Transfer host to the next user
      const nextUser = room.users.keys().next().value;
      room.host = nextUser;
      newHost = nextUser;
    }

    return { room, wasHost, newHost, deleted: false };
  }

  /**
   * Delete a room completely and disconnect all users.
   * @param {string} roomId
   * @returns {boolean} success
   */
  deleteRoom(roomId) {
    if (this.rooms.has(roomId)) {
      this.rooms.delete(roomId);
      return true;
    }
    return false;
  }

  /**
   * Update the playback state for a room.
   */
  updatePlaybackState(roomId, state) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.playbackState = {
      ...room.playbackState,
      ...state,
      lastUpdated: Date.now(),
    };

    return room.playbackState;
  }

  /**
   * Add a chat message to the room's history.
   */
  addChatMessage(roomId, message) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const chatMessage = {
      id: uuidv4(),
      ...message,
      timestamp: Date.now(),
    };

    room.chatHistory.push(chatMessage);

    // Keep only last 200 messages in memory
    if (room.chatHistory.length > 200) {
      room.chatHistory = room.chatHistory.slice(-200);
    }

    return chatMessage;
  }

  /**
   * Get room info.
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Find which room a socket is in.
   */
  findRoomBySocket(socketId) {
    for (const [roomId, room] of this.rooms) {
      if (room.users.has(socketId)) {
        return roomId;
      }
    }
    return null;
  }

  /**
   * Serialize room data for client consumption (Maps → Objects).
   */
  serializeRoom(room) {
    if (!room) return null;
    return {
      id: room.id,
      host: room.host,
      createdAt: room.createdAt,
      users: Array.from(room.users.values()),
      playbackState: room.playbackState,
      chatHistory: room.chatHistory,
      queue: room.queue || [],
    };
  }

  addToQueue(roomId, item) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (!room.queue) room.queue = [];
    room.queue.push({ id: uuidv4(), ...item });
    return room.queue;
  }

  removeFromQueue(roomId, index) {
    const room = this.rooms.get(roomId);
    if (!room || !room.queue || index < 0 || index >= room.queue.length) return null;
    room.queue.splice(index, 1);
    return room.queue;
  }

  getNextInQueue(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.queue || room.queue.length === 0) return null;
    const nextVideo = room.queue.shift();
    return { nextVideo, queue: room.queue };
  }

  /**
   * Generate a short, human-friendly room code.
   */
  _generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure uniqueness
    if (this.rooms.has(code)) {
      return this._generateRoomCode();
    }
    return code;
  }
}

module.exports = RoomManager;
