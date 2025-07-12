# Secure Messaging App

A low-latency, end-to-end encrypted messaging application hosted on AWS with real-time communication capabilities.

## 🚀 Features

### Security & Encryption
- **End-to-End Encryption**: All messages are encrypted using AES-GCM with 256-bit keys
- **Web Crypto API**: Client-side encryption using modern browser APIs
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Protection against abuse and DDoS attacks
- **HTTPS/WSS**: Secure communication protocols

### Real-Time Communication
- **WebSocket Support**: Low-latency real-time messaging
- **Typing Indicators**: See when others are typing
- **Read Receipts**: Know when messages are read
- **Online Status**: Real-time user presence
- **File Sharing**: Encrypted file transfer support

### AWS Infrastructure
- **DynamoDB**: Scalable NoSQL database
- **ECS Fargate**: Serverless container orchestration
- **Application Load Balancer**: High availability and load distribution
- **CloudFront**: Global content delivery
- **Auto Scaling**: Automatic scaling based on demand
- **CloudWatch**: Comprehensive monitoring and logging

### User Experience
- **Modern UI**: Clean, responsive design with Tailwind CSS
- **Room Management**: Create and join chat rooms
- **User Profiles**: Manage user information and status
- **File Upload**: Drag-and-drop file sharing
- **Mobile Responsive**: Works on all devices

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │   WebSocket     │    │   DynamoDB      │
│   (Frontend)    │◄──►│   Connection    │◄──►│   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFront    │    │   ECS Fargate   │    │   Application   │
│   (CDN)         │    │   (Backend)     │    │   Load Balancer │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Prerequisites

- Node.js 18+ and npm
- Docker
- AWS CLI configured with appropriate permissions
- AWS CDK CLI

## 🛠️ Local Development Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd messaging-app
```

### 2. Install Dependencies
```bash
# Install server dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..

# Install infrastructure dependencies
cd infrastructure && npm install && cd ..
```

### 3. Environment Configuration
```bash
# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env
```

Required environment variables:
```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Database
USERS_TABLE=messaging-app-users
MESSAGES_TABLE=messaging-app-messages
ROOMS_TABLE=messaging-app-rooms
```

### 4. Start Development Servers
```bash
# Start both server and client in development mode
npm run dev

# Or start them separately
npm run server:dev  # Server on port 3001
npm run client:dev  # Client on port 3000
```

## 🚀 AWS Deployment

### 1. Prepare AWS Environment
```bash
# Configure AWS CLI
aws configure

# Install AWS CDK globally
npm install -g aws-cdk

# Bootstrap CDK (first time only)
cd infrastructure
npx cdk bootstrap
cd ..
```

### 2. Deploy Infrastructure
```bash
# Deploy the entire application
./deploy.sh

# Or deploy components separately
./deploy.sh infrastructure  # Deploy AWS resources
./deploy.sh app            # Deploy application only
```

### 3. Access the Application
After deployment, you'll get the following outputs:
- **CloudFront URL**: Main application URL
- **Load Balancer DNS**: Direct API access
- **WebSocket Endpoint**: Real-time communication endpoint

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3001` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `JWT_SECRET` | JWT signing secret | Required |
| `USERS_TABLE` | DynamoDB users table | `messaging-app-users` |
| `MESSAGES_TABLE` | DynamoDB messages table | `messaging-app-messages` |
| `ROOMS_TABLE` | DynamoDB rooms table | `messaging-app-rooms` |

### AWS Services Configuration

The application uses the following AWS services:

- **DynamoDB**: User data, messages, and rooms
- **ECS Fargate**: Containerized application hosting
- **Application Load Balancer**: Traffic distribution
- **CloudFront**: Content delivery and caching
- **CloudWatch**: Monitoring and logging
- **IAM**: Security and permissions

## 🔒 Security Features

### Encryption
- **AES-GCM**: 256-bit encryption for messages and files
- **ECDH**: Elliptic curve key exchange
- **PBKDF2**: Key derivation with 100,000 iterations
- **Client-side**: All encryption happens in the browser

### Authentication
- **JWT Tokens**: Stateless authentication
- **Password Hashing**: bcrypt with 12 salt rounds
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for security

### Network Security
- **HTTPS/WSS**: Encrypted communication
- **Helmet**: Security headers
- **Input Validation**: Server-side validation
- **SQL Injection Protection**: Parameterized queries

## 📊 Monitoring and Logging

### CloudWatch Integration
- Application logs with structured JSON format
- Performance metrics and alarms
- Error tracking and alerting
- Custom dashboards for monitoring

### Application Metrics
- Message throughput
- User activity
- Error rates
- Response times
- WebSocket connections

## 🧪 Testing

```bash
# Run all tests
npm test

# Run server tests only
npm run test:server

# Run client tests only
cd client && npm test

# Run with coverage
npm run test:coverage
```

## 📁 Project Structure

```
messaging-app/
├── server/                 # Backend application
│   ├── index.js           # Main server file
│   ├── socket.js          # WebSocket handlers
│   ├── database.js        # DynamoDB operations
│   └── routes.js          # API routes
├── client/                # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # React contexts
│   │   └── utils/         # Utilities (encryption, etc.)
│   └── public/            # Static assets
├── infrastructure/        # AWS CDK infrastructure
│   ├── lib/              # CDK constructs
│   └── bin/              # CDK app entry point
├── Dockerfile            # Container configuration
├── deploy.sh             # Deployment script
└── README.md             # This file
```

## 🔄 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Rooms
- `POST /api/rooms` - Create room
- `GET /api/rooms` - Get user rooms
- `GET /api/rooms/:roomId` - Get room details

### Messages
- `GET /api/rooms/:roomId/messages` - Get room messages
- `POST /api/rooms/:roomId/messages` - Send message
- `DELETE /api/messages/:messageId` - Delete message

### Health
- `GET /health` - Health check endpoint

## 🌐 WebSocket Events

### Client to Server
- `room:join` - Join a chat room
- `room:leave` - Leave a chat room
- `message:send` - Send a message
- `file:share` - Share a file
- `typing:start` - Start typing indicator
- `typing:stop` - Stop typing indicator
- `message:read` - Mark message as read
- `status:update` - Update user status

### Server to Client
- `message:received` - New message received
- `file:received` - New file received
- `user:online` - User came online
- `user:offline` - User went offline
- `user:joined` - User joined room
- `user:left` - User left room
- `typing:started` - User started typing
- `typing:stopped` - User stopped typing
- `message:read` - Message read receipt

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the logs in CloudWatch

## 🔮 Roadmap

- [ ] Voice and video calling
- [ ] Group video chats
- [ ] Message reactions
- [ ] Message threading
- [ ] Advanced file sharing
- [ ] Mobile app (React Native)
- [ ] Offline message sync
- [ ] Message search
- [ ] User blocking
- [ ] Admin panel
- [ ] Analytics dashboard