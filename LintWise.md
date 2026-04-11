# LintWise - AI-Powered Code Review Tool

**Complete Technical Documentation**

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Design](#architecture--design)
3. [Technology Stack](#technology-stack)
4. [Environment Setup](#environment-setup)
5. [Frontend Setup](#frontend-setup)
6. [Backend Setup](#backend-setup)
7. [Database Design](#database-design)
8. [API Documentation](#api-documentation)
9. [Authentication & Security](#authentication--security)
10. [Deployment](#deployment)
11. [Development Guidelines](#development-guidelines)
12. [Project Structure](#project-structure)
13. [Troubleshooting](#troubleshooting)

---

## Project Overview

### Vision
LintWise is an intelligent code review platform that leverages AI (Claude API) to provide instant, comprehensive code analysis across multiple programming languages. It enables developers to improve code quality, identify security vulnerabilities, optimize performance, and follow best practices before committing code.

### Target Users
- Individual developers wanting code quality improvement
- Code review teams seeking automated analysis
- Organizations implementing automated quality gates
- Educational institutions teaching coding best practices

### Key Objectives
- Provide instant, AI-powered code reviews
- Support multiple programming languages
- Offer actionable, detailed feedback
- Maintain high security and privacy standards
- Scale efficiently for enterprise use

### Success Metrics
- Code review response time < 3 seconds
- 99.9% API availability
- Support 50+ programming languages
- 10,000+ reviews per day capacity
- User satisfaction score > 4.5/5

---

## Architecture & Design

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  React + Vite + TypeScript + TailwindCSS + Axios              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ HTTP/REST
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                    API Gateway / Load Balancer                   │
│                         (Nginx / Cloudflare)                     │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                      NestJS Backend Server                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Controllers  │  │   Services   │  │   Guards     │           │
│  │ (Routes)     │  │   (Business) │  │ (Auth/Rate) │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │           Modules (Feature-Based)                     │       │
│  │  - Auth Module     - Code Review Module              │       │
│  │  - User Module     - File Upload Module              │       │
│  │  - Payment Module  - History Module                  │       │
│  └──────────────────────────────────────────────────────┘       │
└────────────────┬────────────────────────────────────────────────┘
                 │
    ┌────────────┴────────────┬──────────────┐
    │                         │              │
┌───▼────────────┐ ┌─────────▼──────┐  ┌───▼──────────┐
│  PostgreSQL DB │ │   Redis Cache  │  │ Claude API   │
│  - Users       │ │  - Sessions    │  │ (External)   │
│  - Reviews     │ │  - Rate Limits │  │              │
│  - Code Snippets│ │  - Auth Tokens │  │              │
└────────────────┘ └────────────────┘  └──────────────┘
```

### Data Flow

**Code Review Process:**
1. User submits code via React frontend
2. Frontend validates and sends to NestJS backend
3. Backend stores code in PostgreSQL
4. Backend queues request in Redis
5. Worker service calls Claude API
6. Claude returns analysis results
7. Backend processes and stores results
8. Frontend fetches and displays results

### Design Patterns Used
- **MVC Pattern**: Controllers, Services, Repositories
- **Dependency Injection**: NestJS built-in DI container
- **Repository Pattern**: Data access abstraction
- **Service Layer Pattern**: Business logic separation
- **Guard Pattern**: Authentication & authorization
- **Interceptor Pattern**: Request/response transformation
- **Middleware Pattern**: Cross-cutting concerns

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 18.x | UI framework |
| **Vite** | 5.x | Build tool & dev server |
| **TypeScript** | 5.x | Type safety |
| **TailwindCSS** | 3.x | Utility-first CSS |
| **Axios** | 1.x | HTTP client |
| **React Router** | 6.x | Client-side routing |
| **Zustand** | 4.x | State management |
| **React Query** | 5.x | Server state management |
| **Monaco Editor** | Latest | Code editor |
| **React Hot Toast** | Latest | Notifications |
| **Zod** | 3.x | Schema validation |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Node.js** | 18+ LTS | Runtime |
| **NestJS** | 10.x | Framework |
| **TypeScript** | 5.x | Type safety |
| **PostgreSQL** | 15+ | Primary database |
| **Redis** | 7+ | Cache & session store |
| **Prisma** | 5.x | ORM |
| **Passport.js** | 0.7.x | Authentication |
| **JWT** | Latest | Token-based auth |
| **dotenv** | Latest | Environment config |
| **axios** | 1.x | HTTP requests |
| **class-validator** | Latest | DTO validation |
| **class-transformer** | Latest | DTO transformation |

### DevOps & Deployment
- **Docker** & **Docker Compose**: Containerization
- **GitHub Actions**: CI/CD
- **AWS / Railway / Vercel**: Cloud hosting
- **Nginx**: Reverse proxy
- **Cloudflare**: CDN & DDoS protection

### Development Tools
- **ESLint** & **Prettier**: Code linting & formatting
- **Husky** & **Lint-staged**: Git hooks
- **Vitest** / **Jest**: Unit testing
- **Supertest**: Integration testing
- **SonarQube**: Code quality analysis
- **Postman / Insomnia**: API testing

---

## Environment Setup

### Prerequisites
- **Node.js**: 18 LTS or higher
- **npm**: 9+ or **yarn**: 4+
- **PostgreSQL**: 15 or higher
- **Redis**: 7 or higher
- **Git**: Latest stable
- **Docker** & **Docker Compose**: Latest versions

### System Requirements (Development)
- **RAM**: Minimum 8GB (recommended 16GB)
- **Disk Space**: 10GB free
- **OS**: macOS, Linux, or Windows with WSL2

### Installation Steps

#### 1. Clone Repository
```bash
git clone https://github.com/yourusername/lintwise.git
cd lintwise
```

#### 2. Install Root Dependencies
```bash
npm install
```

#### 3. Create Environment Files

**Backend `.env` file:**
```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/lintwise_db
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT & Authentication
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRATION=7d
REFRESH_TOKEN_EXPIRATION=30d

# Claude API
CLAUDE_API_KEY=sk-ant-xxxx
CLAUDE_MODEL=claude-3-5-sonnet-20241022
CLAUDE_MAX_TOKENS=2000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:5173

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AWS S3 (Optional - for file uploads)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=lintwise-reviews
```

**Frontend `.env.local` file:**
```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=LintWise
VITE_APP_VERSION=1.0.0
```

#### 4. Database Setup
```bash
# Create PostgreSQL database
createdb lintwise_db

# Run migrations (Prisma)
cd backend
npx prisma migrate dev --name init
npx prisma generate
cd ..
```

#### 5. Redis Setup
```bash
# Start Redis (macOS with Homebrew)
redis-server

# Or with Docker
docker run -d -p 6379:6379 redis:latest
```

#### 6. Verify Setup
```bash
# Test Node.js
node --version

# Test npm
npm --version

# Test PostgreSQL connection
psql -U postgres -d lintwise_db -c "SELECT 1;"

# Test Redis connection
redis-cli ping
```

---

## Frontend Setup

### Project Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Loading.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── ForgotPassword.tsx
│   │   └── review/
│   │       ├── CodeEditor.tsx
│   │       ├── ReviewResult.tsx
│   │       └── ReviewHistory.tsx
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── ReviewHistory.tsx
│   │   └── NotFound.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useReview.ts
│   │   └── useLocalStorage.ts
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── reviewStore.ts
│   │   └── uiStore.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── authService.ts
│   │   └── reviewService.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   └── review.ts
│   ├── utils/
│   │   ├── constants.ts
│   │   ├── validators.ts
│   │   ├── formatters.ts
│   │   └── logger.ts
│   ├── styles/
│   │   ├── globals.css
│   │   └── variables.css
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── public/
│   └── assets/
├── .env.local
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

### Installation & Running

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

### Key Configuration Files

**`vite.config.ts`:**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
})
```

**`tailwind.config.js`:**
```javascript
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
    },
  },
  plugins: [],
}
```

---

## Backend Setup

### Project Structure
```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.module.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── local.strategy.ts
│   │   │   └── dtos/
│   │   │       ├── login.dto.ts
│   │   │       └── register.dto.ts
│   │   ├── users/
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.module.ts
│   │   │   ├── dtos/
│   │   │   └── entities/
│   │   ├── reviews/
│   │   │   ├── reviews.controller.ts
│   │   │   ├── reviews.service.ts
│   │   │   ├── reviews.module.ts
│   │   │   ├── dtos/
│   │   │   ├── entities/
│   │   │   └── queue/
│   │   └── health/
│   │       ├── health.controller.ts
│   │       └── health.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── auth.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   └── user.decorator.ts
│   │   ├── guards/
│   │   │   ├── jwt.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── rate-limit.guard.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── transform.interceptor.ts
│   │   │   └── cache.interceptor.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   ├── middleware/
│   │   │   ├── logger.middleware.ts
│   │   │   └── cors.middleware.ts
│   │   └── constants/
│   ├── config/
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   ├── jwt.config.ts
│   │   └── env.validation.ts
│   ├── services/
│   │   ├── claude.service.ts
│   │   ├── cache.service.ts
│   │   └── email.service.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── app.module.ts
│   └── main.ts
├── test/
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
├── .env
├── .env.example
├── nest-cli.json
├── tsconfig.json
└── package.json
```

### Installation & Running

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server (with hot reload)
npm run start:dev

# Start in production mode
npm run start:prod

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

### Key NestJS Modules

**Main Application Module (`app.module.ts`):**
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './config/database.module';
import { RedisModule } from './config/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    UsersModule,
    ReviewsModule,
    HealthModule,
  ],
})
export class AppModule {}
```

---

## Database Design

### Prisma Schema (`schema.prisma`)

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserRole {
  USER
  ADMIN
  PREMIUM
}

enum ReviewStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum Language {
  JAVASCRIPT
  TYPESCRIPT
  PYTHON
  JAVA
  CSHARP
  CPP
  GO
  RUST
  PHP
  RUBY
  KOTLIN
  SWIFT
  OTHER
}

enum IssueSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
  INFO
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  username      String    @unique
  passwordHash  String
  firstName     String?
  lastName      String?
  avatar        String?
  bio           String?
  role          UserRole  @default(USER)
  isEmailVerified Boolean @default(false)
  isActive      Boolean   @default(true)
  
  // Relations
  reviews       Review[]
  favorites     CodeSnippet[]
  
  // Metadata
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastLoginAt   DateTime?
  
  @@index([email])
  @@index([username])
}

model CodeSnippet {
  id            String    @id @default(cuid())
  title         String
  description   String?
  code          String
  language      Language
  fileName      String?
  
  // Relations
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  reviews       Review[]
  
  // Metadata
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@index([userId])
  @@fulltext([code, title])
}

model Review {
  id              String        @id @default(cuid())
  status          ReviewStatus  @default(PENDING)
  
  // Relations
  userId          String
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  snippetId       String
  snippet         CodeSnippet   @relation(fields: [snippetId], references: [id], onDelete: Cascade)
  issues          Issue[]
  
  // Review Content
  overallScore    Int? // 0-100
  summary         String?
  recommendations String?
  
  // Performance
  processingTime  Int? // milliseconds
  tokensUsed      Int?
  
  // Metadata
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  completedAt     DateTime?
  
  @@index([userId])
  @@index([snippetId])
  @@index([status])
  @@index([createdAt])
}

model Issue {
  id              String        @id @default(cuid())
  severity        IssueSeverity
  category        String // e.g., "Security", "Performance", "Style"
  title           String
  description     String
  suggestion      String
  codeLocation    String? // Line numbers or code context
  
  // Relations
  reviewId        String
  review          Review        @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  
  // Metadata
  createdAt       DateTime      @default(now())
  
  @@index([reviewId])
  @@index([severity])
}

model AuditLog {
  id              String    @id @default(cuid())
  action          String
  entityType      String
  entityId        String
  userId          String?
  details         Json?
  ipAddress       String?
  userAgent       String?
  createdAt       DateTime  @default(now())
  
  @@index([userId])
  @@index([createdAt])
}
```

### Database Migrations

```bash
# Create initial migration
npx prisma migrate dev --name init

# Create new migration
npx prisma migrate dev --name add_field_name

# Deploy migrations
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# View migration status
npx prisma migrate status
```

---

## API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

### Response Format
```json
{
  "status": "success" | "error",
  "data": {},
  "message": "string",
  "timestamp": "ISO-8601",
  "requestId": "uuid"
}
```

### Error Handling
```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "timestamp": "ISO-8601"
}
```

### Endpoints

#### Authentication Endpoints

**POST /auth/register**
```typescript
// Request
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}

// Response (201)
{
  "status": "success",
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "johndoe",
    "token": "jwt-token"
  }
}
```

**POST /auth/login**
```typescript
// Request
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

// Response (200)
{
  "status": "success",
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "username": "johndoe"
    },
    "token": "jwt-token",
    "refreshToken": "refresh-token"
  }
}
```

**POST /auth/refresh**
```typescript
// Request
{
  "refreshToken": "refresh-token"
}

// Response (200)
{
  "status": "success",
  "data": {
    "token": "new-jwt-token"
  }
}
```

#### Review Endpoints

**POST /reviews**
```typescript
// Request
{
  "code": "const hello = () => console.log('hello');",
  "language": "JAVASCRIPT",
  "fileName": "hello.js",
  "title": "Simple Hello Function"
}

// Response (201)
{
  "status": "success",
  "data": {
    "id": "review-id",
    "status": "PROCESSING",
    "snippetId": "snippet-id",
    "createdAt": "ISO-8601"
  }
}
```

**GET /reviews/:id**
```typescript
// Response (200)
{
  "status": "success",
  "data": {
    "id": "review-id",
    "status": "COMPLETED",
    "overallScore": 78,
    "summary": "Generally good code with some improvements...",
    "issues": [
      {
        "id": "issue-id",
        "severity": "MEDIUM",
        "category": "Style",
        "title": "Use const instead of var",
        "description": "...",
        "suggestion": "..."
      }
    ],
    "completedAt": "ISO-8601"
  }
}
```

**GET /reviews**
```typescript
// Query Parameters
?page=1&limit=10&status=COMPLETED&sortBy=createdAt&sortOrder=DESC

// Response (200)
{
  "status": "success",
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "pages": 5
    }
  }
}
```

**DELETE /reviews/:id**
```typescript
// Response (200)
{
  "status": "success",
  "message": "Review deleted successfully"
}
```

#### User Endpoints

**GET /users/profile**
```typescript
// Response (200)
{
  "status": "success",
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "createdAt": "ISO-8601"
  }
}
```

**PATCH /users/profile**
```typescript
// Request
{
  "firstName": "Jonathan",
  "lastName": "Smith",
  "bio": "Full-stack developer"
}

// Response (200)
{
  "status": "success",
  "data": { ... }
}
```

#### Health Check

**GET /health**
```typescript
// Response (200)
{
  "status": "ok",
  "timestamp": "ISO-8601",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected"
}
```

---

## Authentication & Security

### JWT Configuration
- **Algorithm**: HS256
- **Expiration**: 7 days (user configurable)
- **Refresh Token**: 30 days
- **Secret**: Environment variable (minimum 32 characters)

### Password Security
- **Hashing**: bcrypt with salt rounds = 10
- **Minimum Length**: 8 characters
- **Complexity**: At least 1 uppercase, 1 lowercase, 1 number, 1 special character

### Rate Limiting
```typescript
// Global rate limit: 100 requests per 15 minutes
// Per endpoint: Configurable
@UseGuards(ThrottleGuard)
@Throttle(10, 60) // 10 requests per minute
```

### CORS Configuration
```typescript
cors: {
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}
```

### Environment Variables Security
- ✅ Use `.env` file (not committed to git)
- ✅ Minimum 32-character secret keys
- ✅ Rotate keys periodically in production
- ✅ Use AWS Secrets Manager or similar in production

### API Security Headers
```typescript
// Helmet.js integration
app.use(helmet());
// Sets:
// - X-Content-Type-Options: nosniff
// - X-Frame-Options: DENY
// - X-XSS-Protection: 1; mode=block
// - Strict-Transport-Security: max-age=31536000
```

---

## Deployment

### Docker Deployment

**Backend Dockerfile:**
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

**Frontend Dockerfile:**
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Docker Compose (`docker-compose.yml`):**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-password}
      POSTGRES_DB: ${DB_NAME:-lintwise_db}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_HOST: redis
      REDIS_PORT: 6379
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Cloud Deployment (AWS/Railway)

**GitHub Actions CI/CD:**
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        run: npm run test
      
      - name: Build backend
        run: |
          cd backend
          npm run build
      
      - name: Build frontend
        run: |
          cd frontend
          npm run build
      
      - name: Deploy to Railway
        run: |
          npm install -g @railway/cli
          railway deploy
```

---

## Development Guidelines

### Code Style

**TypeScript Configuration:**
- Strict mode enabled
- No implicit `any`
- Strict null checks
- Strict function types

**Naming Conventions:**
- **Classes/Types**: PascalCase (e.g., `UserService`, `AuthDto`)
- **Functions/Variables**: camelCase (e.g., `getUserById`, `isActive`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **Files**: kebab-case (e.g., `user-service.ts`, `auth.controller.ts`)

**Code Formatting:**
- Prettier with 2-space indentation
- Line length: 100 characters
- Semicolons required
- Single quotes for strings

### Git Workflow

**Branch Naming:**
```
feature/feature-name
bugfix/bug-name
hotfix/critical-issue
refactor/refactor-name
docs/documentation-update
```

**Commit Messages:**
```
feat: Add new feature
fix: Fix bug
docs: Update documentation
style: Format code
refactor: Refactor code
test: Add tests
chore: Update dependencies
```

**Pull Request Process:**
1. Create feature branch from `develop`
2. Make changes and commit with conventional commits
3. Push branch and create PR
4. Ensure all checks pass
5. Request code review from 2+ developers
6. Address feedback
7. Squash and merge to `develop`

### Code Review Checklist
- [ ] Code follows style guide
- [ ] No security vulnerabilities
- [ ] Includes unit tests
- [ ] Includes integration tests
- [ ] Documentation updated
- [ ] Error handling implemented
- [ ] Performance optimized
- [ ] No console.logs in production code

### Documentation Standards
- JSDoc comments for all functions
- Type definitions for all parameters
- README for each module
- API endpoint documentation
- Architecture decisions documented

---

## Troubleshooting

### Common Issues & Solutions

#### Database Connection Issues
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT 1;"

# Reset database
npx prisma migrate reset

# Check connection string
echo $DATABASE_URL

# Verify Prisma client
npx prisma generate
```

#### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping

# Test Redis connection
redis-cli -h localhost -p 6379 ping

# Check Redis logs
redis-server --loglevel debug
```

#### Port Already in Use
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Change port in .env
PORT=3001
```

#### Node Module Issues
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

#### Build Errors
```bash
# Clear dist folder
rm -rf dist/

# Rebuild
npm run build

# Check for TypeScript errors
npm run type-check
```

### Logging & Debugging

**Enable Debug Mode:**
```bash
DEBUG=* npm run start:dev
```

**View Logs:**
```bash
# Docker logs
docker logs lintwise-backend

# NestJS logger configuration
// main.ts
const logger = new Logger();
app.useLogger(logger);
```

---

## Performance Optimization

### Caching Strategy
- **User Sessions**: Redis (TTL: 7 days)
- **Review Results**: Redis (TTL: 30 days)
- **Popular Snippets**: Redis (TTL: 1 hour)
- **Language Stats**: Redis (TTL: 1 hour)

### Database Optimization
- Indexes on frequently queried columns
- Connection pooling (min: 2, max: 10)
- Query optimization with Prisma
- Archive old reviews monthly

### API Optimization
- Response compression (gzip)
- Pagination for list endpoints
- Selective field loading
- Request/response caching headers

### Frontend Optimization
- Code splitting with dynamic imports
- Lazy loading images
- Service worker caching
- Tree shaking unused code
- Minification & compression

---

## Monitoring & Logging

### Logging Configuration
```typescript
// NestJS Logger
import { Logger } from '@nestjs/common';

const logger = new Logger('Context');
logger.log('Info message');
logger.error('Error message', stack);
logger.warn('Warning message');
logger.debug('Debug message', metadata);
```

### Monitoring Tools
- **Sentry**: Error tracking
- **DataDog**: Performance monitoring
- **CloudWatch**: AWS logs
- **Grafana**: Metrics visualization

### Health Checks
- Database connectivity
- Redis connectivity
- Claude API availability
- Memory usage
- CPU usage

---

## Maintenance

### Regular Tasks
- Monthly dependency updates
- Quarterly security audits
- Database cleanup (archive old data)
- Certificate renewal
- Log rotation

### Backup Strategy
- Daily database backups to S3
- Weekly full backups
- Monthly archive backups
- Test restore procedures

### Disaster Recovery
- RTO (Recovery Time Objective): 1 hour
- RPO (Recovery Point Objective): 1 day
- Failover procedures documented
- Regular DR drills

---

## Support & Resources

### Documentation
- [NestJS Documentation](https://docs.nestjs.com)
- [React Documentation](https://react.dev)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)

### Community
- GitHub Issues for bug reports
- GitHub Discussions for questions
- Discord server for community support

### Contact
- Email: support@lintwise.com
- Slack: #lintwise-support
- GitHub: github.com/yourusername/lintwise

---

**Last Updated**: April 2024
**Version**: 1.0.0
**Maintainers**: Development Team
