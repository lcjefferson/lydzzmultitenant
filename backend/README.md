# SmarterChat Backend

Backend API for SmarterChat - AI-powered multi-channel customer service platform.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL (or Neon.tech account)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and secrets

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server
npm run start:dev
```

Server will start on `http://localhost:3001`

## 📚 API Documentation

### Base URL
```
http://localhost:3001/api
```

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Available Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login
- `POST /auth/refresh` - Refresh access token

#### Organizations
- `POST /organizations` - Create organization
- `GET /organizations` - List organizations
- `GET /organizations/:id` - Get organization
- `PUT /organizations/:id` - Update organization
- `DELETE /organizations/:id` - Delete organization

#### Users
- `POST /users` - Create user
- `GET /users` - List users (protected)
- `GET /users/:id` - Get user (protected)
- `PUT /users/:id` - Update user (protected)
- `DELETE /users/:id` - Delete user (protected)

#### Agents
- `POST /agents` - Create AI agent (protected)
- `GET /agents` - List agents (protected)
- `GET /agents/:id` - Get agent (protected)
- `PATCH /agents/:id` - Update agent (protected)
- `DELETE /agents/:id` - Delete agent (protected)

#### Channels
- `POST /channels` - Create channel (protected)
- `GET /channels` - List channels (protected)
- `GET /channels/:id` - Get channel (protected)
- `PATCH /channels/:id` - Update channel (protected)
- `DELETE /channels/:id` - Delete channel (protected)

#### Conversations
- `POST /conversations` - Create conversation (protected)
- `GET /conversations` - List conversations (protected)
- `GET /conversations/:id` - Get conversation (protected)
- `PATCH /conversations/:id` - Update conversation (protected)
- `DELETE /conversations/:id` - Delete conversation (protected)

#### Messages
- `POST /messages` - Create message (protected)
- `GET /messages?conversationId=xxx` - List messages (protected)
- `GET /messages/:id` - Get message (protected)
- `DELETE /messages/:id` - Delete message (protected)

#### Leads
- `POST /leads` - Create lead (protected)
- `GET /leads` - List leads (protected)
- `GET /leads/:id` - Get lead (protected)
- `PATCH /leads/:id` - Update lead (protected)
- `DELETE /leads/:id` - Delete lead (protected)

#### Webhooks
- `POST /webhooks` - Create webhook (protected)
- `GET /webhooks` - List webhooks (protected)
- `GET /webhooks/:id` - Get webhook (protected)
- `PATCH /webhooks/:id` - Update webhook (protected)
- `DELETE /webhooks/:id` - Delete webhook (protected)
- `POST /webhooks/test` - Test webhook (protected)

#### Analytics
- `GET /analytics/dashboard` - Dashboard metrics (protected)
- `GET /analytics/conversations` - Conversation stats (protected)
- `GET /analytics/leads` - Lead stats (protected)

## 🔌 WebSocket Events

Connect to `ws://localhost:3001` for real-time updates.

### Events
- `joinConversation` - Join a conversation room
- `leaveConversation` - Leave a conversation room
- `newMessage` - Receive new messages
- `statusChange` - Receive status updates

## 🗄️ Database

### Schema
The application uses Prisma ORM with PostgreSQL. Schema includes:
- Organizations (multi-tenancy)
- Users (with roles)
- Agents (AI configurations)
- Channels (WhatsApp, Instagram)
- Conversations
- Messages
- Leads
- Webhooks
- Analytics

### Migrations
```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Prisma Studio
View and edit data:
```bash
npx prisma studio
```

## 🔐 Environment Variables

Required variables in `.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_REFRESH_EXPIRES_IN="30d"

# Server
PORT=3001
NODE_ENV=development

# Optional: External APIs
OPENAI_API_KEY="your-openai-key"
WHATSAPP_ACCESS_TOKEN="your-whatsapp-token"
INSTAGRAM_ACCESS_TOKEN="your-instagram-token"
```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod

# Linting
npm run lint
npm run lint:fix

# Testing
npm run test
npm run test:e2e
npm run test:cov

# Prisma
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

## 📦 Tech Stack

- **Framework:** NestJS
- **Language:** TypeScript
- **Database:** PostgreSQL (Neon.tech)
- **ORM:** Prisma
- **Authentication:** JWT + Passport
- **WebSockets:** Socket.io
- **Validation:** class-validator
- **HTTP Client:** Axios

## 🏗️ Project Structure

```
src/
├── auth/              # Authentication module
├── users/             # Users management
├── organizations/     # Organizations (multi-tenancy)
├── agents/            # AI agents configuration
├── channels/          # Communication channels
├── conversations/     # Chat conversations
├── messages/          # Messages
├── leads/             # Lead management
├── webhooks/          # Webhook system
├── analytics/         # Analytics & metrics
├── prisma/            # Prisma service
└── main.ts            # Application entry point
```

## 🚢 Deployment

### Production Checklist
- [ ] Set strong JWT secrets
- [ ] Configure production database
- [ ] Set up CORS for frontend URL
- [ ] Enable HTTPS
- [ ] Set up monitoring
- [ ] Configure rate limiting
- [ ] Set up backup strategy

### Recommended Platforms
- Railway
- Render
- Vercel
- AWS/GCP/Azure

## 📝 License

MIT

## 👥 Support

For issues and questions, please open an issue on GitHub.
