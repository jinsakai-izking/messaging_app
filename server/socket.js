const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Store active connections
const activeConnections = new Map();
const userRooms = new Map();

function setupSocketHandlers(io) {
  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch (error) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.username} (${socket.userId})`);
    
    // Store connection
    activeConnections.set(socket.userId, socket);
    
    // Join user's personal room
    socket.join(`user:${socket.userId}`);
    
    // Broadcast user online status
    socket.broadcast.emit('user:online', {
      userId: socket.userId,
      username: socket.username,
      timestamp: new Date().toISOString()
    });

    // Handle joining a chat room
    socket.on('room:join', (data) => {
      const { roomId, participants } = data;
      
      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      // Join the room
      socket.join(roomId);
      userRooms.set(socket.userId, roomId);
      
      // Notify room participants
      socket.to(roomId).emit('user:joined', {
        userId: socket.userId,
        username: socket.username,
        roomId,
        timestamp: new Date().toISOString()
      });

      logger.info(`User ${socket.username} joined room ${roomId}`);
    });

    // Handle leaving a chat room
    socket.on('room:leave', (data) => {
      const { roomId } = data;
      
      if (roomId) {
        socket.leave(roomId);
        userRooms.delete(socket.userId);
        
        socket.to(roomId).emit('user:left', {
          userId: socket.userId,
          username: socket.username,
          roomId,
          timestamp: new Date().toISOString()
        });
        
        logger.info(`User ${socket.username} left room ${roomId}`);
      }
    });

    // Handle sending encrypted messages
    socket.on('message:send', (data) => {
      const { roomId, encryptedContent, messageId, timestamp } = data;
      
      if (!roomId || !encryptedContent) {
        socket.emit('error', { message: 'Room ID and encrypted content are required' });
        return;
      }

      const messageData = {
        messageId: messageId || uuidv4(),
        senderId: socket.userId,
        senderName: socket.username,
        roomId,
        encryptedContent,
        timestamp: timestamp || new Date().toISOString(),
        type: 'message'
      };

      // Broadcast to room
      io.to(roomId).emit('message:received', messageData);
      
      logger.info(`Message sent in room ${roomId} by ${socket.username}`);
    });

    // Handle typing indicators
    socket.on('typing:start', (data) => {
      const { roomId } = data;
      
      if (roomId) {
        socket.to(roomId).emit('typing:started', {
          userId: socket.userId,
          username: socket.username,
          roomId
        });
      }
    });

    socket.on('typing:stop', (data) => {
      const { roomId } = data;
      
      if (roomId) {
        socket.to(roomId).emit('typing:stopped', {
          userId: socket.userId,
          username: socket.username,
          roomId
        });
      }
    });

    // Handle read receipts
    socket.on('message:read', (data) => {
      const { messageId, roomId } = data;
      
      if (messageId && roomId) {
        socket.to(roomId).emit('message:read', {
          messageId,
          readBy: socket.userId,
          readByUsername: socket.username,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle file sharing (encrypted)
    socket.on('file:share', (data) => {
      const { roomId, encryptedFile, fileName, fileSize, messageId } = data;
      
      if (!roomId || !encryptedFile) {
        socket.emit('error', { message: 'Room ID and encrypted file are required' });
        return;
      }

      const fileData = {
        messageId: messageId || uuidv4(),
        senderId: socket.userId,
        senderName: socket.username,
        roomId,
        encryptedFile,
        fileName,
        fileSize,
        timestamp: new Date().toISOString(),
        type: 'file'
      };

      io.to(roomId).emit('file:received', fileData);
      
      logger.info(`File shared in room ${roomId} by ${socket.username}`);
    });

    // Handle user status updates
    socket.on('status:update', (data) => {
      const { status, customMessage } = data;
      
      socket.broadcast.emit('status:updated', {
        userId: socket.userId,
        username: socket.username,
        status,
        customMessage,
        timestamp: new Date().toISOString()
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`User disconnected: ${socket.username} (${socket.userId}) - Reason: ${reason}`);
      
      // Remove from active connections
      activeConnections.delete(socket.userId);
      
      // Leave all rooms
      const currentRoom = userRooms.get(socket.userId);
      if (currentRoom) {
        socket.to(currentRoom).emit('user:left', {
          userId: socket.userId,
          username: socket.username,
          roomId: currentRoom,
          timestamp: new Date().toISOString()
        });
        userRooms.delete(socket.userId);
      }
      
      // Broadcast user offline status
      socket.broadcast.emit('user:offline', {
        userId: socket.userId,
        username: socket.username,
        timestamp: new Date().toISOString()
      });
    });
  });

  // Error handling
  io.on('error', (error) => {
    logger.error('Socket.IO error:', error);
  });
}

// Utility functions
function getActiveUsers() {
  return Array.from(activeConnections.keys());
}

function getUserSocket(userId) {
  return activeConnections.get(userId);
}

function broadcastToUser(userId, event, data) {
  const userSocket = getUserSocket(userId);
  if (userSocket) {
    userSocket.emit(event, data);
  }
}

module.exports = {
  setupSocketHandlers,
  getActiveUsers,
  getUserSocket,
  broadcastToUser
};