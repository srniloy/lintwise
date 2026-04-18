# LintWise Frontend — Step-by-Step Build Plan

**Stack:** React 19, TypeScript, Tailwind CSS 4, Vite  
**Source:** LintWise-Requirements-Summary.md  
**Rule:** Complete one step at a time. Tell me when you're ready for the next.

---

## PHASE 1 — Foundation & Infrastructure

### Step 1: Project Structure & Routing Setup
- Install `react-router-dom` for client-side routing
- Create the top-level folder structure:
  ```
  src/
    pages/          ← full-page route components
    components/     ← reusable UI components
    layouts/        ← page layout wrappers
    hooks/          ← custom React hooks
    store/          ← global state (context or zustand)
    services/       ← API call functions (axios/fetch wrappers)
    types/          ← shared TypeScript interfaces & enums
    utils/          ← helper functions
    constants/      ← app-wide constants (routes, config)
  ```
- Define all route constants in `constants/routes.ts`
- Set up `App.tsx` with `<BrowserRouter>` and route definitions (lazy-loaded pages)
- Create a `NotFoundPage` (404)

---

### Step 2: Global State & Auth Context
- Create `types/auth.ts` — `User`, `UserRole` (`USER | PREMIUM | ADMIN`), `AuthState`
- Create `store/AuthContext.tsx` — provides `user`, `token`, `login()`, `logout()`, `isAuthenticated`
- Persist token to `localStorage` (7-day access, 30-day refresh per NFR4)
- Create `hooks/useAuth.ts` — convenience hook wrapping context
- Create `services/authService.ts` — typed wrappers for auth API endpoints

---

### Step 3: Base Layout Components
- `layouts/PublicLayout.tsx` — minimal wrapper for auth pages (login, register)
- `layouts/AppLayout.tsx` — authenticated shell: sidebar + topbar + `<Outlet />`
- `components/Sidebar.tsx` — navigation links, role-aware menu items, collapse toggle
- `components/Topbar.tsx` — user avatar, notification bell, theme toggle, breadcrumbs
- Route guard: `components/ProtectedRoute.tsx` — redirects unauthenticated users to `/login`
- Route guard: `components/RoleGuard.tsx` — restricts access by `UserRole`

---

### Step 4: Theme System (Dark / Light Mode)
- Create `store/ThemeContext.tsx` — `theme: 'light' | 'dark'`, persisted to `localStorage`
- Wire Tailwind's `dark:` variant via `class` strategy on `<html>`
- Create `components/ThemeToggle.tsx` — icon button placed in Topbar
- Define a consistent color palette in `index.css` using CSS variables
- Ensure all base layouts respect the active theme

---

### Step 5: Shared UI Component Library
Build the primitive components used everywhere before building pages:
- `Button` — variants: primary, secondary, ghost, danger; sizes: sm, md, lg; loading state
- `Input` — with label, error message, helper text
- `Textarea` — same pattern as Input
- `Select` — styled native select
- `Modal` — accessible dialog (focus trap, ESC close, backdrop click)
- `Badge` — severity colors: critical, high, medium, low, info
- `Spinner` / `Skeleton` — loading states
- `Toast` / `Notification` — success, error, warning, info toasts (auto-dismiss)
- `Card` — base container with optional header/footer slots
- `Tabs` — controlled tab component
- `Tooltip` — hover information

---

## PHASE 2 — User Management (FR1)

### Step 6: Registration Page (FR1.1)
- Route: `/register`
- Form fields: Full Name, Email, Password, Confirm Password
- Client-side validation: 8+ chars, uppercase, lowercase, number, special char
- Show password strength indicator
- Submit → call `POST /api/v1/auth/register`
- On success: show "Check your email" confirmation screen
- Error handling: field-level API errors displayed inline

---

### Step 7: Login Page (FR1.2)
- Route: `/login`
- Form fields: Email, Password, Remember Me checkbox
- Submit → call `POST /api/v1/auth/login`, store JWT in context + localStorage
- Account lockout UI: after 5 failed attempts show lockout message with countdown
- Redirect to `/dashboard` on success
- Link to `/forgot-password`

---

### Step 8: Password Reset Flow (FR1.3)
- Route `/forgot-password` — email input form → `POST /api/v1/auth/forgot-password`
- Route `/reset-password?token=...` — new password + confirm → `POST /api/v1/auth/reset-password`
- Token expiry handling: show clear expired-link message
- Success state redirects to `/login` with success toast

---

