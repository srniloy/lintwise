# LintWise - AI-Powered Code Review Tool

LintWise is an intelligent code review platform powered by Claude AI. It provides instant, comprehensive code analysis across 50+ programming languages — helping developers catch security issues, performance problems, and style violations before committing code.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS, Axios, Zustand, React Query, Monaco Editor |
| Backend | NestJS, TypeScript, Prisma ORM |
| Database | PostgreSQL 15+ |
| Cache | Redis 7+ |
| Auth | JWT (access: 7d, refresh: 30d), bcrypt |
| AI | Claude API (Anthropic) |
| DevOps | Docker, Docker Compose, GitHub Actions |

---

## Architecture

```
Client (React + Vite)
        │ HTTP/REST
        ▼
API Gateway / Nginx
        │
NestJS Backend (Controllers → Services → Guards)
    ├── Auth Module
    ├── User Module
    ├── Code Review Module
    ├── File Upload Module
    └── History Module
        │
   ┌────┼────────────┐
   ▼    ▼            ▼
PostgreSQL  Redis    Claude API
(data)      (cache,  (AI analysis)
             sessions)
```

**Code Review Flow:**
1. User submits code via React frontend
2. Backend stores code in PostgreSQL and queues in Redis
3. Worker calls Claude API for analysis
4. Results stored and returned to frontend

**Design Patterns:** MVC, Dependency Injection, Repository, Guard, Interceptor

---

## Setup

### Prerequisites
- Node.js 18+ LTS
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### Option A: Docker (Recommended)
```bash
docker-compose up
# Backend: http://localhost:3000
# Frontend: http://localhost:5173
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

### Option B: Manual

**1. Clone & install**
```bash
git clone https://github.com/yourusername/lintwise.git
cd lintwise
```

**2. Configure backend** — create `backend/.env`:
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/lintwise_db
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRATION=7d
REFRESH_TOKEN_EXPIRATION=30d
CLAUDE_API_KEY=sk-ant-xxxx
CLAUDE_MODEL=claude-sonnet-4-6
CLAUDE_MAX_TOKENS=2000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=http://localhost:5173
```

**3. Configure frontend** — create `frontend/.env.local`:
```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=LintWise
```

**4. Start backend**
```bash
cd backend
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run start:dev
# API ready at http://localhost:3000
```

**5. Start frontend**
```bash
cd frontend
npm install
npm run dev
# App ready at http://localhost:5173
```

---

## Project Structure

```
lintwise/
├── backend/
│   ├── src/
│   │   ├── modules/          # Feature modules (auth, users, reviews, etc.)
│   │   ├── common/           # Guards, interceptors, pipes, decorators
│   │   └── app.module.ts
│   ├── prisma/
│   │   └── schema.prisma     # Database schema
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom hooks (useAuth, useReview)
│   │   ├── store/            # Zustand stores (auth, review, ui)
│   │   ├── services/         # API service calls
│   │   └── types/            # TypeScript types
│   ├── vite.config.ts
│   └── .env.local
└── docker-compose.yml
```

---

## API Overview

Base URL: `http://localhost:3000/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login, returns JWT |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password with token |
| GET | `/users/profile` | Get current user profile |
| PUT | `/users/profile` | Update profile |
| POST | `/reviews` | Submit code for review |
| GET | `/reviews` | List user's reviews |
| GET | `/reviews/:id` | Get review result |
| DELETE | `/reviews/:id` | Delete a review |
| POST | `/snippets` | Save code snippet |
| GET | `/snippets` | List saved snippets |
| GET | `/health` | System health check |

Full API docs available at `http://localhost:3000/api/docs` (Swagger) when running.

**Rate Limits:** 100 requests / 15 minutes per user. Premium: 10,000 / day.

---

## User Roles

| Role | Capabilities |
|------|-------------|
| USER | Code reviews, basic export, REST API |
| PREMIUM | All USER + team collaboration, webhooks, advanced analytics |
| ADMIN | All + user management, system configuration, billing |

---

## Testing

```bash
# Backend tests
cd backend
npm run test          # Unit tests
npm run test:e2e      # Integration & E2E tests
npm run test:cov      # Coverage report (target: 80%)

# Frontend tests
cd frontend
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright E2E tests
```

See [LintWiseTest.md](LintWiseTest.md) for full testing strategy, examples, and CI/CD setup.

---

## Database Management

```bash
cd backend
npx prisma migrate dev --name <migration-name>   # Create migration
npx prisma generate                              # Regenerate client
npx prisma studio                                # Visual DB editor
npx prisma db push                               # Push schema (no migration)
```

---

## Deployment

**GitHub Actions CI/CD** runs on every PR: lint → unit tests → integration tests → E2E → build → deploy.

**Blue-green deployment** strategy for zero-downtime releases.

```bash
# Build images
docker build -t lintwise-backend ./backend
docker build -t lintwise-frontend ./frontend
```

---

## Key Targets

| Metric | Target |
|--------|--------|
| GET response time | < 200ms (p95) |
| POST response time | < 500ms (p95) |
| Uptime SLA | 99.9% |
| Concurrent users | 1,000+ |
| Daily reviews | 10,000+ |
| Test coverage | 80% minimum |

---

## Documentation

- [LintWise-Requirements-Summary.md](LintWise-Requirements-Summary.md) — Full functional & non-functional requirements (FR1–FR8, NFR1–NFR10)
- [LintWiseTest.md](LintWiseTest.md) — Testing strategy, examples, CI/CD pipeline
