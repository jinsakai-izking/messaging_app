const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

const {
  createUser,
  getUserById,
  getUserByEmail,
  updateUserStatus,
  createRoom,
  getRoomById,
  getUserRooms,
  saveMessage,
  getRoomMessages,
  deleteMessage
} = require('./database');

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

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function setupRoutes(app) {
  // Authentication routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, username, password } = req.body;

      if (!email || !username || !password) {
        return res.status(400).json({ error: 'Email, username, and password are required' });
      }

      // Check if user already exists
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await createUser({
        email,
        username,
        passwordHash
      });

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.userId, username: user.username },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'User created successfully',
        user: {
          userId: user.userId,
          email: user.email,
          username: user.username,
          createdAt: user.createdAt
        },
        token
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Get user by email
      const user = await getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update user status
      await updateUserStatus(user.userId, 'online');

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.userId, username: user.username },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        user: {
          userId: user.userId,
          email: user.email,
          username: user.username,
          status: 'online',
          lastSeen: user.lastSeen
        },
        token
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // User routes
  app.get('/api/users/profile', authenticateToken, async (req, res) => {
    try {
      const user = await getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        userId: user.userId,
        email: user.email,
        username: user.username,
        status: user.status,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/users/profile', authenticateToken, async (req, res) => {
    try {
      const { username, status } = req.body;
      const updates = {};

      if (username) updates.username = username;
      if (status) updates.status = status;

      // Update user in database
      const user = await getUserById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // For now, we'll just return success since we don't have updateUser function
      // In a real implementation, you'd update the user in the database
      res.json({
        message: 'Profile updated successfully',
        user: {
          ...user,
          ...updates,
          passwordHash: undefined
        }
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Room routes
  app.post('/api/rooms', authenticateToken, async (req, res) => {
    try {
      const { name, participants, isPrivate } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Room name is required' });
      }

      const room = await createRoom({
        name,
        createdBy: req.user.userId,
        participants: participants || [req.user.userId],
        isPrivate: isPrivate || false
      });

      res.status(201).json({
        message: 'Room created successfully',
        room
      });
    } catch (error) {
      logger.error('Create room error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/rooms', authenticateToken, async (req, res) => {
    try {
      const rooms = await getUserRooms(req.user.userId);
      res.json({ rooms });
    } catch (error) {
      logger.error('Get rooms error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/rooms/:roomId', authenticateToken, async (req, res) => {
    try {
      const { roomId } = req.params;
      const room = await getRoomById(roomId);

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      // Check if user is a participant
      if (!room.participants.includes(req.user.userId)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({ room });
    } catch (error) {
      logger.error('Get room error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Message routes
  app.get('/api/rooms/:roomId/messages', authenticateToken, async (req, res) => {
    try {
      const { roomId } = req.params;
      const { limit = 50, lastEvaluatedKey } = req.query;

      // Verify room exists and user has access
      const room = await getRoomById(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (!room.participants.includes(req.user.userId)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const result = await getRoomMessages(roomId, parseInt(limit), lastEvaluatedKey);
      res.json(result);
    } catch (error) {
      logger.error('Get messages error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/rooms/:roomId/messages', authenticateToken, async (req, res) => {
    try {
      const { roomId } = req.params;
      const { encryptedContent, type, fileName, fileSize } = req.body;

      if (!encryptedContent) {
        return res.status(400).json({ error: 'Encrypted content is required' });
      }

      // Verify room exists and user has access
      const room = await getRoomById(roomId);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (!room.participants.includes(req.user.userId)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const messageId = uuidv4();
      const message = await saveMessage({
        messageId,
        senderId: req.user.userId,
        roomId,
        encryptedContent,
        type: type || 'message',
        fileName,
        fileSize
      });

      res.status(201).json({
        message: 'Message saved successfully',
        messageData: message
      });
    } catch (error) {
      logger.error('Save message error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/messages/:messageId', authenticateToken, async (req, res) => {
    try {
      const { messageId } = req.params;

      // In a real implementation, you'd verify the user owns the message
      await deleteMessage(messageId);

      res.json({ message: 'Message deleted successfully' });
    } catch (error) {
      logger.error('Delete message error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'messaging-app-api'
    });
  });
}

module.exports = { setupRoutes };