### Step 9: Profile Management Page (FR1.4)
- Route: `/profile`
- Sections:
  - **Personal Info** — name, email (read-only), avatar upload
  - **Change Password** — current password + new password form
  - **Notification Preferences** — toggles per notification type (FR7)
  - **Danger Zone** — delete account (confirmation modal)
- `PUT /api/v1/users/profile` for updates
- Display user role badge (USER / PREMIUM / ADMIN)

---

## PHASE 3 — Core Code Review (FR2) — CRITICAL

### Step 10: Code Submission Page (FR2.1)
- Route: `/review/new`
- Two input modes (tabbed):
  1. **Paste Code** — `<Textarea>` with syntax highlighting (use `@uiw/react-codemirror` or similar)
  2. **Upload Files** — drag-and-drop zone, up to 5 files, 10MB total, show file list
- Language selector dropdown — 50+ languages
- Review title / description (optional)
- Submit button → `POST /api/v1/reviews`
- Immediate redirect to the review status page after submission

---

### Step 11: Review Status & Real-Time Tracking (FR2.2)
- Route: `/review/:id/status`
- Display a progress timeline: `PENDING → PROCESSING → COMPLETED`
- Poll `GET /api/v1/reviews/:id` every 3 seconds while status is not COMPLETED
- (Or use WebSocket/SSE if backend supports it)
- Show estimated time remaining
- Auto-navigate to results page when COMPLETED
- Handle FAILED state with retry option

---

### Step 12: Review Results Page (FR2.3 + FR2.4)
- Route: `/review/:id`
- **Summary panel** — total issues count, breakdown by category (Security, Performance, Quality, Style, Documentation, Testing, Dependencies)
- **Issue list** — filterable by category and severity (CRITICAL, HIGH, MEDIUM, LOW)
- **Issue card** — file name, line number, description, suggested fix, severity badge
- **Code viewer** — display submitted code with inline issue annotations
- **Score / Grade** display — overall code health score
- Tabs or sidebar navigation between summary and full issue list

---

### Step 13: Review History Page (FR2.5)
- Route: `/reviews`
- Paginated table/list of past reviews: title, language, date, issue count, status badge
- Search bar and filters (language, date range, status)
- Click row → navigate to `/review/:id`
- Comparison feature: select 2 reviews → side-by-side diff of issue counts and scores

---

## PHASE 4 — Code Management (FR3)

### Step 14: Code Snippets Library (FR3.1)
- Route: `/snippets`
- List view: title, language, created date, version number
- Create snippet: title + code editor + language selector
- Edit / version history: view past versions of a snippet
- `GET/POST/PUT /api/v1/snippets`

---

### Step 15: Favorites & Collections (FR3.2)
- Route: `/collections`
- Create / rename / delete collections (folders)
- Add reviews or snippets to collections
- Bulk operations: select multiple → add to collection / delete
- Share collection (generate share link)

---

## PHASE 5 — Export & Reporting (FR5)

### Step 16: Export Review (FR5.1)
- On the Review Results page (Step 12), add an **Export** button
- Dropdown: PDF, JSON, Markdown, CSV
- Call `GET /api/v1/reviews/:id/export?format=pdf`
- Show download progress / trigger browser download
- Accessible from Review History bulk-select too

---

### Step 17: Analytics Dashboard (FR5.2)
- Route: `/dashboard`
- **Personal stats** (all users):
  - Reviews submitted (total, this month)
  - Issues found by category — donut chart
  - Code quality trend over time — line chart
  - Languages reviewed — bar chart
- **Team stats** (PREMIUM only) — shown conditionally
- Use `recharts` or `chart.js` for charts
- Date range filter (last 7d / 30d / 90d / custom)

---

## PHASE 6 — Notifications (FR7)

### Step 18: In-App Notification Center (FR7.2)
- Notification bell in Topbar with unread count badge
- Dropdown panel: list of notifications (review complete, critical issue, mention)
- Mark as read (single + mark all as read)
- Link each notification to the relevant page
- Poll `GET /api/v1/notifications` every 30 seconds (or use WebSocket)
- Notification preferences managed in Profile page (Step 9)

---

## PHASE 7 — Team Collaboration — Premium (FR4)

### Step 19: Team Management Page (FR4.1)
- Route: `/team` (PREMIUM + ADMIN only — behind `RoleGuard`)
- Create team / view current team
- Member list: name, email, role (OWNER / MEMBER), joined date
- Invite member by email → `POST /api/v1/teams/invite`
- Remove member (OWNER only)
- Transfer ownership

---

