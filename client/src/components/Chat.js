import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import RoomHeader from './RoomHeader';
import encryptionManager from '../utils/encryption';
import toast from 'react-hot-toast';
import { LogOut, Settings, Users } from 'lucide-react';

function Chat() {
  const { user, token, logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [roomKey, setRoomKey] = useState(null);
  const typingTimeoutRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (token && user) {
      const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:3001', {
        auth: { token }
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        toast.success('Connected to chat server');
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        toast.error('Disconnected from chat server');
      });

      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
        toast.error('Connection error');
      });

      // Message events
      newSocket.on('message:received', handleMessageReceived);
      newSocket.on('file:received', handleFileReceived);
      
      // User events
      newSocket.on('user:online', handleUserOnline);
      newSocket.on('user:offline', handleUserOffline);
      newSocket.on('user:joined', handleUserJoined);
      newSocket.on('user:left', handleUserLeft);
      
      // Typing events
      newSocket.on('typing:started', handleTypingStarted);
      newSocket.on('typing:stopped', handleTypingStopped);

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [token, user]);

  // Handle incoming messages
  const handleMessageReceived = async (messageData) => {
    try {
      let decryptedContent = messageData.encryptedContent;
      
      // Decrypt message if we have a room key
      if (roomKey && messageData.roomId === currentRoom?.roomId) {
        decryptedContent = await encryptionManager.decryptRoomMessage(
          messageData.encryptedContent,
          roomKey,
          messageData.iv
        );
      }

      const message = {
        ...messageData,
        content: decryptedContent,
        timestamp: new Date(messageData.timestamp)
      };

      setMessages(prev => [...prev, message]);
    } catch (error) {
      console.error('Error handling message:', error);
      toast.error('Failed to decrypt message');
    }
  };

  // Handle incoming files
  const handleFileReceived = async (fileData) => {
    try {
      let decryptedFile = fileData.encryptedFile;
      
      // Decrypt file if we have a room key
      if (roomKey && fileData.roomId === currentRoom?.roomId) {
        decryptedFile = await encryptionManager.decryptFile(
          fileData.encryptedFile,
          fileData.senderPublicKey,
          fileData.iv,
          fileData.salt,
          fileData.fileName,
          fileData.fileType
        );
      }

      const message = {
        ...fileData,
        file: decryptedFile,
        timestamp: new Date(fileData.timestamp)
      };

      setMessages(prev => [...prev, message]);
    } catch (error) {
      console.error('Error handling file:', error);
      toast.error('Failed to decrypt file');
    }
  };

  // Handle user events
  const handleUserOnline = (userData) => {
    setOnlineUsers(prev => [...prev, userData]);
  };

  const handleUserOffline = (userData) => {
    setOnlineUsers(prev => prev.filter(u => u.userId !== userData.userId));
  };

  const handleUserJoined = (userData) => {
    if (userData.roomId === currentRoom?.roomId) {
      toast.success(`${userData.username} joined the room`);
    }
  };

  const handleUserLeft = (userData) => {
    if (userData.roomId === currentRoom?.roomId) {
      toast.info(`${userData.username} left the room`);
    }
  };

  // Handle typing events
  const handleTypingStarted = (data) => {
    if (data.roomId === currentRoom?.roomId && data.userId !== user.userId) {
      setTypingUsers(prev => [...prev.filter(u => u.userId !== data.userId), data]);
    }
  };

  const handleTypingStopped = (data) => {
    if (data.roomId === currentRoom?.roomId) {
      setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
    }
  };

  // Join a room
  const joinRoom = async (room) => {
    if (!socket) return;

    try {
      // Generate room key for encryption
      const { key } = await encryptionManager.generateRoomKey();
      setRoomKey(key);

      // Join the room
      socket.emit('room:join', { roomId: room.roomId });
      setCurrentRoom(room);
      setMessages([]);
      setTypingUsers([]);

      toast.success(`Joined ${room.name}`);
    } catch (error) {
      console.error('Error joining room:', error);
      toast.error('Failed to join room');
    }
  };

  // Leave current room
  const leaveRoom = () => {
    if (!socket || !currentRoom) return;

    socket.emit('room:leave', { roomId: currentRoom.roomId });
    setCurrentRoom(null);
    setMessages([]);
    setTypingUsers([]);
    setRoomKey(null);
  };

  // Send a message
  const sendMessage = async (content, type = 'message') => {
    if (!socket || !currentRoom || !content.trim()) return;

    try {
      let encryptedContent = content;
      let iv = null;

      // Encrypt message if we have a room key
      if (roomKey) {
        const encrypted = await encryptionManager.encryptRoomMessage(content, roomKey);
        encryptedContent = encrypted.encryptedData;
        iv = encrypted.iv;
      }

      const messageData = {
        roomId: currentRoom.roomId,
        encryptedContent,
        iv,
        type
      };

      socket.emit('message:send', messageData);

      // Add message to local state immediately
      const message = {
        messageId: Date.now().toString(),
        senderId: user.userId,
        senderName: user.username,
        roomId: currentRoom.roomId,
        content,
        type,
        timestamp: new Date(),
        isOwn: true
      };

      setMessages(prev => [...prev, message]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  // Send a file
  const sendFile = async (file) => {
    if (!socket || !currentRoom) return;

    try {
      let encryptedFile = file;
      let iv = null;
      let salt = null;

      // Encrypt file if we have a room key
      if (roomKey) {
        const encrypted = await encryptionManager.encryptFile(file, roomKey);
        encryptedFile = encrypted.encryptedData;
        iv = encrypted.iv;
        salt = encrypted.salt;
      }

      const fileData = {
        roomId: currentRoom.roomId,
        encryptedFile,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        iv,
        salt
      };

      socket.emit('file:share', fileData);

      // Add file message to local state
      const message = {
        messageId: Date.now().toString(),
        senderId: user.userId,
        senderName: user.username,
        roomId: currentRoom.roomId,
        file,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        type: 'file',
        timestamp: new Date(),
        isOwn: true
      };

      setMessages(prev => [...prev, message]);
    } catch (error) {
      console.error('Error sending file:', error);
      toast.error('Failed to send file');
    }
  };

  // Handle typing
  const handleTyping = () => {
    if (!socket || !currentRoom || isTyping) return;

    setIsTyping(true);
    socket.emit('typing:start', { roomId: currentRoom.roomId });

    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing:stop', { roomId: currentRoom.roomId });
    }, 2000);
  };

  // Create a new room
  const createRoom = async (roomData) => {
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(roomData)
      });

      if (response.ok) {
        const { room } = await response.json();
        setRooms(prev => [...prev, room]);
        toast.success('Room created successfully');
        return room;
      } else {
        throw new Error('Failed to create room');
      }
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to create room');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar
        rooms={rooms}
        currentRoom={currentRoom}
        onJoinRoom={joinRoom}
        onCreateRoom={createRoom}
        onlineUsers={onlineUsers}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {currentRoom ? currentRoom.name : 'Select a room'}
            </h1>
            {currentRoom && (
              <span className="text-sm text-gray-500">
                {currentRoom.participants?.length || 0} participants
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {/* TODO: Open settings */}}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          {currentRoom ? (
            <>
              <RoomHeader room={currentRoom} />
              <MessageList
                messages={messages}
                typingUsers={typingUsers}
                currentUser={user}
              />
              <MessageInput
                onSendMessage={sendMessage}
                onSendFile={sendFile}
                onTyping={handleTyping}
                disabled={!currentRoom}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Users size={48} className="mx-auto text-gray-400 mb-4" />
                <h2 className="text-xl font-semibold text-gray-600 mb-2">
                  Select a room to start chatting
                </h2>
                <p className="text-gray-500">
                  Choose a room from the sidebar or create a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Chat;