# LintWise Backend — Step-by-Step Build Plan

**Stack:** NestJS 11, TypeScript, Prisma ORM, PostgreSQL, Redis, JWT, Gemini API  
**Testing:** Jest + @nestjs/testing + Supertest (unit + e2e after every step)  
**Source:** LintWise-Requirements-Summary.md + LintWiseTest.md  
**Rule:** Complete one step, run tests, confirm passing — then move to the next.

---

## API Prefix Convention
All routes: `GET /api/v1/...`  
All responses wrap in: `{ status: 'success'|'error', data?, message?, errors? }`

---

## PHASE 1 — Foundation & Infrastructure

### Step 1: Project Bootstrap & Global Configuration
**Goal:** Turn the bare NestJS scaffold into a production-ready base.

**Install packages:**
```bash
npm install @nestjs/config @nestjs/swagger swagger-ui-express helmet class-validator class-transformer
npm install joi   # env validation
```

**What to build:**
- `src/config/env.validation.ts` — Joi schema validating all required env vars (`DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `CLAUDE_API_KEY`, `PORT`, `NODE_ENV`, `FRONTEND_URL`)
- `src/config/configuration.ts` — typed config factory
- Update `AppModule` to import `ConfigModule.forRoot({ validate, isGlobal: true })`
- Update `main.ts`:
  - Global prefix `api/v1`
  - `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`
  - Helmet security headers
  - CORS (`origin: FRONTEND_URL`)
  - Swagger (`/api/docs`)
  - Graceful shutdown hooks
- Create `.env.example` with all required variables

**Tests to write & run:**
```
src/app.controller.spec.ts  ← already exists, update to test /api/v1
test/app.e2e-spec.ts        ← test: GET /api/v1 returns 200, /api/docs returns 200
                               test: invalid routes return 404
                               test: CORS headers present
```
```bash
npm run test          # unit
npm run test:e2e      # e2e
```

---

### Step 2: Database Setup — Prisma + Full Schema

**Install packages:**
```bash
npm install prisma @prisma/client
npx prisma init
```

**What to build:**
- Full `prisma/schema.prisma` with all models:

```prisma
model User {
  id                  String    @id @default(cuid())
  name                String
  email               String    @unique
  password            String
  role                Role      @default(USER)
  isVerified          Boolean   @default(false)
  verificationToken   String?
  verificationExpiry  DateTime?
  resetToken          String?
  resetTokenExpiry    DateTime?
  failedLoginAttempts Int       @default(0)
  lockedUntil         DateTime?
  avatarUrl           String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  reviews             Review[]
  snippets            CodeSnippet[]
  collections         Collection[]
  ownedTeams          Team[]    @relation("TeamOwner")
  teamMemberships     TeamMember[]
  comments            Comment[]
  notifications       Notification[]
  webhooks            Webhook[]
}

model Review {
  id           String      @id @default(cuid())
  userId       String
  user         User        @relation(fields: [userId], references: [id])
  title        String?
  language     String
  code         String      @db.Text
  status       ReviewStatus @default(PENDING)
  overallScore Int?
  summary      String?     @db.Text
  issues       Issue[]
  comments     Comment[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

model Issue {
  id          String        @id @default(cuid())
  reviewId    String
  review      Review        @relation(fields: [reviewId], references: [id])
  category    IssueCategory
  severity    IssueSeverity
  title       String
  description String        @db.Text
  suggestion  String?       @db.Text
  lineStart   Int?
  lineEnd     Int?
  fileName    String?
  createdAt   DateTime      @default(now())
}

model CodeSnippet {
  id        String           @id @default(cuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id])
  title     String
  language  String
  code      String           @db.Text
  versions  SnippetVersion[]
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt
}

model SnippetVersion {
  id        String      @id @default(cuid())
  snippetId String
  snippet   CodeSnippet @relation(fields: [snippetId], references: [id])
  code      String      @db.Text
  createdAt DateTime    @default(now())
}

model Collection {
  id          String           @id @default(cuid())
  userId      String
  user        User             @relation(fields: [userId], references: [id])
  name        String
  description String?
  isPublic    Boolean          @default(false)
  shareToken  String?          @unique
  items       CollectionItem[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}

model CollectionItem {
  id           String     @id @default(cuid())
  collectionId String
  collection   Collection @relation(fields: [collectionId], references: [id])
  reviewId     String?
  snippetId    String?
  addedAt      DateTime   @default(now())
}

model Team {
  id        String       @id @default(cuid())
  name      String
  ownerId   String
  owner     User         @relation("TeamOwner", fields: [ownerId], references: [id])
  members   TeamMember[]
  invites   TeamInvite[]
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
}

model TeamMember {
  id       String     @id @default(cuid())
  teamId   String
  team     Team       @relation(fields: [teamId], references: [id])
  userId   String
  user     User       @relation(fields: [userId], references: [id])
  role     TeamRole   @default(MEMBER)
  joinedAt DateTime   @default(now())

  @@unique([teamId, userId])
}

model TeamInvite {
  id        String   @id @default(cuid())
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id])
  email     String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Comment {
  id        String   @id @default(cuid())
  reviewId  String
  review    Review   @relation(fields: [reviewId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  content   String   @db.Text
  parentId  String?
  parent    Comment? @relation("CommentReplies", fields: [parentId], references: [id])
  replies   Comment[] @relation("CommentReplies")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Notification {
  id        String           @id @default(cuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id])
  type      NotificationType
  title     String
  message   String
  data      Json?
  isRead    Boolean          @default(false)
  createdAt DateTime         @default(now())
}

model Webhook {
  id        String            @id @default(cuid())
  userId    String
  user      User              @relation(fields: [userId], references: [id])
  url       String
  events    WebhookEvent[]
  secret    String
  isActive  Boolean           @default(true)
  deliveries WebhookDelivery[]
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt
}

model WebhookDelivery {
  id         String   @id @default(cuid())
  webhookId  String
  webhook    Webhook  @relation(fields: [webhookId], references: [id])
  event      WebhookEvent
  payload    Json
  statusCode Int?
  attempts   Int      @default(0)
  deliveredAt DateTime?
  createdAt  DateTime @default(now())
}

enum Role              { USER PREMIUM ADMIN }
enum ReviewStatus      { PENDING PROCESSING COMPLETED FAILED }
enum IssueCategory     { SECURITY PERFORMANCE QUALITY STYLE DOCUMENTATION TESTING DEPENDENCIES }
enum IssueSeverity     { CRITICAL HIGH MEDIUM LOW }
enum TeamRole          { OWNER MEMBER }
enum NotificationType  { REVIEW_COMPLETED REVIEW_FAILED CRITICAL_ISSUE MENTION COMMENT_REPLY TEAM_INVITE }
enum WebhookEvent      { REVIEW_COMPLETED REVIEW_FAILED CRITICAL_ISSUE_FOUND }
```

- `src/prisma/prisma.service.ts` — injectable PrismaClient with `onModuleInit` / `enableShutdownHooks`
- `src/prisma/prisma.module.ts` — global module exporting PrismaService
- First migration: `npx prisma migrate dev --name init`
- Database seed file: `prisma/seed.ts` — creates 1 ADMIN + 1 PREMIUM + 1 USER for development

**Tests to write & run:**
```
src/prisma/prisma.service.spec.ts
  ← test: PrismaService connects on init
  ← test: PrismaService disconnects on destroy
```
```bash
npm run test
```

---

### Step 3: Redis / Cache Module

**Install packages:**
```bash
npm install @nestjs/cache-manager cache-manager ioredis cache-manager-ioredis-yet
```

**What to build:**
- `src/cache/cache.module.ts` — global CacheModule wired to Redis via ioredis
- `src/cache/cache.service.ts` — typed wrapper: `get<T>`, `set<T>`, `del`, `reset`
- TTL constants: sessions 7d, review results 30d, queries 5min

**Tests to write & run:**
```
src/cache/cache.service.spec.ts
  ← test: set() stores value
  ← test: get() retrieves stored value
  ← test: get() returns null for missing key
  ← test: del() removes key
  ← test: TTL expiry (use fake timers)
```
```bash
npm run test
```

---

### Step 4: Common Module — Guards, Decorators, Interceptors, Filters

**What to build:**
- `src/common/guards/jwt-auth.guard.ts` — extends `AuthGuard('jwt')`, checks `@Public()` decorator
- `src/common/guards/roles.guard.ts` — checks `@Roles(...roles)` decorator against `req.user.role`
- `src/common/decorators/public.decorator.ts` — `@Public()` skips JWT guard
- `src/common/decorators/roles.decorator.ts` — `@Roles('ADMIN')`, `@Roles('PREMIUM','ADMIN')`
- `src/common/decorators/current-user.decorator.ts` — `@CurrentUser()` extracts user from request
- `src/common/interceptors/response.interceptor.ts` — wraps all responses in `{ status:'success', data }`
- `src/common/interceptors/logging.interceptor.ts` — logs method, url, status, duration
- `src/common/filters/http-exception.filter.ts` — catches all HttpExceptions, returns `{ status:'error', message, errors? }`
- `src/common/filters/prisma-exception.filter.ts` — maps Prisma errors (P2002 unique → 409, P2025 not found → 404)
- `src/common/dto/pagination.dto.ts` — `page`, `limit`, `sortBy`, `sortOrder`
- Register interceptors and filters globally in `AppModule`

**Tests to write & run:**
```
src/common/guards/jwt-auth.guard.spec.ts
  ← test: blocks unauthenticated requests
  ← test: allows @Public() routes through without token

src/common/guards/roles.guard.spec.ts
  ← test: ADMIN can access ADMIN route
  ← test: USER cannot access ADMIN route → 403
  ← test: PREMIUM can access PREMIUM route

src/common/filters/http-exception.filter.spec.ts
  ← test: 404 returns { status:'error', message }
  ← test: 400 returns { status:'error', errors }

src/common/interceptors/response.interceptor.spec.ts
  ← test: wraps plain response in { status:'success', data }
```
```bash
npm run test
```

---

## PHASE 2 — Authentication & User Management (FR1)

### Step 5: Auth Module — Registration & Login

**Install packages:**
```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt passport-local bcrypt
npm install -D @types/passport-jwt @types/passport-local @types/bcrypt
```

**What to build:**
- `src/auth/auth.module.ts`
- `src/auth/auth.service.ts`:
  - `register(dto)` — hash password (bcrypt, 10 rounds), create user, send verification email, return tokens
  - `login(dto)` — find user, verify password, check `isVerified`, check lockout, reset fail count on success, generate tokens
  - `logout(userId)` — invalidate refresh token in Redis
  - `refreshTokens(refreshToken)` — verify refresh token, issue new pair
  - `generateTokens(user)` — access token (7d), refresh token (30d)
- `src/auth/auth.controller.ts`:
  - `POST /auth/register` — 201
  - `POST /auth/login` — 200
  - `POST /auth/logout` — 204 (JWT required)
  - `POST /auth/refresh` — 200
- `src/auth/strategies/jwt.strategy.ts` — validates bearer token, attaches user to request
- `src/auth/strategies/local.strategy.ts` — passport local strategy
- `src/auth/dto/register.dto.ts` — name, email, password (with class-validator: regex for password strength)
- `src/auth/dto/login.dto.ts` — email, password
- `src/auth/dto/refresh-token.dto.ts`

**Tests to write & run:**
```
src/auth/auth.service.spec.ts
  ← test: register() hashes password (bcrypt compare)
  ← test: register() throws 409 on duplicate email
  ← test: login() returns tokens for valid credentials
  ← test: login() throws 401 for wrong password
  ← test: login() throws 401 for unverified account
  ← test: login() increments failedLoginAttempts
  ← test: login() locks account after 5 failures (30 min)
  ← test: login() throws 423 for locked account
  ← test: generateTokens() returns valid JWT pair

src/auth/auth.controller.spec.ts
  ← test: POST /register returns 201 with user + tokens
  ← test: POST /login returns 200 with tokens
  ← test: POST /logout returns 204

test/auth.e2e-spec.ts (Supertest)
  ← POST /api/v1/auth/register → 201
  ← POST /api/v1/auth/register duplicate email → 409
  ← POST /api/v1/auth/login valid → 200 with accessToken
  ← POST /api/v1/auth/login wrong password → 401
  ← POST /api/v1/auth/refresh valid → 200 with new tokens
  ← POST /api/v1/auth/logout valid token → 204
  ← POST /api/v1/auth/logout no token → 401
```
```bash
npm run test && npm run test:e2e
```

---

### Step 6: Email Verification (FR1.1)

**Install packages:**
```bash
npm install @nestjs-modules/mailer nodemailer handlebars
npm install -D @types/nodemailer
```

**What to build:**
- `src/mail/mail.module.ts` — MailerModule with Handlebars templates
- `src/mail/mail.service.ts` — `sendVerificationEmail()`, `sendPasswordResetEmail()`, `sendReviewCompleteEmail()`
- `src/mail/templates/` — Handlebars email templates (verification, reset, review-complete)
- `src/auth/auth.service.ts` (update):
  - `verifyEmail(token)` — find token, check 24h expiry, mark `isVerified = true`, clear token
  - `resendVerification(email)` — generate new token, resend email
- `src/auth/auth.controller.ts` (update):
  - `GET /auth/verify-email?token=...` — `@Public()`
  - `POST /auth/resend-verification` — `@Public()`

**Tests to write & run:**
```
src/mail/mail.service.spec.ts
  ← test: sendVerificationEmail() calls mailer with correct template
  ← test: sendPasswordResetEmail() calls mailer with reset link

src/auth/auth.service.spec.ts (add cases)
  ← test: verifyEmail() sets isVerified = true for valid token
  ← test: verifyEmail() throws 400 for expired token (>24h)
  ← test: verifyEmail() throws 404 for unknown token
  ← test: resendVerification() generates new token and sends email

test/auth.e2e-spec.ts (add cases)
  ← GET /api/v1/auth/verify-email?token=valid → 200
  ← GET /api/v1/auth/verify-email?token=expired → 400
  ← POST /api/v1/auth/resend-verification → 200
```
```bash
npm run test && npm run test:e2e
```

---

### Step 7: Password Reset (FR1.3)

**What to build:**
- `src/auth/auth.service.ts` (update):
  - `forgotPassword(email)` — generate reset token (UUID), hash + store, send email, expire in 1h
  - `resetPassword(token, newPassword)` — verify token, check expiry, hash new password, clear token
- `src/auth/auth.controller.ts` (update):
  - `POST /auth/forgot-password` — `@Public()`
  - `POST /auth/reset-password` — `@Public()`
- `src/auth/dto/forgot-password.dto.ts` — email
- `src/auth/dto/reset-password.dto.ts` — token, password

**Tests to write & run:**
```
src/auth/auth.service.spec.ts (add cases)
  ← test: forgotPassword() stores hashed token in DB
  ← test: forgotPassword() sends reset email
  ← test: forgotPassword() returns generic success even if email not found (security)
  ← test: resetPassword() updates password and clears token
  ← test: resetPassword() throws 400 for expired token (>1h)
  ← test: resetPassword() throws 400 for invalid token

test/auth.e2e-spec.ts (add cases)
  ← POST /api/v1/auth/forgot-password → 200 (any email)
  ← POST /api/v1/auth/reset-password valid token → 200
  ← POST /api/v1/auth/reset-password expired → 400
  ← POST /api/v1/auth/reset-password bad token → 400
```
```bash
npm run test && npm run test:e2e
```

---

### Step 8: Profile Management & Rate Limiting (FR1.4)

**Install packages:**
```bash
npm install @nestjs/throttler
```

**What to build:**
- `src/users/users.module.ts`
- `src/users/users.service.ts`:
  - `getProfile(userId)` — returns user (exclude password)
  - `updateProfile(userId, dto)` — name, avatarUrl
  - `changePassword(userId, dto)` — verify current, hash new
  - `deleteAccount(userId, password)` — verify password, soft delete or hard delete
- `src/users/users.controller.ts`:
  - `GET  /users/profile` — JWT required
  - `PUT  /users/profile` — JWT required
  - `PUT  /users/change-password` — JWT required
  - `DELETE /users/account` — JWT required
- `src/users/dto/` — update-profile.dto, change-password.dto, delete-account.dto
- Global `ThrottlerModule` setup in `AppModule`:
  - Default: 100 req / 15 min per IP
  - Auth routes: 10 req / 15 min (stricter — use `@Throttle`)

**Tests to write & run:**
```
src/users/users.service.spec.ts
  ← test: getProfile() returns user without password
  ← test: updateProfile() updates name and avatarUrl
  ← test: changePassword() hashes new password
  ← test: changePassword() throws 401 for wrong current password
  ← test: deleteAccount() throws 401 for wrong password

test/users.e2e-spec.ts (Supertest)
  ← GET  /api/v1/users/profile no token → 401
  ← GET  /api/v1/users/profile valid → 200 with user (no password field)
  ← PUT  /api/v1/users/profile → 200 updated
  ← PUT  /api/v1/users/change-password wrong current → 401
  ← PUT  /api/v1/users/change-password valid → 200
  ← DELETE /api/v1/users/account valid → 204
```
```bash
npm run test && npm run test:e2e
```

---

## PHASE 3 — Core Code Review (FR2) — CRITICAL

### Step 9: Gemini AI Service

**Install packages:**
```bash
npm install @google/genai
```

**What to build:**
- `src/gemini/gemini.module.ts`
- `src/gemini/gemini.service.ts`:
- `src/gemini/gemini.module.ts`
- `src/gemini/gemini.service.ts`:
  - `analyzeCode(code, language, title?)` → structured review result
  - Build system prompt: instructs Gemini to return JSON with `{ overallScore, summary, issues[] }`
  - Build system prompt: instructs Gemini to return JSON with `{ overallScore, summary, issues[] }`
  - Each issue: `{ category, severity, title, description, suggestion, lineStart, lineEnd, fileName }`
  - Use prompt caching (`cache_control`) for the system prompt
  - Handle Gemini API errors gracefully (rate limit, timeout, network)
  - Handle Gemini API errors gracefully (rate limit, timeout, network)
  - Retry logic: 3 attempts with exponential backoff
- `src/gemini/gemini.types.ts` — typed interfaces for the Gemini response
- `src/gemini/gemini.types.ts` — typed interfaces for the Gemini response

**Tests to write & run:**
```
src/gemini/gemini.service.spec.ts
  ← test: analyzeCode() calls Gemini SDK with correct model + prompt
src/gemini/gemini.service.spec.ts
  ← test: analyzeCode() calls @google/genai SDK with correct model + prompt
  ← test: analyzeCode() parses structured JSON response correctly
  ← test: analyzeCode() retries on transient error (3x)
  ← test: analyzeCode() throws ServiceUnavailableException after 3 failures
  ← test: analyzeCode() uses prompt caching header
  (mock Gemini SDK — do NOT call real API in tests)
  (mock @google/genai SDK — do NOT call real API in tests)
```
```bash
npm run test
```

---

### Step 10: Reviews Module — Submit & Process (FR2.1 + FR2.2)

**What to build:**
- `src/reviews/reviews.module.ts`
- `src/reviews/reviews.service.ts`:
  - `create(userId, dto)` — validate code size (<50,000 chars, <10,000 lines), create Review (PENDING), trigger async processing
  - `processReview(reviewId)` — set PROCESSING, call GeminiService, parse + save Issues, set COMPLETED; on error → FAILED
  - `processReview(reviewId)` — set PROCESSING, call GeminiService, parse + save Issues, set COMPLETED; on error → FAILED
  - `findOne(reviewId, userId)` — verify ownership
  - `getStatus(reviewId, userId)` — returns `{ id, status, createdAt }`
- `src/reviews/reviews.controller.ts`:
  - `POST /reviews` — 201, fires processing in background
  - `GET  /reviews/:id/status` — 200
- `src/reviews/dto/create-review.dto.ts` — title?, language (enum), code (max length validation), files?
- Multi-file upload: `POST /reviews` also accepts `multipart/form-data` with up to 5 files (10MB total)

**Tests to write & run:**
```
src/reviews/reviews.service.spec.ts
  ← test: create() creates Review with PENDING status
  ← test: create() throws 400 if code > 50,000 chars
  ← test: create() throws 400 if > 5 files
  ← test: processReview() sets status PROCESSING then COMPLETED
  ← test: processReview() saves Issues from Gemini response
  ← test: processReview() sets FAILED if Gemini throws
  ← test: processReview() saves Issues from Gemini response
  ← test: processReview() sets FAILED if Gemini throws

test/reviews.e2e-spec.ts (Supertest)
  ← POST /api/v1/reviews no token → 401
  ← POST /api/v1/reviews valid → 201 with id + PENDING status
  ← POST /api/v1/reviews code too long → 400
  ← GET  /api/v1/reviews/:id/status → 200 with status
  ← GET  /api/v1/reviews/:id/status other user's review → 403
```
```bash
npm run test && npm run test:e2e
```

---

### Step 11: Review Results & Issue Management (FR2.3 + FR2.4)

**What to build:**
- `src/reviews/reviews.service.ts` (update):
  - `findAllByUser(userId, paginationDto, filters)` — paginated list with filters (status, language, dateRange)
  - `getFullResult(reviewId, userId)` — review + all issues + summary
  - `delete(reviewId, userId)` — verify ownership
- `src/reviews/reviews.controller.ts` (update):
  - `GET  /reviews` — paginated list with query filters
  - `GET  /reviews/:id` — full result with issues
  - `DELETE /reviews/:id` — 204
- `src/reviews/dto/review-filter.dto.ts` — status?, language?, startDate?, endDate?
- Cache review results in Redis (30-day TTL); invalidate on delete
- Issue response: group issues by category, include count per category + per severity

**Tests to write & run:**
```
src/reviews/reviews.service.spec.ts (add cases)
  ← test: findAllByUser() returns paginated reviews for user
  ← test: findAllByUser() filters by status
  ← test: findAllByUser() filters by date range
  ← test: getFullResult() returns review with grouped issues
  ← test: getFullResult() returns cached result on second call
  ← test: delete() removes review and invalidates cache

test/reviews.e2e-spec.ts (add cases)
  ← GET /api/v1/reviews → 200 paginated list
  ← GET /api/v1/reviews?status=COMPLETED → filtered
  ← GET /api/v1/reviews/:id → 200 full result with issues[]
  ← GET /api/v1/reviews/:id other user → 403
  ← DELETE /api/v1/reviews/:id → 204
  ← DELETE /api/v1/reviews/:id already deleted → 404
```
```bash
npm run test && npm run test:e2e
```

---

### Step 12: Review Export (FR5.1)

**Install packages:**
```bash
npm install pdfkit json2csv
npm install -D @types/pdfkit
```

**What to build:**
- `src/reviews/export/export.service.ts`:
  - `exportAsPdf(review, issues)` → `Buffer`
  - `exportAsJson(review, issues)` → JSON string
  - `exportAsMarkdown(review, issues)` → Markdown string
  - `exportAsCsv(issues)` → CSV string (using json2csv)
- `src/reviews/reviews.controller.ts` (update):
  - `GET /reviews/:id/export?format=pdf|json|markdown|csv`
  - Sets correct `Content-Type` and `Content-Disposition` headers

**Tests to write & run:**
```
src/reviews/export/export.service.spec.ts
  ← test: exportAsJson() returns valid JSON with all fields
  ← test: exportAsMarkdown() returns string containing issue titles
  ← test: exportAsCsv() returns comma-separated lines
  ← test: exportAsPdf() returns a Buffer (truthy, non-empty)

test/reviews.e2e-spec.ts (add cases)
  ← GET /api/v1/reviews/:id/export?format=json → 200 application/json
  ← GET /api/v1/reviews/:id/export?format=markdown → 200 text/markdown
  ← GET /api/v1/reviews/:id/export?format=csv → 200 text/csv
  ← GET /api/v1/reviews/:id/export?format=pdf → 200 application/pdf
  ← GET /api/v1/reviews/:id/export?format=invalid → 400
  ← GET /api/v1/reviews/:id/export no token → 401
```
```bash
npm run test && npm run test:e2e
```

---

## PHASE 4 — Code Management (FR3)

### Step 13: Code Snippets (FR3.1)

**What to build:**
- `src/snippets/snippets.module.ts`
- `src/snippets/snippets.service.ts`:
  - `create(userId, dto)` — creates snippet + first SnippetVersion
  - `findAll(userId)` — list user's snippets
  - `findOne(id, userId)` — with latest code
  - `update(id, userId, dto)` — creates new SnippetVersion, updates snippet
  - `getVersionHistory(id, userId)` — list all SnippetVersions
  - `delete(id, userId)` — cascade deletes versions
- `src/snippets/snippets.controller.ts`:
  - `POST   /snippets`
  - `GET    /snippets`
  - `GET    /snippets/:id`
  - `PUT    /snippets/:id`
  - `DELETE /snippets/:id`
  - `GET    /snippets/:id/versions`

**Tests to write & run:**
```
src/snippets/snippets.service.spec.ts
  ← test: create() creates snippet + version 1
  ← test: update() creates new version (keeps old ones)
  ← test: getVersionHistory() returns versions in desc order
  ← test: delete() throws 403 for wrong owner

test/snippets.e2e-spec.ts
  ← POST /api/v1/snippets → 201
  ← GET  /api/v1/snippets → 200 list
  ← GET  /api/v1/snippets/:id → 200
  ← PUT  /api/v1/snippets/:id → 200 updated, version incremented
  ← GET  /api/v1/snippets/:id/versions → 200 list of versions
  ← DELETE /api/v1/snippets/:id → 204
  ← GET  /api/v1/snippets/:id after delete → 404
```
```bash
npm run test && npm run test:e2e
```

---

### Step 14: Collections & Favorites (FR3.2)

**What to build:**
- `src/collections/collections.module.ts`
- `src/collections/collections.service.ts`:
  - `create / findAll / findOne / update / delete`
  - `addItem(collectionId, userId, dto)` — reviewId? | snippetId?
  - `removeItem(collectionId, itemId, userId)`
  - `generateShareLink(collectionId, userId)` — create unique shareToken, mark isPublic = true
  - `findByShareToken(token)` — public access (no auth required)
- `src/collections/collections.controller.ts`:
  - `POST   /collections`
  - `GET    /collections`
  - `GET    /collections/:id`
  - `PUT    /collections/:id`
  - `DELETE /collections/:id`
  - `POST   /collections/:id/items`
  - `DELETE /collections/:id/items/:itemId`
  - `POST   /collections/:id/share`
  - `GET    /collections/shared/:token` — `@Public()`

**Tests to write & run:**
```
src/collections/collections.service.spec.ts
  ← test: create() creates collection owned by user
  ← test: addItem() with reviewId links review
  ← test: addItem() throws 400 if both reviewId + snippetId null
  ← test: generateShareLink() sets isPublic = true and returns URL
  ← test: findByShareToken() returns collection without auth

test/collections.e2e-spec.ts
  ← POST /api/v1/collections → 201
  ← POST /api/v1/collections/:id/items → 201
  ← DELETE /api/v1/collections/:id/items/:itemId → 204
  ← POST /api/v1/collections/:id/share → 200 with shareUrl
  ← GET /api/v1/collections/shared/:token → 200 (no auth)
```
```bash
npm run test && npm run test:e2e
```

---

## PHASE 5 — Analytics (FR5.2)

### Step 15: Analytics Endpoints

**What to build:**
- `src/analytics/analytics.module.ts`
- `src/analytics/analytics.service.ts`:
  - `getPersonalStats(userId, range)`:
    - Total reviews, this-month reviews
    - Issues by category (counts)
    - Issues by severity (counts)
    - Quality score trend over time (array of { date, score })
    - Languages used (array of { language, count })
  - `getTeamStats(teamId, userId, range)` — PREMIUM guard
- `src/analytics/analytics.controller.ts`:
  - `GET /analytics/personal?range=7d|30d|90d`
  - `GET /analytics/team?range=7d|30d|90d` — `@Roles('PREMIUM','ADMIN')`
- Cache analytics responses in Redis (5 min TTL), key includes userId + range

**Tests to write & run:**
```
src/analytics/analytics.service.spec.ts
  ← test: getPersonalStats() returns correct review totals
  ← test: getPersonalStats() groups issues by category correctly
  ← test: getPersonalStats() respects date range filter
  ← test: getPersonalStats() returns cached result on second call

test/analytics.e2e-spec.ts
  ← GET /api/v1/analytics/personal?range=30d → 200 with stats
  ← GET /api/v1/analytics/personal no token → 401
  ← GET /api/v1/analytics/team USER role → 403
  ← GET /api/v1/analytics/team PREMIUM role → 200
```
```bash
npm run test && npm run test:e2e
```

---

## PHASE 6 — Notifications (FR7)

### Step 16: In-App Notifications (FR7.2)

**What to build:**
- `src/notifications/notifications.module.ts`
- `src/notifications/notifications.service.ts`:
  - `create(userId, type, title, message, data?)` — internal method called by other services
  - `findAll(userId)` — list with unread count
  - `markAsRead(notificationId, userId)`
  - `markAllAsRead(userId)`
- `src/notifications/notifications.controller.ts`:
  - `GET  /notifications`
  - `PUT  /notifications/:id/read`
  - `PUT  /notifications/read-all`
- Wire: call `notificationsService.create()` from:
  - ReviewsService → `REVIEW_COMPLETED`, `REVIEW_FAILED`, `CRITICAL_ISSUE`
  - CommentsService → `MENTION`, `COMMENT_REPLY` (Step 17)

**Tests to write & run:**
```
src/notifications/notifications.service.spec.ts
  ← test: create() inserts notification for user
  ← test: findAll() returns notifications with unreadCount
  ← test: markAsRead() sets isRead = true
  ← test: markAllAsRead() sets all isRead = true for user

test/notifications.e2e-spec.ts
  ← GET /api/v1/notifications → 200 list
  ← GET /api/v1/notifications no token → 401
  ← PUT /api/v1/notifications/:id/read → 200
  ← PUT /api/v1/notifications/read-all → 200
  ← PUT /api/v1/notifications/:id/read other user's notification → 403
```
```bash
npm run test && npm run test:e2e
```

---

### Step 17: Email Notifications (FR7.1)

**What to build:**
- Extend `MailService` with notification emails (already bootstrapped in Step 6):
  - `sendReviewCompleteEmail(user, review)` — called when review COMPLETED
  - `sendCriticalIssueEmail(user, review, issues)` — called when CRITICAL issues found
  - `sendMentionEmail(mentionedUser, commenter, review)` — Step 18
- `src/users/notification-preferences/` — user toggles per notification type (store in DB as JSON on User model or separate table)
- Check user notification preferences before sending any email
- Unsubscribe token in emails → `GET /notifications/unsubscribe?token=`

**Tests to write & run:**
```
src/mail/mail.service.spec.ts (add cases)
  ← test: sendReviewCompleteEmail() sends with correct subject
  ← test: sendCriticalIssueEmail() includes issue count in body
  ← test: does NOT send if user has disabled that notification type

test/notifications.e2e-spec.ts (add cases)
  ← GET /api/v1/notifications/unsubscribe?token=valid → 200
  ← GET /api/v1/notifications/unsubscribe?token=invalid → 400
```
```bash
npm run test && npm run test:e2e
```

---

## PHASE 7 — Team Collaboration (FR4) — Premium

### Step 18: Team Management (FR4.1)

**What to build:**
- `src/teams/teams.module.ts`
- `src/teams/teams.service.ts`:
  - `create(userId, dto)` — create team, add creator as OWNER TeamMember
  - `getCurrentTeam(userId)` — get user's team with members list
  - `inviteMember(teamId, ownerId, email)` — generate invite token (UUID), send invite email (24h expiry), max 50 members
  - `acceptInvite(token, userId)` — validate token, add user as MEMBER
  - `removeMember(teamId, ownerId, memberId)` — OWNER only
  - `updateMemberRole(teamId, ownerId, memberId, role)` — OWNER only
  - `transferOwnership(teamId, currentOwnerId, newOwnerId)` — OWNER only
- `src/teams/teams.controller.ts`:
  - All routes behind `@Roles('PREMIUM','ADMIN')`
  - `POST   /teams`
  - `GET    /teams/current`
  - `POST   /teams/:id/invite`
  - `GET    /teams/invite/accept?token=` — `@Public()`
  - `DELETE /teams/:id/members/:userId`
  - `PUT    /teams/:id/members/:userId/role`
  - `PUT    /teams/:id/transfer-ownership`

**Tests to write & run:**
```
src/teams/teams.service.spec.ts
  ← test: create() adds owner as TeamMember with role OWNER
  ← test: inviteMember() throws 403 if caller is not OWNER
  ← test: inviteMember() throws 400 if team has 50 members
  ← test: acceptInvite() throws 400 for expired token
  ← test: removeMember() throws 400 if trying to remove owner
  ← test: transferOwnership() swaps roles correctly

test/teams.e2e-spec.ts
  ← POST /api/v1/teams USER role → 403
  ← POST /api/v1/teams PREMIUM role → 201
  ← GET  /api/v1/teams/current → 200 with members[]
  ← POST /api/v1/teams/:id/invite → 201
  ← DELETE /api/v1/teams/:id/members/:userId → 204
```
```bash
npm run test && npm run test:e2e
```

---

### Step 19: Shared Reviews & Comments (FR4.2)

**What to build:**
- `src/comments/comments.module.ts`
- `src/comments/comments.service.ts`:
  - `create(reviewId, userId, dto)` — create comment, parse @mentions, create Notifications + send emails for mentioned users
  - `findAllByReview(reviewId)` — threaded: top-level comments + replies
  - `update(commentId, userId, dto)` — owner only, within edit window
  - `delete(commentId, userId)` — owner or ADMIN
- `src/comments/comments.controller.ts`:
  - `GET    /reviews/:id/comments`
  - `POST   /reviews/:id/comments` — PREMIUM
  - `PUT    /comments/:id`
  - `DELETE /comments/:id`
- `src/comments/dto/create-comment.dto.ts` — content, parentId?

**Tests to write & run:**
```
src/comments/comments.service.spec.ts
  ← test: create() saves comment with correct reviewId + userId
  ← test: create() parses @username mentions and creates Notifications
  ← test: findAllByReview() returns nested replies
  ← test: update() throws 403 for non-owner
  ← test: delete() ADMIN can delete any comment

test/comments.e2e-spec.ts
  ← GET  /api/v1/reviews/:id/comments → 200 threaded
  ← POST /api/v1/reviews/:id/comments USER role → 403
  ← POST /api/v1/reviews/:id/comments PREMIUM → 201
  ← PUT  /api/v1/comments/:id wrong user → 403
  ← DELETE /api/v1/comments/:id owner → 204
```
```bash
npm run test && npm run test:e2e
```

---

## PHASE 8 — Webhooks (FR6.2) — Premium

### Step 20: Webhook System

**What to build:**
- `src/webhooks/webhooks.module.ts`
- `src/webhooks/webhooks.service.ts`:
  - `create(userId, dto)` — generate HMAC secret, validate URL reachability
  - `findAll(userId)` — list user's webhooks
  - `update(id, userId, dto)` — update url/events/isActive
  - `delete(id, userId)`
  - `deliver(webhookId, event, payload)` — sign payload with HMAC-SHA256, POST to webhook URL, store WebhookDelivery, retry 3x
  - `retry(deliveryId, userId)`
- `src/webhooks/webhooks.controller.ts`:
  - All behind `@Roles('PREMIUM','ADMIN')`
  - `POST   /webhooks`
  - `GET    /webhooks`
  - `PUT    /webhooks/:id`
  - `DELETE /webhooks/:id`
  - `POST   /webhooks/:id/deliveries/:deliveryId/retry`
- Wire: call `deliver()` from ReviewsService on COMPLETED/FAILED

**Tests to write & run:**
```
src/webhooks/webhooks.service.spec.ts
  ← test: create() generates HMAC secret
  ← test: deliver() signs payload with correct HMAC header
  ← test: deliver() retries 3 times on failure
  ← test: deliver() stores WebhookDelivery with statusCode

test/webhooks.e2e-spec.ts
  ← POST /api/v1/webhooks USER role → 403
  ← POST /api/v1/webhooks PREMIUM → 201 with secret
  ← PUT  /api/v1/webhooks/:id → 200
  ← DELETE /api/v1/webhooks/:id → 204
```
```bash
npm run test && npm run test:e2e
```

---

## PHASE 9 — Admin Panel (FR1.5)

### Step 21: Admin Endpoints

**What to build:**
- `src/admin/admin.module.ts`
- `src/admin/admin.service.ts`:
  - `getAllUsers(paginationDto, filters)` — search by name/email, filter by role, paginated
  - `updateUserRole(userId, role)` — promote/demote
  - `suspendUser(userId)` — sets `lockedUntil = far future`
  - `unsuspendUser(userId)`
  - `deleteUser(userId)` — hard delete (cascade)
  - `getPlatformStats()` — total users, reviews today, reviews total, active users (last 7d)
- `src/admin/admin.controller.ts`:
  - All behind `@Roles('ADMIN')`
  - `GET    /admin/users`
  - `PUT    /admin/users/:id/role`
  - `PUT    /admin/users/:id/suspend`
  - `PUT    /admin/users/:id/unsuspend`
  - `DELETE /admin/users/:id`
  - `GET    /admin/stats`

**Tests to write & run:**
```
src/admin/admin.service.spec.ts
  ← test: getAllUsers() returns paginated users list
  ← test: getAllUsers() filters by role
  ← test: updateUserRole() cannot demote the last ADMIN
  ← test: suspendUser() sets lockedUntil to future date
  ← test: deleteUser() removes user from DB

test/admin.e2e-spec.ts
  ← GET /api/v1/admin/users non-ADMIN → 403
  ← GET /api/v1/admin/users ADMIN → 200 paginated
  ← PUT /api/v1/admin/users/:id/role ADMIN → 200
  ← PUT /api/v1/admin/users/:id/suspend → 200
  ← DELETE /api/v1/admin/users/:id → 204
  ← GET /api/v1/admin/stats → 200 platform stats
```
```bash
npm run test && npm run test:e2e
```

---

## PHASE 10 — Health & Security Polish

### Step 22: Health Check (FR8.1)

**Install packages:**
```bash
npm install @nestjs/terminus
```

**What to build:**
- `src/health/health.module.ts`
- `src/health/health.controller.ts`:
  - `GET /health` — `@Public()`
  - Checks: PostgreSQL (PrismaHealthIndicator), Redis (custom ping), Gemini API (HTTP ping to Gemini)
  - Returns: `{ status, checks: { db, redis, geminiApi }, uptime, timestamp }`
  - Checks: PostgreSQL (PrismaHealthIndicator), Redis (custom ping), Gemini API (HTTP ping to Google)
  - Returns: `{ status, checks: { db, redis, geminiApi }, uptime, timestamp }`

**Tests to write & run:**
```
src/health/health.controller.spec.ts
  ← test: /health returns 200 when all services up
  ← test: /health returns 503 when DB down
  ← test: /health returns 503 when Redis down

test/health.e2e-spec.ts
  ← GET /api/v1/health → 200 with all checks
  ← GET /api/v1/health requires no auth
```
```bash
npm run test && npm run test:e2e
```

---

### Step 23: Security Hardening & Final Integration

**What to build:**
- Verify all security headers in `main.ts` (Helmet defaults + custom):
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=31536000`
  - `Content-Security-Policy: configured`
- SQL injection: confirm Prisma parameterized queries everywhere (no raw SQL without sanitization)
- Input sanitization: confirm `ValidationPipe` + `class-sanitizer` strips all HTML/scripts
- Token rotation: verify refresh token rotation works and old refresh tokens are invalidated in Redis
- Rate limiting integration test: 6 rapid login attempts → 6th returns 429
- Full auth flow integration test: register → verify → login → use API → logout → verify token invalid
- Validate all Swagger decorators are complete (`@ApiOperation`, `@ApiResponse`)
- Run `npm run lint` → zero errors
- Run `npm run test:cov` → coverage ≥ 80%

**Tests to write & run:**
```
test/security.e2e-spec.ts
  ← Response headers include X-Frame-Options, X-Content-Type-Options
  ← Rate limit: 6 login attempts → 429 with Retry-After header
  ← SQL injection attempt in email field → 400 (not 500)
  ← Expired access token → 401
  ← Reusing revoked refresh token → 401
  ← CORS: request from unknown origin → 403

test/full-flow.e2e-spec.ts (smoke test)
  ← Register → verify email → login → submit review → get result → export → logout
```
```bash
npm run test:cov   # must be ≥ 80%
npm run test:e2e
npm run lint
```

---

## Summary Table

| Step | Feature | FR / NFR | Phase | Priority |
|------|---------|----------|-------|----------|
| 1 | Bootstrap, config, Swagger, middleware | NFR1,4,8 | Foundation | CRITICAL |
| 2 | Prisma schema + PrismaService + seed | — | Foundation | CRITICAL |
| 3 | Redis / CacheModule | NFR1 | Foundation | CRITICAL |
| 4 | Guards, decorators, interceptors, filters | NFR4 | Foundation | CRITICAL |
| 5 | Auth: register, login, logout, refresh | FR1.1,1.2 | Auth | CRITICAL |
| 6 | Email verification | FR1.1 | Auth | HIGH |
| 7 | Password reset | FR1.3 | Auth | HIGH |
| 8 | Profile management + rate limiting | FR1.4, NFR2 | Auth | MEDIUM |
| 9 | Gemini AI service | FR2 | Code Review | CRITICAL |
| 9 | Gemini AI service | FR2 | Code Review | CRITICAL |
| 10 | Reviews: submit + status tracking | FR2.1,2.2 | Code Review | CRITICAL |
| 11 | Reviews: results + history + filters | FR2.3,2.4,2.5 | Code Review | CRITICAL |
| 12 | Export (PDF/JSON/MD/CSV) | FR5.1 | Export | HIGH |
| 13 | Code snippets CRUD + versioning | FR3.1 | Code Mgmt | MEDIUM |
| 14 | Collections + favorites + sharing | FR3.2 | Code Mgmt | LOW |
| 15 | Analytics endpoints | FR5.2 | Analytics | MEDIUM |
| 16 | In-app notifications | FR7.2 | Notifications | MEDIUM |
| 17 | Email notifications + preferences | FR7.1 | Notifications | MEDIUM |
| 18 | Team management | FR4.1 | Team (Premium) | HIGH |
| 19 | Shared reviews + comments | FR4.2 | Team (Premium) | HIGH |
| 20 | Webhooks | FR6.2 | Webhooks | MEDIUM |
| 21 | Admin endpoints | FR1.5 | Admin | HIGH |
| 22 | Health check | FR8.1 | Health | MEDIUM |
| 23 | Security hardening + coverage gate | NFR4 | Polish | HIGH |

---

## Testing Commands Reference

```bash
# Run unit tests
npm run test

# Run unit tests in watch mode
npm run test:watch

# Run unit tests with coverage (must be ≥ 80%)
npm run test:cov

# Run a single spec file
npm run test -- reviews.service.spec.ts

# Run e2e tests
npm run test:e2e

# Run e2e tests matching pattern
npm run test:e2e -- --testNamePattern="POST /api/v1/auth"

# Run lint
npm run lint

# Format
npm run format
```

## After Every Step — Checklist

- [ ] `npm run test` — all unit tests pass (no regressions)
- [ ] `npm run test:e2e` — all e2e tests pass for the new routes
- [ ] `npm run lint` — zero errors
- [ ] New routes documented in Swagger (`/api/docs`)
- [ ] All new endpoints return standard `{ status, data }` envelope
- [ ] Auth-protected routes return 401 without token
- [ ] Role-protected routes return 403 for insufficient role
- [ ] Input validation returns 400 with field-level errors

---

**How to use this file:**  
Tell me "Step N" or "let's do Step N" and I'll implement it fully, including all tests, before moving on.