### Step 20: Shared Reviews & Comments (FR4.2)
- On Review Results page (Step 12), add a **Comments** panel (PREMIUM)
- Threaded comments per issue or per review
- @mention support — autocomplete from team members
- Real-time or polled comment updates
- Mention notification triggers in-app notification (Step 18)

---

## PHASE 8 — Admin Panel (FR1.5)

### Step 21: Admin Dashboard
- Route: `/admin` (ADMIN role only)
- **User Management** — table of all users, search, filter by role
  - Actions: change role, suspend account, delete account
- **System Health** — live status of DB, Redis, Gemini API (FR8.1)
- **Review Stats** — platform-wide totals (daily reviews, active users)
- **Rate Limit Monitor** — usage per user tier

---

## PHASE 9 — Polish & Non-Functional

### Step 22: Accessibility Audit (NFR5 — WCAG 2.1 AA)
- Add `aria-*` attributes to all interactive components
- Ensure full keyboard navigation (Tab, Enter, Escape, arrow keys)
- Verify color contrast ratios meet AA standard in both themes
- Add skip-to-content link
- Test with screen reader (NVDA / VoiceOver)

---

### Step 23: Responsive Design Audit (NFR5)
- Test and fix layouts at 320px, 768px, 1024px, 1440px breakpoints
- Mobile: hamburger menu replaces sidebar
- Code editor / review results: stacked layout on mobile
- Tables: horizontal scroll or card-list view on small screens

---

### Step 24: Performance Optimizations (NFR1)
- Lazy-load all page components with `React.lazy` + `Suspense`
- Memoize expensive components with `React.memo` / `useMemo` / `useCallback`
- Implement list virtualization for long issue lists (`@tanstack/react-virtual`)
- Add HTTP request caching layer in `services/` (5-minute TTL for GET results)
- Optimize bundle: analyze with `vite-bundle-visualizer`, split large dependencies

---

### Step 25: Error Boundaries & Global Error Handling
- Create `components/ErrorBoundary.tsx` — catches render errors, shows fallback UI
- Wrap route-level components in boundaries
- Global API error interceptor in `services/apiClient.ts`:
  - 401 → clear auth state, redirect to `/login`
  - 429 → show rate-limit toast with retry-after
  - 500 → show generic error toast
- Offline detection banner

---

## Summary Table

| Step | Feature | FR / NFR | Phase | Priority |
|------|---------|----------|-------|----------|
| 1 | Project Structure & Routing | — | Foundation | CRITICAL |
| 2 | Auth Context & State | NFR4 | Foundation | CRITICAL |
| 3 | Base Layouts & Guards | NFR5 | Foundation | CRITICAL |
| 4 | Theme System | NFR5 | Foundation | HIGH |
| 5 | Shared UI Components | NFR5 | Foundation | CRITICAL |
| 6 | Registration | FR1.1 | User Mgmt | HIGH |
| 7 | Login | FR1.2 | User Mgmt | HIGH |
| 8 | Password Reset | FR1.3 | User Mgmt | HIGH |
| 9 | Profile Management | FR1.4 | User Mgmt | MEDIUM |
| 10 | Code Submission | FR2.1 | Code Review | CRITICAL |
| 11 | Review Status Tracking | FR2.2 | Code Review | CRITICAL |
| 12 | Review Results | FR2.3 + FR2.4 | Code Review | CRITICAL |
| 13 | Review History | FR2.5 | Code Review | MEDIUM |
| 14 | Snippets Library | FR3.1 | Code Mgmt | MEDIUM |
| 15 | Favorites & Collections | FR3.2 | Code Mgmt | LOW |
| 16 | Export Review | FR5.1 | Export | HIGH |
| 17 | Analytics Dashboard | FR5.2 | Export | MEDIUM |
| 18 | In-App Notifications | FR7.2 | Notifications | MEDIUM |
| 19 | Team Management | FR4.1 | Team (Premium) | HIGH |
| 20 | Shared Reviews & Comments | FR4.2 | Team (Premium) | HIGH |
| 21 | Admin Dashboard | FR1.5 | Admin | HIGH |
| 22 | Accessibility Audit | NFR5 | Polish | MEDIUM |
| 23 | Responsive Audit | NFR5 | Polish | MEDIUM |
| 24 | Performance Optimizations | NFR1 | Polish | HIGH |
| 25 | Error Boundaries | NFR3 | Polish | HIGH |

---

**How to use this file:**  
Tell me "Step N" or "let's do Step N" and I'll implement it completely before moving on.
