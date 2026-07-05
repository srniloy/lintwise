<div align="center">
  <h1>LintWise</h1>
  <p><strong>AI-Powered Code Review Platform</strong></p>
  <p>Automated code analysis across 50+ languages — catching security flaws, performance bottlenecks, and style violations before they reach production.</p>

  <p>
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React 19">
    <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs" alt="NestJS 11">
    <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript" alt="TypeScript 6">
    <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql" alt="PostgreSQL 16">
    <img src="https://img.shields.io/badge/Gemini-AI-8E75B2?logo=googlegemini" alt="Gemini AI">
  </p>

  <p>
    <a href="#features">Features</a>&nbsp;&nbsp;•&nbsp;&nbsp;
    <a href="#in-scope--out-of-scope">Scope</a>&nbsp;&nbsp;•&nbsp;&nbsp;
    <a href="#architecture">Architecture</a>&nbsp;&nbsp;•&nbsp;&nbsp;
    <a href="#getting-started">Getting Started</a>&nbsp;&nbsp;•&nbsp;&nbsp;
    <a href="#project-structure">Structure</a>&nbsp;&nbsp;•&nbsp;&nbsp;
    <a href="#api-overview">API</a>&nbsp;&nbsp;•&nbsp;&nbsp;
    <a href="#testing">Testing</a>
  </p>
</div>

---

## Overview

LintWise is a full-stack code review platform that leverages Google's Gemini API to provide instant, comprehensive code analysis. Developers submit code through a rich web interface, and the backend processes it asynchronously — generating categorized issues (security, performance, quality, style, documentation, testing, dependencies) with severity ratings, suggested fixes, and an overall code health score.

The project is split into two packages:

| Package | Description | Repository |
|---------|-------------|------------|
| `lintwise/` | React + Vite frontend | This repo |
| `lintwise-server/` | NestJS + Prisma backend | [srniloy/lintwise-server](https://github.com/srniloy/lintwise-server) |

---

## Features

- **AI Code Review** — Submit code in 50+ languages and get a detailed analysis with categorized issues and suggested fixes
- **User Management** — Registration, email verification, login with JWT, password reset, profile management
- **Role-Based Access** — USER, PREMIUM, and ADMIN tiers with different capabilities
- **Review History** — Paginated, filterable history of all past reviews with search
- **Code Snippets** — Save, version, and organize code snippets
- **Collections** — Group reviews and snippets into shareable collections
- **Export** — Download review reports as JSON, Markdown, CSV, or PDF
- **Analytics Dashboard** — Personal and team-wide charts for code quality trends, issue breakdown, and language distribution
- **Team Collaboration** — Invite team members, share reviews, and leave threaded comments (Premium)
- **Notifications** — In-app notifications for review completions, critical issues, mentions, and replies
- **Webhooks** — Integrate with external services via event-driven webhooks (Premium)
- **Admin Panel** — User management, role assignments, platform-wide stats, and system health monitoring
- **Dark Mode** — Full light/dark theme support

---

## Scope

### In Scope (Implemented)

**AI Code Review**
- Submit code for analysis via Gemini API with a 3-model fallback chain
- Issues categorized by type (Security, Performance, Quality, Style, Documentation, Testing, Dependencies)
- Severity ratings (Critical, High, Medium, Low) with suggested fixes
- Overall code health score and summary
- Support for 50+ programming languages

**User Management**
- Registration with email verification
- Login with JWT (access: 7d, refresh: 30d)
- Password reset flow with email
- Profile management with avatar upload
- Account deletion with confirmation

**Review Management**
- Create reviews by pasting code or uploading files
- Real-time status tracking (PENDING → PROCESSING → COMPLETED)
- Paginated, filterable review history
- Review export (JSON, Markdown, CSV, PDF)

**Code Management**
- Code snippets with version history
- Collections to organize reviews and snippets
- Shareable collection links

**Team Collaboration (Premium)**
- Team creation and ownership transfer
- Email-based team invites with accept/reject
- Member role management
- Threaded comments on reviews with @mentions

**Notifications**
- In-app notification center with unread count
- Polling-based updates
- Notification type preferences
- Email notifications for critical events

**Webhooks (Premium)**
- Register webhook endpoints with event selection
- Automatic delivery with retry
- Delivery attempt logs

**Analytics & Dashboard**
- Personal statistics (reviews, issues, score trends, languages)
- Team analytics (Premium)
- Interactive charts (Recharts)

**Admin Panel**
- User management (list, search, role change, delete)
- Platform-wide statistics
- System health monitoring (DB, Redis, Gemini)

**Subscriptions**
- Stripe checkout integration
- Cancel / resubscribe flow
- Invoice history

**Quality**
- Input validation with class-validator and Joi
- Comprehensive E2E test suite (13 test files)
- Clean architecture with NestJS modular pattern
- Prisma ORM with PostgreSQL
- Redis caching with graceful degradation
- Interactive Swagger API documentation
- Consistent response envelope format

### Out of Scope (Acknowledged Limitations)

**Security & Auth**
- No OAuth / social login (Google, GitHub, etc.)
- No multi-factor authentication
- No API key authentication for programmatic access
- No audit logging for admin actions
- No session management beyond JWT expiry
- No brute-force protection for endpoints other than login

**Scale & Performance**
- No horizontal scaling / load balancing
- No database read replicas
- No connection pooling configuration
- No message queue for review processing (fire-and-forget)
- No query optimization beyond Prisma defaults
- No CDN for static assets
- No distributed caching across instances

**Real-Time Features**
- No WebSocket / SSE for real-time updates (polling-based)
- No real-time collaborative editing
- No live presence indicators

**Integrations**
- No IDE plugins (VS Code, JetBrains)
- No CI/CD pipeline integration (GitHub Actions, GitLab CI, etc.)
- No Git provider integration (push-based review triggers)
- No Slack / Discord notification webhooks
- No mobile native apps (iOS / Android)

**Advanced Features**
- No on-device / offline AI analysis
- No review comparison / diff view across versions
- No custom rule configuration for review scoring
- No code explanation / refactoring suggestions beyond issues
- No batch review of multiple files in a single submission
- No search across all reviews content
- No data retention / archival policies

**DevOps**
- No CI/CD pipeline
- No monitoring / alerting (Sentry, DataDog, etc.)
- No container orchestration (Kubernetes)
- No database backup automation
- No migration rollback strategy
- No blue-green / canary deployment strategy
- No health check endpoints beyond basic `/health`
- No metrics / telemetry collection

**Compliance & Enterprise**
- No SOC2 / HIPAA compliance
- No data residency controls
- No role-based access for frontend routes (guards are basic)
- No rate limiting per endpoint category beyond two tiers
- No SSO / SAML support
- No data export / GDPR compliance tooling

**Rationale:** These are production-hardening concerns that would be addressed in subsequent iterations based on user demand, load testing, and business requirements. The focus for this release was on delivering a functional, well-architected code review platform with clean separation of concerns, comprehensive testing, and a solid developer experience.

---

## Architecture

### System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                AWS CloudFront + ACM (SSL/TLS)                    │
│                           │                                      │
│          AWS S3 (Frontend Static Hosting)                        │
│    React 19 / Vite / TypeScript 6 / Tailwind CSS 4              │
│    shadcn/ui  |  Zustand  |  React Router  |  Recharts          │
└───────────────────────┬──────────────────────────────────────────┘
                        │ HTTPS / REST (JWT Bearer)
┌───────────────────────▼──────────────────────────────────────────┐
│              AWS EC2 (Nginx + PM2)                               │
│                    NestJS 11 + Prisma 6                          │
│                                                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐    │
│  │   Auth    │ │  Reviews  │ │ Snippets  │ │  Collections  │    │
│  │ (JWT)     │ │  (Gemini) │ │           │ │               │    │
│  └───────────┘ └───────────┘ └───────────┘ └───────────────┘    │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐    │
│  │  Teams    │ │ Comments  │ │   Admin   │ │  Notifications│    │
│  │(Premium)  │ │           │ │ Analytics  │ │  Email + InApp│    │
│  └───────────┘ └───────────┘ └───────────┘ └───────────────┘    │
│  ┌───────────┐ ┌───────────┐ ┌──────────────────────────────┐   │
│  │ Webhooks  │ │Subscript.│ │      Health                   │   │
│  │(Premium)  │ │ (Stripe) │ │      Check                    │   │
│  └───────────┘ └───────────┘ └──────────────────────────────┘   │
└─────────────┬─────────────────────┬──────────────────────────────┘
              │                     │
┌─────────────▼──────────┐ ┌───────▼──────────────────────────┐
│   AWS RDS PostgreSQL   │ │   AWS ElastiCache Redis          │
│   (Prisma ORM)         │ │   (Caching / Token Revocation)   │
└────────────────────────┘ └──────────────────────────────────┘
              │                     │
              ▼                     ▼
    ┌──────────────┐   ┌──────────────┐   ┌────────────────┐
    │  Gemini AI   │   │  Stripe API  │   │  SMTP Email    │
    │ (Code Review)│   │ (Payments)   │   │ (Nodemailer)   │
    └──────────────┘   └──────────────┘   └────────────────┘

          AWS CodePipeline + CodeBuild (CI/CD)
```

### Code Review Flow

1. User pastes code or uploads files via the React frontend
2. Frontend sends a `POST /api/v1/reviews` request with code and language
3. Backend stores the review in PostgreSQL with status `PENDING`
4. Backend returns the review ID immediately (asynchronous processing)
5. A background process calls the Gemini API with a structured prompt
6. Gemini returns categorized issues (security, performance, quality, etc.) with severity, descriptions, and fix suggestions
7. Results are persisted to the database; status changes to `COMPLETED`
8. Frontend polls the status endpoint, then renders results with charts and annotations

### Gemini Fallback Chain

The review service implements a 3-model fallback chain with exponential backoff:

```
gemini-2.0-flash (primary)
  ↓ on failure → wait 1s
gemini-2.0-pro (secondary)
  ↓ on failure → wait 2s
gemini-1.5-pro (tertiary)
  ↓ on failure → review marked as FAILED
```

### Design Patterns

| Pattern | Usage |
|---------|-------|
| MVC | NestJS modules with Controllers → Services → Prisma |
| Dependency Injection | NestJS DI container for all services and providers |
| Guard | JWT authentication guard (`@Public()` for open routes) and role-based guard (`@Roles('ADMIN')`) |
| Interceptor | Response envelope wrapping (`{ status, data }`) and request logging |
| Decorator | Custom `@CurrentUser()`, `@Public()`, `@Roles()` decorators |
| Strategy | JWT strategy for token validation |
| Repository | Prisma ORM abstracts database access |
| Background Processing | Fire-and-forget async review analysis after HTTP response |
| Fallback Chain | 3 Gemini model fallbacks with exponential backoff |
| Graceful Degradation | Redis outages don't break core functionality |

---

## Project Structure

```
lintwise/                          ← This repo (frontend)
├── src/
│   ├── assets/                    Static images and icons
│   ├── components/
│   │   └── ui/                    shadcn/ui primitives (Button, Card, Modal, etc.)
│   │   ├── Topbar.tsx             Navigation bar with breadcrumbs and notifications
│   │   ├── Sidebar.tsx            Collapsible role-aware sidebar
│   │   ├── ThemeToggle.tsx        Light/dark mode switch
│   │   ├── ErrorBoundary.tsx      React error boundary
│   │   ├── ProtectedRoute.tsx     Auth guard wrapper
│   │   ├── RoleGuard.tsx          Role-based access wrapper
│   │   ├── NotificationPanel.tsx  Notification dropdown
│   │   ├── CommentsPanel.tsx      Threaded review comments
│   │   ├── ExportMenu.tsx         Export format selector
│   │   └── OfflineBanner.tsx      Offline connectivity warning
│   ├── constants/
│   │   └── routes.ts              Route path constants
│   ├── hooks/
│   │   ├── useAuth.ts             Auth state hook
│   │   ├── useTheme.ts            Theme toggle hook
│   │   ├── useNotifications.ts    Notification polling hook
│   │   └── useReviewStatus.ts     Review status polling hook
│   ├── layouts/
│   │   ├── AppLayout.tsx          Authenticated app shell
│   │   └── PublicLayout.tsx       Public pages wrapper
│   ├── lib/
│   │   ├── utils.ts               cn() class merge utility
│   │   └── download.ts            File download helper
│   ├── pages/
│   │   ├── LoginPage.tsx          Login with JWT
│   │   ├── RegisterPage.tsx       User registration
│   │   ├── ForgotPasswordPage.tsx Password reset request
│   │   ├── ResetPasswordPage.tsx  Password reset with token
│   │   ├── VerifyEmailPage.tsx    Email verification
│   │   ├── DashboardPage.tsx      Analytics dashboard with charts
│   │   ├── ReviewNewPage.tsx      Code submission
│   │   ├── ReviewsPage.tsx        Review history with filters
│   │   ├── ReviewDetailPage.tsx   Single review results
│   │   ├── ReviewStatusPage.tsx   Processing status poller
│   │   ├── SnippetsPage.tsx       Code snippets library
│   │   ├── CollectionsPage.tsx    Review/snippet collections
│   │   ├── ProfilePage.tsx        User settings
│   │   ├── AdminPage.tsx          Admin panel
│   │   ├── TeamPage.tsx           Team management (Premium)
│   │   ├── TeamAcceptPage.tsx     Accept team invite
│   │   ├── UpgradePage.tsx        Premium subscription
│   │   └── NotFoundPage.tsx       404 page
│   ├── services/
│   │   ├── apiClient.ts           Core HTTP client with caching and auth
│   │   ├── authService.ts         Auth API calls
│   │   ├── reviewService.ts       Review CRUD + export
│   │   ├── snippetService.ts      Snippet CRUD
│   │   ├── collectionService.ts   Collection CRUD
│   │   ├── commentService.ts      Comment CRUD
│   │   ├── notificationService.ts Notification fetch/mark read
│   │   ├── analyticsService.ts    Analytics data
│   │   ├── teamService.ts         Team management
│   │   ├── adminService.ts        Admin operations
│   │   └── download.ts            Export download
│   ├── store/
│   │   ├── authStore.ts           Zustand auth state (persisted)
│   │   ├── themeStore.ts          Zustand theme state (persisted)
│   │   └── notificationStore.ts   Zustand notification state
│   ├── types/
│   │   ├── index.ts               Re-exports and common types
│   │   ├── auth.ts                User/Auth type definitions
│   │   ├── review.ts              Review/Issue type definitions
│   │   ├── snippet.ts             Snippet/Collection types
│   │   ├── notification.ts        Notification types
│   │   └── team.ts                Team/Member/Comment types
│   ├── App.tsx                    Root component with routing
│   ├── main.tsx                   Entry point
│   └── index.css                  Global styles + Tailwind
├── public/                        Static public assets
├── docker-compose.yml             Multi-service Docker Compose
├── Dockerfile                     Frontend container build
├── buildspec.yml                  AWS CodeBuild CI/CD
├── vite.config.ts                 Vite configuration
├── tsconfig.json                  TypeScript configuration
└── package.json                   Dependencies and scripts

lintwise-server/                  ← Backend (separate repo)
└── See https://github.com/srniloy/lintwise-server
```

---

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| React 19 | UI framework |
| TypeScript 6 | Type safety |
| Vite 8 | Build tool and dev server |
| Tailwind CSS 4 | Utility-first styling |
| shadcn/ui + Radix UI | Accessible component primitives |
| Zustand 5 | Lightweight state management |
| React Router DOM 7 | Client-side routing with lazy loading |
| Recharts 3 | Charts and data visualization |
| CodeMirror (@uiw/react-codemirror) | Code editor with syntax highlighting |
| TanStack React Virtual | List virtualization |
| Lucide React | Icon library |
| Sonner | Toast notifications |

### Backend

| Technology | Purpose |
|------------|---------|
| NestJS 11 | Node.js framework (MVC + DI) |
| TypeScript 5 | Type safety |
| Prisma 6 | ORM with PostgreSQL |
| PostgreSQL 16 | Primary database |
| Redis 7 | Cache and token revocation |
| Google Gemini API | AI code analysis |
| JWT (NestJS JWT) | Authentication |
| bcrypt | Password hashing |
| Nodemailer | Email delivery |
| Stripe | Payment subscriptions |
| Swagger / OpenAPI | API documentation |
| class-validator + Joi | Input validation |
| Helmet | Security headers |
| Jest | Testing framework |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Local orchestration |
| AWS CodeBuild | CI/CD pipeline |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (recommended)
- PostgreSQL 16+ (manual setup only)
- Redis 7+ (manual setup only)
- Gemini API key ([get one here](https://aistudio.google.com/apikey))

### Option A: Docker (Recommended)

```bash
# Clone the frontend
git clone https://github.com/yourusername/lintwise.git
cd lintwise

# Clone the backend alongside
git clone https://github.com/srniloy/lintwise-server.git lintwise-server

# Set your Gemini API key
export GEMINI_API_KEY=your_key_here

# Start all services
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Swagger Docs | http://localhost:3000/api/docs |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### Option B: Manual Setup

**Backend (see [lintwise-server README](https://github.com/srniloy/lintwise-server) for details):**

```bash
cd lintwise-server
cp .env.example .env   # Edit with your values
npm install
npx prisma migrate dev
npx prisma generate
npm run start:dev
```

**Frontend:**

```bash
cd lintwise

# Install dependencies
npm install

# Set API URL (defaults to http://localhost:3000/api/v1)
# Create .env.local if needed:
# echo "VITE_API_URL=http://localhost:3000/api/v1" > .env.local

# Start dev server
npm run dev
```

### Seed Data

The backend includes a seed script that creates test users:

```bash
cd lintwise-server
npx prisma db seed
```

| Email | Password | Role |
|-------|----------|------|
| admin@lintwise.com | Admin1234! | ADMIN |
| premium@lintwise.com | Premium1! | PREMIUM |
| user@lintwise.com | User1234! | USER |

---

## API Overview

Base URL: `http://localhost:3000/api/v1`

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account (triggers verification email) |
| POST | `/auth/login` | Login, returns access + refresh tokens |
| POST | `/auth/logout` | Revoke tokens |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/verify-email` | Verify email with token |
| POST | `/auth/resend-verification` | Resend verification email |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password with token |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/profile` | Get current user profile |
| PUT | `/users/profile` | Update profile |
| PUT | `/users/change-password` | Change password |
| DELETE | `/users/delete-account` | Delete account |

### Reviews

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/reviews` | Submit code for review |
| GET | `/reviews` | List reviews (paginated, filterable) |
| GET | `/reviews/:id` | Get review with issues |
| GET | `/reviews/:id/status` | Get review processing status |
| GET | `/reviews/:id/export` | Export review (query: format=json\|md\|csv\|pdf) |
| DELETE | `/reviews/:id` | Delete a review |

### Snippets & Collections

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/snippets` | List snippets |
| POST | `/snippets` | Create snippet |
| GET | `/snippets/:id` | Get snippet with versions |
| PUT | `/snippets/:id` | Update snippet |
| DELETE | `/snippets/:id` | Delete snippet |
| GET | `/collections` | List collections |
| POST | `/collections` | Create collection |
| GET | `/collections/:id` | Get collection with items |
| PUT | `/collections/:id` | Update collection |
| DELETE | `/collections/:id` | Delete collection |

### Teams (Premium)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/teams` | Create team |
| GET | `/teams/current` | Get current team |
| PUT | `/teams/:id` | Update team |
| POST | `/teams/:id/invite` | Invite member |
| POST | `/teams/invites/accept` | Accept invite |
| POST | `/teams/invites/reject` | Reject invite |
| DELETE | `/teams/:id/members/:userId` | Remove member |
| PUT | `/teams/:id/transfer-ownership` | Transfer ownership |

### Comments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/comments/review/:reviewId` | List comments for a review |
| POST | `/comments` | Create comment |
| PUT | `/comments/:id` | Update comment |
| DELETE | `/comments/:id` | Delete comment |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List notifications |
| PUT | `/notifications/:id/read` | Mark as read |
| PUT | `/notifications/read-all` | Mark all as read |
| GET | `/notifications/preferences` | Get preferences |
| PUT | `/notifications/preferences` | Update preferences |

### Webhooks (Premium)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/webhooks` | List webhooks |
| POST | `/webhooks` | Create webhook |
| PUT | `/webhooks/:id` | Update webhook |
| DELETE | `/webhooks/:id` | Delete webhook |
| GET | `/webhooks/:id/deliveries` | List delivery logs |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List all users |
| PUT | `/admin/users/:id/role` | Change user role |
| DELETE | `/admin/users/:id` | Delete user |
| GET | `/admin/stats` | Platform statistics |
| GET | `/admin/health` | System health check |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | System health (DB, Redis, Gemini config) |

Full interactive API documentation is available at `/api/docs` (Swagger UI) when the backend is running.

---

## Database Schema

The database uses PostgreSQL with Prisma ORM. Key models:

| Model | Description |
|-------|-------------|
| `User` | Account info, role, credentials, subscription, notification preferences |
| `Review` | Code review submission with language, status, score |
| `Issue` | Individual issue found during review (category, severity, line, suggestion) |
| `CodeSnippet` | Saved code snippets with version history |
| `SnippetVersion` | Versioned snapshot of a snippet |
| `Collection` | Group of reviews/snippets with share support |
| `CollectionItem` | Join table between collection and reviews/snippets |
| `Team` | Team with owner |
| `TeamMember` | User membership in a team |
| `TeamInvite` | Pending team invitations by email |
| `Comment` | Threaded comments on reviews |
| `Notification` | In-app notifications for events |
| `Webhook` | Registered webhook endpoints |
| `WebhookDelivery` | Delivery attempt logs |

---

## Testing

### Frontend

```bash
cd lintwise

# Run checks
npm run lint          # ESLint
npm run typecheck     # TypeScript type checking (tsc -b)
npm run build         # Full build check
```

### Backend (see [lintwise-server](https://github.com/srniloy/lintwise-server))

```bash
cd lintwise-server

npm run test            # Unit tests (Jest)
npm run test:e2e        # E2E tests (Jest + Supertest)
npm run test:cov        # Coverage report (target: 80%)
```

---

## Deployment

### AWS Infrastructure

The application is deployed on AWS using the following services:

**Frontend (this repo)**
| Service | Purpose |
|---------|---------|
| S3 | Static hosting of the built frontend assets |
| CloudFront | CDN with global edge caching and HTTPS termination |
| AWS Certificate Manager | SSL/TLS certificate for custom domain |
| CodeBuild | Build and lint the frontend on every push |
| CodePipeline | CI/CD pipeline automating build → test → deploy |

**Backend ([lintwise-server](https://github.com/srniloy/lintwise-server))**
| Service | Purpose |
|---------|---------|
| EC2 | Virtual machine running the NestJS API server |
| PM2 | Process manager for Node.js (auto-restart, clustering, zero-downtime reload) |
| Nginx | Reverse proxy, SSL termination, static file serving, load balancing |
| CodeBuild | Build and test the backend on every push |
| CodePipeline | CI/CD pipeline automating build → test → deploy |

### Deployment Architecture

```
                    GitHub (Source Code)
                           │ push
                           ▼
              AWS CodePipeline + CodeBuild
              lint → test:e2e → build
                           │
          ┌────────────────┼────────────────┐
          ▼                                  ▼
┌─────────────────────┐        ┌──────────────────────────┐
│  S3 Bucket          │        │  EC2 Instance             │
│  (Static Hosting)   │        │  Amazon Linux 2           │
│  dist/              │        │  Security Group :443      │
│  index.html         │        │  Nginx → PM2 :3000       │
└────────┬────────────┘        │  Node.js (NestJS)         │
         │                     └──────────────────────────┘
         │                               │
         ▼                               │
┌─────────────────┐                      │
│  CloudFront CDN │                      │
│  (SSL via ACM)  │                      │
│  Behaviors:     │                      │
│    /api/* → EC2 │                      │
│    /*     → S3  │                      │
└─────────────────┘                      │
         │                               │
         └───────────────┬───────────────┘
                         ▼
               ┌──────────────────┐
               │  Route 53 (DNS)  │
               │  lintwise.dev    │
               └──────────────────┘

         ┌─────────────┐  ┌─────────────┐  ┌──────────┐
         │  RDS/Aurora │  │  ElastiCache│  │ Stripe   │
         │ PostgreSQL  │  │  Redis      │  │ API      │
         └─────────────┘  └─────────────┘  └──────────┘
```

### Docker Compose (Local Development)

```bash
docker-compose up --build -d
```

### Environment Variables

Key variables required in the backend `.env` file:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `GEMINI_API_KEY` | Google Gemini API key |
| `MAIL_HOST` / `MAIL_USER` / `MAIL_PASS` | SMTP credentials |
| `STRIPE_SECRET_KEY` | Stripe secret key (for subscriptions) |
| `FRONTEND_URL` | Frontend URL for CORS and email links |

### Performance Targets

| Metric | Target |
|--------|--------|
| GET response time (p95) | < 200ms |
| POST response time (p95) | < 500ms |
| Review processing (avg) | < 30s |
| Uptime SLA | 99.9% |
| Concurrent users | 1,000+ |
| Daily reviews | 10,000+ |
| Test coverage | 80% minimum |

---

## User Roles

| Role | Features |
|------|----------|
| **USER** | Code reviews, export (JSON/MD/CSV/PDF), snippets, collections, basic analytics |
| **PREMIUM** | All USER features + team collaboration, comments, webhooks, advanced analytics, priority support |
| **ADMIN** | All PREMIUM features + user management, role assignments, platform stats, system health monitoring |

---

## Security

- Passwords hashed with bcrypt (12 salt rounds)
- JWT access tokens (7d) + refresh tokens (30d)
- Redis-backed token revocation on logout
- Account lockout after 5 failed login attempts (15 min)
- Rate limiting (100 req / 15 min general; 10 req / 15 min auth)
- Helmet security headers
- Input validation via class-validator + Joi schemas
- Role-based access control at route and component level
- Email verification required for account activation

---

## License

Private / UNLICENSED — All rights reserved.
