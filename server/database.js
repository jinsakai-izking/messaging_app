const AWS = require('aws-sdk');
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

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

// Table names
const USERS_TABLE = process.env.USERS_TABLE || 'messaging-app-users';
const MESSAGES_TABLE = process.env.MESSAGES_TABLE || 'messaging-app-messages';
const ROOMS_TABLE = process.env.ROOMS_TABLE || 'messaging-app-rooms';

// Initialize database tables
async function initializeDatabase() {
  try {
    const dynamodbService = new AWS.DynamoDB();
    
    // Create Users table
    await createTableIfNotExists(dynamodbService, USERS_TABLE, {
      AttributeDefinitions: [
        { AttributeName: 'userId', AttributeType: 'S' },
        { AttributeName: 'email', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'EmailIndex',
          KeySchema: [
            { AttributeName: 'email', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    });

    // Create Messages table
    await createTableIfNotExists(dynamodbService, MESSAGES_TABLE, {
      AttributeDefinitions: [
        { AttributeName: 'messageId', AttributeType: 'S' },
        { AttributeName: 'roomId', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'messageId', KeyType: 'HASH' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'RoomTimestampIndex',
          KeySchema: [
            { AttributeName: 'roomId', KeyType: 'HASH' },
            { AttributeName: 'timestamp', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10
          }
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10
      }
    });

    // Create Rooms table
    await createTableIfNotExists(dynamodbService, ROOMS_TABLE, {
      AttributeDefinitions: [
        { AttributeName: 'roomId', AttributeType: 'S' },
        { AttributeName: 'createdBy', AttributeType: 'S' }
      ],
      KeySchema: [
        { AttributeName: 'roomId', KeyType: 'HASH' }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'CreatedByIndex',
          KeySchema: [
            { AttributeName: 'createdBy', KeyType: 'HASH' }
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
          }
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    });

    logger.info('Database tables initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
}

async function createTableIfNotExists(dynamodbService, tableName, tableParams) {
  try {
    await dynamodbService.describeTable({ TableName: tableName }).promise();
    logger.info(`Table ${tableName} already exists`);
  } catch (error) {
    if (error.code === 'ResourceNotFoundException') {
      await dynamodbService.createTable({
        TableName: tableName,
        ...tableParams
      }).promise();
      logger.info(`Table ${tableName} created successfully`);
    } else {
      throw error;
    }
  }
}

// User operations
async function createUser(userData) {
  const { email, username, passwordHash } = userData;
  const userId = uuidv4();
  
  const user = {
    userId,
    email,
    username,
    passwordHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'offline',
    lastSeen: new Date().toISOString()
  };

  try {
    await dynamodb.put({
      TableName: USERS_TABLE,
      Item: user,
      ConditionExpression: 'attribute_not_exists(userId)'
    }).promise();

    logger.info(`User created: ${username}`);
    return { ...user, passwordHash: undefined };
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      throw new Error('User already exists');
    }
    throw error;
  }
}

async function getUserById(userId) {
  try {
    const result = await dynamodb.get({
      TableName: USERS_TABLE,
      Key: { userId }
    }).promise();

    return result.Item;
  } catch (error) {
    logger.error('Error getting user by ID:', error);
    throw error;
  }
}

async function getUserByEmail(email) {
  try {
    const result = await dynamodb.query({
      TableName: USERS_TABLE,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    }).promise();

    return result.Items[0];
  } catch (error) {
    logger.error('Error getting user by email:', error);
    throw error;
  }
}

async function updateUserStatus(userId, status) {
  try {
    await dynamodb.update({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET #status = :status, lastSeen = :lastSeen, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':lastSeen': new Date().toISOString(),
        ':updatedAt': new Date().toISOString()
      }
    }).promise();

    logger.info(`User status updated: ${userId} -> ${status}`);
  } catch (error) {
    logger.error('Error updating user status:', error);
    throw error;
  }
}

// Room operations
async function createRoom(roomData) {
  const { name, createdBy, participants, isPrivate } = roomData;
  const roomId = uuidv4();
  
  const room = {
    roomId,
    name,
    createdBy,
    participants: participants || [createdBy],
    isPrivate: isPrivate || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    await dynamodb.put({
      TableName: ROOMS_TABLE,
      Item: room
    }).promise();

    logger.info(`Room created: ${name} by ${createdBy}`);
    return room;
  } catch (error) {
    logger.error('Error creating room:', error);
    throw error;
  }
}

async function getRoomById(roomId) {
  try {
    const result = await dynamodb.get({
      TableName: ROOMS_TABLE,
      Key: { roomId }
    }).promise();

    return result.Item;
  } catch (error) {
    logger.error('Error getting room by ID:', error);
    throw error;
  }
}

async function getUserRooms(userId) {
  try {
    const result = await dynamodb.query({
      TableName: ROOMS_TABLE,
      IndexName: 'CreatedByIndex',
      KeyConditionExpression: 'createdBy = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }).promise();

    return result.Items;
  } catch (error) {
    logger.error('Error getting user rooms:', error);
    throw error;
  }
}

// Message operations
async function saveMessage(messageData) {
  const { messageId, senderId, roomId, encryptedContent, type, fileName, fileSize } = messageData;
  
  const message = {
    messageId,
    senderId,
    roomId,
    encryptedContent,
    type: type || 'message',
    fileName,
    fileSize,
    timestamp: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  try {
    await dynamodb.put({
      TableName: MESSAGES_TABLE,
      Item: message
    }).promise();

    logger.info(`Message saved: ${messageId} in room ${roomId}`);
    return message;
  } catch (error) {
    logger.error('Error saving message:', error);
    throw error;
  }
}

async function getRoomMessages(roomId, limit = 50, lastEvaluatedKey = null) {
  try {
    const params = {
      TableName: MESSAGES_TABLE,
      IndexName: 'RoomTimestampIndex',
      KeyConditionExpression: 'roomId = :roomId',
      ExpressionAttributeValues: {
        ':roomId': roomId
      },
      ScanIndexForward: false, // Get newest first
      Limit: limit
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await dynamodb.query(params).promise();
    
    return {
      messages: result.Items,
      lastEvaluatedKey: result.LastEvaluatedKey
    };
  } catch (error) {
    logger.error('Error getting room messages:', error);
    throw error;
  }
}

async function deleteMessage(messageId) {
  try {
    await dynamodb.delete({
      TableName: MESSAGES_TABLE,
      Key: { messageId }
    }).promise();

    logger.info(`Message deleted: ${messageId}`);
  } catch (error) {
    logger.error('Error deleting message:', error);
    throw error;
  }
}

module.exports = {
  initializeDatabase,
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
};