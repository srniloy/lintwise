export const ROUTES = {
  // Public
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // App (authenticated)
  DASHBOARD: '/dashboard',
  REVIEW_NEW: '/review/new',
  REVIEW_STATUS: (id: string) => `/review/${id}/status`,
  REVIEW_DETAIL: (id: string) => `/review/${id}`,
  REVIEWS: '/reviews',
  SNIPPETS: '/snippets',
  COLLECTIONS: '/collections',
  PROFILE: '/profile',

  // Premium
  TEAM: '/team',

  // Admin
  ADMIN: '/admin',
} as const
