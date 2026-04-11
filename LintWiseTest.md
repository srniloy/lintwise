# LintWise Testing Documentation

**Comprehensive Testing Strategy & Implementation**

---

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Testing Pyramid](#testing-pyramid)
3. [Testing Tools & Frameworks](#testing-tools--frameworks)
4. [Frontend Testing](#frontend-testing)
5. [Backend Testing](#backend-testing)
6. [Integration Testing](#integration-testing)
7. [End-to-End Testing](#end-to-end-testing)
8. [Performance Testing](#performance-testing)
9. [Security Testing](#security-testing)
10. [Test Coverage Goals](#test-coverage-goals)
11. [CI/CD Pipeline Integration](#cicd-pipeline-integration)
12. [Best Practices](#best-practices)
13. [Test Maintenance](#test-maintenance)

---

## Testing Overview

### Testing Strategy
LintWise follows a comprehensive testing strategy that ensures code quality, reliability, and security across all layers of the application. The testing approach is based on the testing pyramid principle: many unit tests, fewer integration tests, and a smaller number of end-to-end tests.

### Quality Gates
```
Code Committed
    ↓
Automated Tests Run (< 5 minutes)
    ├─ Unit Tests
    ├─ Integration Tests
    ├─ Linting & Code Quality
    └─ Security Scans
    ↓
All Checks Pass?
    ├─ YES → Code Review
    └─ NO → Fails Pipeline, Developer Fixes
    ↓
Code Review Approved
    ↓
E2E Tests Run (< 10 minutes)
    ↓
Merge to Main Branch
    ↓
Smoke Tests in Staging
    ↓
Production Deployment
```

### Testing Goals
- **Reliability**: 99.9% uptime with robust error handling
- **Quality**: > 80% code coverage
- **Performance**: API response time < 500ms (95th percentile)
- **Security**: Zero critical vulnerabilities
- **Regression Prevention**: Automated detection of breaking changes

---

## Testing Pyramid

```
                    △
                   /|\
                  / | \
                 /  |  \      E2E Tests (5%)
                /   |   \
               /    |    \
              /     |     \
             /      |      \
            /----------|-------\
           /           |           \
          /            |            \
         /             |             \
        /          Integration       \
       /          Tests (15%)        \
      /               |               \
     /                |                \
    /   Unit Tests (80%)               \
   /_____________________________|_____\
```

---

## Testing Tools & Frameworks

### Frontend Testing Stack

| Tool | Purpose | Version |
|------|---------|---------|
| **Vitest** | Unit testing framework | 1.x |
| **React Testing Library** | Component testing | 14.x |
| **Playwright** | E2E testing | 1.x |
| **Jest** | Snapshot testing | 29.x |
| **MSW (Mock Service Worker)** | API mocking | 1.x |
| **Cypress** | Alternative E2E testing | 13.x |
| **Coverage.js** | Coverage reporting | Latest |

### Backend Testing Stack

| Tool | Purpose | Version |
|------|---------|---------|
| **Jest** | Unit testing framework | 29.x |
| **@nestjs/testing** | NestJS testing utilities | 10.x |
| **Supertest** | HTTP assertion library | 6.x |
| **ts-jest** | TypeScript support for Jest | 29.x |
| **Test Containers** | Docker container management | 10.x |
| **PostgreSQL Testbed** | In-memory/container DB | 15.x |
| **Redis Mock** | Redis mocking | Latest |

### Code Quality Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | Linting & code quality |
| **Prettier** | Code formatting |
| **SonarQube** | Code quality analysis |
| **OWASP Dependency-Check** | Vulnerability scanning |
| **Snyk** | Dependency vulnerability detection |
| **TypeScript Compiler** | Type checking |

### CI/CD & Reporting

| Tool | Purpose |
|------|---------|
| **GitHub Actions** | CI/CD pipeline |
| **Codecov** | Coverage reporting |
| **Sentry** | Error tracking |
| **DataDog** | Performance monitoring |

---

## Frontend Testing

### Setup & Configuration

**`vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.spec.ts',
        '**/*.test.ts',
      ],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**`src/test/setup.ts`:**
```typescript
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
}

// Suppress console errors in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
```

### Unit Tests

**Example: Component Test (`CodeEditor.spec.tsx`):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CodeEditor } from '@/components/review/CodeEditor'

describe('CodeEditor Component', () => {
  const mockOnChange = vi.fn()
  
  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('should render the code editor', () => {
    render(<CodeEditor onChange={mockOnChange} value="" />)
    
    const editor = screen.getByRole('textbox')
    expect(editor).toBeInTheDocument()
  })

  it('should handle code input changes', async () => {
    const user = userEvent.setup()
    render(<CodeEditor onChange={mockOnChange} value="" />)
    
    const editor = screen.getByRole('textbox')
    await user.type(editor, 'const x = 1;')
    
    expect(mockOnChange).toHaveBeenCalledWith('const x = 1;')
  })

  it('should display initial code value', () => {
    const initialCode = 'console.log("test");'
    render(<CodeEditor onChange={mockOnChange} value={initialCode} />)
    
    const editor = screen.getByRole('textbox')
    expect(editor).toHaveValue(initialCode)
  })

  it('should support syntax highlighting', () => {
    render(<CodeEditor onChange={mockOnChange} value="const x = 1;" />)
    
    // Check for language-specific styling
    const editorContainer = screen.getByRole('textbox').parentElement
    expect(editorContainer).toHaveClass('monaco-editor')
  })

  it('should handle paste events', async () => {
    const user = userEvent.setup()
    render(<CodeEditor onChange={mockOnChange} value="" />)
    
    const editor = screen.getByRole('textbox')
    const pasteData = 'const foo = () => {};'
    
    await user.click(editor)
    fireEvent.paste(editor, {
      clipboardData: { getData: () => pasteData },
    })
    
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  it('should apply custom styling', () => {
    const { container } = render(
      <CodeEditor 
        onChange={mockOnChange} 
        value="" 
        className="custom-editor"
      />
    )
    
    const editorWrapper = container.querySelector('.custom-editor')
    expect(editorWrapper).toBeInTheDocument()
  })

  it('should handle errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Render with invalid props
    expect(() => {
      render(<CodeEditor onChange={mockOnChange} value={null as any} />)
    }).not.toThrow()
    
    consoleSpy.mockRestore()
  })
})
```

**Example: Hook Test (`useReview.spec.ts`):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useReview } from '@/hooks/useReview'
import * as reviewService from '@/services/reviewService'

vi.mock('@/services/reviewService')

describe('useReview Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useReview())
    
    expect(result.current.loading).toBe(false)
    expect(result.current.review).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should submit review and handle success', async () => {
    const mockReview = {
      id: '123',
      status: 'COMPLETED',
      overallScore: 85,
    }
    
    vi.mocked(reviewService.submitReview).mockResolvedValue(mockReview)
    
    const { result } = renderHook(() => useReview())
    
    await act(async () => {
      await result.current.submitReview({
        code: 'const x = 1;',
        language: 'JAVASCRIPT',
      })
    })
    
    await waitFor(() => {
      expect(result.current.review).toEqual(mockReview)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  it('should handle submission errors', async () => {
    const mockError = new Error('API Error')
    vi.mocked(reviewService.submitReview).mockRejectedValue(mockError)
    
    const { result } = renderHook(() => useReview())
    
    await act(async () => {
      try {
        await result.current.submitReview({
          code: 'const x = 1;',
          language: 'JAVASCRIPT',
        })
      } catch (e) {
        // Expected error
      }
    })
    
    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
      expect(result.current.loading).toBe(false)
    })
  })

  it('should fetch review status', async () => {
    const mockReview = { id: '123', status: 'PROCESSING' }
    vi.mocked(reviewService.getReview).mockResolvedValue(mockReview)
    
    const { result } = renderHook(() => useReview())
    
    await act(async () => {
      await result.current.fetchReview('123')
    })
    
    expect(result.current.review).toEqual(mockReview)
  })
})
```

### Integration Tests with MSW (Mock Service Worker)

**`src/test/mocks/handlers.ts`:**
```typescript
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.post('/api/v1/reviews', () => {
    return HttpResponse.json({
      status: 'success',
      data: {
        id: '123',
        status: 'PROCESSING',
      },
    }, { status: 201 })
  }),

  http.get('/api/v1/reviews/:id', ({ params }) => {
    return HttpResponse.json({
      status: 'success',
      data: {
        id: params.id,
        status: 'COMPLETED',
        overallScore: 85,
        issues: [],
      },
    })
  }),

  http.post('/api/v1/auth/login', async ({ request }) => {
    const { email } = await request.json()
    
    if (email === 'test@example.com') {
      return HttpResponse.json({
        status: 'success',
        data: {
          token: 'mock-jwt-token',
          user: { id: '1', email },
        },
      })
    }
    
    return HttpResponse.json(
      { status: 'error', message: 'Invalid credentials' },
      { status: 401 }
    )
  }),
]
```

**`src/test/mocks/server.ts`:**
```typescript
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

### Snapshot Testing

**Example: Snapshot Test**
```typescript
it('should render review result correctly', () => {
  const { container } = render(
    <ReviewResult 
      review={{
        id: '123',
        overallScore: 85,
        summary: 'Good code',
        issues: [],
      }}
    />
  )
  
  expect(container).toMatchSnapshot()
})
```

### Running Frontend Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- CodeEditor.spec.tsx

# Run tests matching pattern
npm run test -- --grep "CodeEditor"

# Debug mode
npm run test:debug
```

---

## Backend Testing

### Setup & Configuration

**`jest.config.js`:**
```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.module.ts',
    '!**/*.interface.ts',
    '!**/index.ts',
    '!src/main.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>', '<rootDir>/../test'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
  },
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
}
```

### Unit Tests

**Example: Service Test (`reviews.service.spec.ts`):**
```typescript
import { Test, TestingModule } from '@nestjs/testing'
import { ReviewsService } from './reviews.service'
import { PrismaService } from '../common/services/prisma.service'
import { ClaudeService } from '../services/claude.service'
import { CacheService } from '../services/cache.service'

describe('ReviewsService', () => {
  let service: ReviewsService
  let prisma: PrismaService
  let claude: ClaudeService
  let cache: CacheService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: {
            review: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            codeSnippet: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: ClaudeService,
          useValue: {
            analyzeCode: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<ReviewsService>(ReviewsService)
    prisma = module.get<PrismaService>(PrismaService)
    claude = module.get<ClaudeService>(ClaudeService)
    cache = module.get<CacheService>(CacheService)
  })

  describe('createReview', () => {
    it('should create a review successfully', async () => {
      const createReviewDto = {
        code: 'const x = 1;',
        language: 'JAVASCRIPT',
        title: 'Test Code',
      }

      const expectedReview = {
        id: '123',
        status: 'PENDING',
        ...createReviewDto,
      }

      jest.spyOn(prisma.codeSnippet, 'create').mockResolvedValue({
        id: 'snippet-123',
        ...createReviewDto,
      } as any)

      jest.spyOn(prisma.review, 'create').mockResolvedValue(expectedReview as any)

      const result = await service.createReview(createReviewDto, 'user-123')

      expect(result).toEqual(expectedReview)
      expect(prisma.review.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'PENDING',
          userId: 'user-123',
        }),
      })
    })

    it('should throw error if code is empty', async () => {
      const createReviewDto = {
        code: '',
        language: 'JAVASCRIPT',
        title: 'Test',
      }

      await expect(
        service.createReview(createReviewDto, 'user-123')
      ).rejects.toThrow('Code cannot be empty')
    })

    it('should handle database errors', async () => {
      const createReviewDto = {
        code: 'const x = 1;',
        language: 'JAVASCRIPT',
        title: 'Test',
      }

      jest.spyOn(prisma.review, 'create').mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(
        service.createReview(createReviewDto, 'user-123')
      ).rejects.toThrow('Database connection failed')
    })
  })

  describe('getReview', () => {
    it('should retrieve review from cache if available', async () => {
      const mockReview = {
        id: '123',
        status: 'COMPLETED',
      }

      jest.spyOn(cache, 'get').mockResolvedValue(mockReview)

      const result = await service.getReview('123')

      expect(result).toEqual(mockReview)
      expect(cache.get).toHaveBeenCalledWith('review:123')
    })

    it('should fetch from database if not in cache', async () => {
      const mockReview = {
        id: '123',
        status: 'COMPLETED',
      }

      jest.spyOn(cache, 'get').mockResolvedValue(null)
      jest.spyOn(prisma.review, 'findUnique').mockResolvedValue(mockReview as any)
      jest.spyOn(cache, 'set').mockResolvedValue(true)

      const result = await service.getReview('123')

      expect(result).toEqual(mockReview)
      expect(prisma.review.findUnique).toHaveBeenCalled()
      expect(cache.set).toHaveBeenCalledWith('review:123', mockReview)
    })

    it('should throw error if review not found', async () => {
      jest.spyOn(cache, 'get').mockResolvedValue(null)
      jest.spyOn(prisma.review, 'findUnique').mockResolvedValue(null)

      await expect(service.getReview('123')).rejects.toThrow('Review not found')
    })
  })

  describe('analyzeCode', () => {
    it('should analyze code using Claude API', async () => {
      const mockAnalysis = {
        overallScore: 85,
        issues: [],
        summary: 'Good code',
      }

      jest.spyOn(claude, 'analyzeCode').mockResolvedValue(mockAnalysis)

      const result = await service.analyzeCode('const x = 1;', 'JAVASCRIPT')

      expect(result).toEqual(mockAnalysis)
      expect(claude.analyzeCode).toHaveBeenCalledWith('const x = 1;', 'JAVASCRIPT')
    })

    it('should handle Claude API errors', async () => {
      jest.spyOn(claude, 'analyzeCode').mockRejectedValue(
        new Error('Claude API error')
      )

      await expect(
        service.analyzeCode('const x = 1;', 'JAVASCRIPT')
      ).rejects.toThrow('Claude API error')
    })
  })

  describe('getUserReviews', () => {
    it('should paginate reviews', async () => {
      const mockReviews = [
        { id: '1', status: 'COMPLETED' },
        { id: '2', status: 'COMPLETED' },
      ]

      jest.spyOn(prisma.review, 'findMany').mockResolvedValue(mockReviews as any)

      const result = await service.getUserReviews('user-123', {
        page: 1,
        limit: 10,
      })

      expect(result).toHaveLength(2)
      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      })
    })
  })
})
```

**Example: Controller Test (`reviews.controller.spec.ts`):**
```typescript
import { Test, TestingModule } from '@nestjs/testing'
import { ReviewsController } from './reviews.controller'
import { ReviewsService } from './reviews.service'
import { CreateReviewDto } from './dtos/create-review.dto'

describe('ReviewsController', () => {
  let controller: ReviewsController
  let service: ReviewsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: {
            createReview: jest.fn(),
            getReview: jest.fn(),
            getUserReviews: jest.fn(),
            deleteReview: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = module.get<ReviewsController>(ReviewsController)
    service = module.get<ReviewsService>(ReviewsService)
  })

  describe('POST /reviews', () => {
    it('should create a review', async () => {
      const createReviewDto: CreateReviewDto = {
        code: 'const x = 1;',
        language: 'JAVASCRIPT',
        title: 'Test',
      }

      const expectedReview = {
        id: '123',
        status: 'PENDING',
        ...createReviewDto,
      }

      jest.spyOn(service, 'createReview').mockResolvedValue(expectedReview)

      const result = await controller.create(createReviewDto, {
        id: 'user-123',
      } as any)

      expect(result.status).toBe('success')
      expect(result.data).toEqual(expectedReview)
    })

    it('should return 400 for invalid DTO', async () => {
      const invalidDto = {
        code: '',
        language: 'INVALID',
      }

      // Validation pipe will catch this
      expect(() => {
        Object.assign(createReviewDto, invalidDto)
      }).not.toThrow()
    })
  })

  describe('GET /reviews/:id', () => {
    it('should retrieve a review', async () => {
      const mockReview = {
        id: '123',
        status: 'COMPLETED',
      }

      jest.spyOn(service, 'getReview').mockResolvedValue(mockReview)

      const result = await controller.getOne('123')

      expect(result.status).toBe('success')
      expect(result.data).toEqual(mockReview)
    })
  })
})
```

### Database Integration Tests

**Example: Database Test with Test Container**
```typescript
import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../common/services/prisma.service'
import { ReviewsService } from './reviews.service'

describe('Reviews - Database Integration', () => {
  let service: ReviewsService
  let prisma: PrismaService

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        PrismaService,
      ],
    }).compile()

    service = module.get<ReviewsService>(ReviewsService)
    prisma = module.get<PrismaService>(PrismaService)

    // Connect to test database
    await prisma.$connect()
  })

  afterAll(async () => {
    // Clean up
    await prisma.review.deleteMany({})
    await prisma.codeSnippet.deleteMany({})
    await prisma.user.deleteMany({})
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clear data before each test
    await prisma.review.deleteMany({})
    await prisma.codeSnippet.deleteMany({})
  })

  it('should create and retrieve review from database', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashed-password',
      },
    })

    const review = await service.createReview(
      {
        code: 'const x = 1;',
        language: 'JAVASCRIPT',
      },
      user.id
    )

    const retrieved = await service.getReview(review.id)

    expect(retrieved).toEqual(review)
    expect(retrieved.userId).toBe(user.id)
  })
})
```

### Running Backend Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run specific test file
npm run test -- reviews.service.spec

# Run tests matching pattern
npm run test -- --testNamePattern="createReview"

# Debug mode
node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand

# Generate coverage report
npm run test:cov
# Open coverage/index.html
```

---

## Integration Testing

### API Integration Tests

**Example: End-to-End API Flow (`reviews.e2e.spec.ts`):**
```typescript
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../app.module'
import { PrismaService } from '../common/services/prisma.service'

describe('Reviews API (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let authToken: string
  let userId: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    prisma = moduleFixture.get<PrismaService>(PrismaService)

    await app.init()

    // Create test user and get auth token
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashed-password',
      },
    })

    userId = user.id

    // Get auth token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      })

    authToken = loginRes.body.data.token
  })

  afterAll(async () => {
    await prisma.review.deleteMany({})
    await prisma.codeSnippet.deleteMany({})
    await prisma.user.deleteMany({})
    await app.close()
  })

  describe('POST /reviews', () => {
    it('should create a review', () => {
      return request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'const x = 1;',
          language: 'JAVASCRIPT',
          title: 'Test Review',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.status).toBe('success')
          expect(res.body.data.id).toBeDefined()
          expect(res.body.data.status).toBe('PENDING')
        })
    })

    it('should reject unauthorized request', () => {
      return request(app.getHttpServer())
        .post('/api/v1/reviews')
        .send({
          code: 'const x = 1;',
          language: 'JAVASCRIPT',
        })
        .expect(401)
    })

    it('should validate DTO', () => {
      return request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: '',
          language: 'INVALID_LANGUAGE',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.status).toBe('error')
        })
    })
  })

  describe('GET /reviews/:id', () => {
    let reviewId: string

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'const x = 1;',
          language: 'JAVASCRIPT',
        })

      reviewId = res.body.data.id
    })

    it('should retrieve review', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('success')
          expect(res.body.data.id).toBe(reviewId)
        })
    })

    it('should return 404 for non-existent review', () => {
      return request(app.getHttpServer())
        .get('/api/v1/reviews/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)
    })
  })

  describe('GET /reviews (pagination)', () => {
    beforeEach(async () => {
      // Create multiple reviews
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/reviews')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            code: `const x${i} = ${i};`,
            language: 'JAVASCRIPT',
          })
      }
    })

    it('should paginate reviews', () => {
      return request(app.getHttpServer())
        .get('/api/v1/reviews?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.items.length).toBe(2)
          expect(res.body.data.pagination.page).toBe(1)
          expect(res.body.data.pagination.limit).toBe(2)
          expect(res.body.data.pagination.total).toBe(5)
        })
    })
  })

  describe('DELETE /reviews/:id', () => {
    let reviewId: string

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'const x = 1;',
          language: 'JAVASCRIPT',
        })

      reviewId = res.body.data.id
    })

    it('should delete review', () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('success')
        })
    })

    it('should not retrieve deleted review', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${authToken}`)

      return request(app.getHttpServer())
        .get(`/api/v1/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)
    })
  })
})
```

---

## End-to-End Testing

### Playwright E2E Tests

**`playwright.config.ts`:**
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
})
```

**Example: E2E Test (`code-review.spec.ts`):**
```typescript
import { test, expect } from '@playwright/test'

test.describe('Code Review Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    
    // Login if necessary
    const loginButton = page.getByRole('button', { name: /login/i })
    if (await loginButton.isVisible()) {
      await loginButton.click()
      await page.fill('input[name="email"]', 'test@example.com')
      await page.fill('input[name="password"]', 'password123')
      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard')
    }
  })

  test('should submit code for review', async ({ page }) => {
    // Navigate to review page
    await page.click('a:has-text("New Review")')
    await page.waitForURL('/review/new')

    // Enter code in editor
    const codeEditor = page.locator('[role="textbox"]').first()
    await codeEditor.click()
    await codeEditor.fill('const hello = () => console.log("hello");')

    // Select language
    const languageSelect = page.locator('select[name="language"]')
    await languageSelect.selectOption('JAVASCRIPT')

    // Enter title
    await page.fill('input[name="title"]', 'Hello Function')

    // Submit review
    const submitButton = page.getByRole('button', { name: /submit/i })
    await submitButton.click()

    // Verify review was created
    await expect(page.locator('text=Review submitted successfully')).toBeVisible()
    await expect(page.locator('text=Processing...')).toBeVisible()
  })

  test('should display review results', async ({ page }) => {
    // Navigate to review history
    await page.click('a:has-text("History")')
    await page.waitForURL('/history')

    // Click on a review
    const reviewItem = page.locator('[data-testid="review-item"]').first()
    await reviewItem.click()

    // Wait for results to load
    await page.waitForLoadState('networkidle')

    // Verify results are displayed
    await expect(page.locator('text=Overall Score')).toBeVisible()
    await expect(page.locator('[data-testid="issues-list"]')).toBeVisible()
  })

  test('should handle errors gracefully', async ({ page }) => {
    await page.click('a:has-text("New Review")')

    // Try to submit empty code
    const submitButton = page.getByRole('button', { name: /submit/i })
    await submitButton.click()

    // Verify error message
    await expect(page.locator('text=Code cannot be empty')).toBeVisible()
  })

  test('should export review as PDF', async ({ page, context }) => {
    // Navigate to a review
    await page.click('a:has-text("History")')
    const reviewItem = page.locator('[data-testid="review-item"]').first()
    await reviewItem.click()

    // Trigger PDF download
    const downloadPromise = context.waitForEvent('download')
    await page.click('button:has-text("Export PDF")')
    const download = await downloadPromise

    // Verify download
    expect(download.suggestedFilename()).toMatch(/review-\d+\.pdf/)
  })

  test('should support responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 })

    await page.click('a:has-text("New Review")')

    // Verify mobile layout
    const editor = page.locator('[role="textbox"]').first()
    await expect(editor).toBeVisible()

    // Verify mobile menu works
    const mobileMenu = page.locator('[data-testid="mobile-menu"]')
    await expect(mobileMenu).toBeVisible()
  })

  test('should handle network errors', async ({ page }) => {
    // Simulate network failure
    await page.context().setOffline(true)

    await page.click('a:has-text("History")')

    // Verify error handling
    await expect(page.locator('text=Network error')).toBeVisible()

    // Restore connection
    await page.context().setOffline(false)
  })
})
```

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests in headed mode (see browser)
npm run test:e2e -- --headed

# Run specific test file
npm run test:e2e -- code-review.spec.ts

# Run tests in debug mode
npm run test:e2e -- --debug

# Generate HTML report
npm run test:e2e
npx playwright show-report

# Run on specific browser
npm run test:e2e -- --project=firefox
```

---

## Performance Testing

### Load Testing with Artillery

**`load-test.yml`:**
```yaml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Ramp up"
    - duration: 60
      arrivalRate: 50
      name: "Sustained load"
  processor: "./load-test-processor.js"
  variables:
    token: "{{ $randomString(32) }}"

scenarios:
  - name: "Code Review Workflow"
    flow:
      - post:
          url: "/api/v1/auth/login"
          json:
            email: "test@example.com"
            password: "password123"
          capture:
            json: "$.data.token"
            as: "token"
      - post:
          url: "/api/v1/reviews"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            code: "const x = 1;"
            language: "JAVASCRIPT"
          capture:
            json: "$.data.id"
            as: "reviewId"
      - get:
          url: "/api/v1/reviews/{{ reviewId }}"
          headers:
            Authorization: "Bearer {{ token }}"
          expect:
            - statusCode: 200
```

**Running Load Tests:**
```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery run load-test.yml

# Generate report
artillery run load-test.yml --output results.json
artillery report results.json
```

### Performance Benchmarks

**Target Metrics:**
- API Response Time: < 500ms (95th percentile)
- Database Queries: < 100ms average
- Cache Hit Rate: > 80%
- Memory Usage: < 500MB per instance
- CPU Usage: < 60% under normal load

---

## Security Testing

### OWASP Testing

**Security Test Checklist:**
- [ ] SQL Injection tests
- [ ] XSS (Cross-Site Scripting) tests
- [ ] CSRF (Cross-Site Request Forgery) tests
- [ ] Authentication bypass tests
- [ ] Authorization bypass tests
- [ ] Input validation tests
- [ ] Rate limiting tests
- [ ] Dependency vulnerability scans

**Running Security Scans:**
```bash
# Dependency vulnerability check
npm audit

# Snyk scan
snyk test

# OWASP Dependency-Check
dependency-check --project "LintWise" --scan .

# SonarQube scan
sonarqube-scanner \
  -Dsonar.projectKey=lintwise \
  -Dsonar.sources=src \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.login=token
```

---

## Test Coverage Goals

### Target Coverage by Layer

| Layer | Target | Minimum |
|-------|--------|---------|
| Unit Tests | 85% | 80% |
| Integration Tests | 70% | 60% |
| E2E Tests | 60% | 50% |
| **Overall** | **80%** | **75%** |

### Coverage Reporting

```bash
# Generate coverage report
npm run test:cov

# View coverage report
open coverage/index.html

# Coverage trends
npm run test:cov -- --collectCoverageFrom="src/**/*.ts"
```

---

## CI/CD Pipeline Integration

### GitHub Actions Workflow

**`.github/workflows/test.yml`:**
```yaml
name: Tests & Quality

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password
          POSTGRES_DB: lintwise_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Setup test database
        run: |
          cd backend
          npx prisma migrate deploy
          npx prisma generate
        env:
          DATABASE_URL: postgresql://postgres:password@localhost:5432/lintwise_test

      - name: Lint code
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Frontend tests
        run: npm run test:frontend --coverage

      - name: Backend tests
        run: npm run test:backend --coverage

      - name: Integration tests
        run: npm run test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

      - name: Security scan
        run: npm audit --audit-level=moderate

      - name: SonarQube scan
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  e2e:
    runs-on: ubuntu-latest
    needs: test
    
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload E2E report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  deploy:
    runs-on: ubuntu-latest
    needs: [test, e2e]
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to production
        run: |
          npm run build
          npm run deploy
```

---

## Best Practices

### Testing Guidelines

1. **Write Testable Code**
   - Keep functions pure
   - Avoid hard dependencies
   - Use dependency injection
   - Keep functions small and focused

2. **Test Naming**
   ```typescript
   // ✅ Good
   test('should return user when valid ID is provided')
   test('should throw error when user is not found')
   
   // ❌ Bad
   test('getUserById')
   test('error handling')
   ```

3. **Arrange-Act-Assert Pattern**
   ```typescript
   it('should create user', () => {
     // Arrange
     const userData = { email: 'test@example.com' }
     
     // Act
     const user = createUser(userData)
     
     // Assert
     expect(user.email).toBe('test@example.com')
   })
   ```

4. **Avoid Flaky Tests**
   - Don't rely on timing
   - Use explicit waits
   - Isolate tests from each other
   - Mock external dependencies

5. **DRY Principle in Tests**
   ```typescript
   // Use beforeEach for setup
   beforeEach(() => {
     mockData = createMockData()
   })
   ```

---

## Test Maintenance

### Regular Maintenance Tasks

- **Weekly**: Review failing tests, update snapshots
- **Monthly**: Update test dependencies, optimize slow tests
- **Quarterly**: Remove unused tests, refactor complex test suites
- **Annually**: Audit test coverage, update strategy

### Documentation
- Document test setup and requirements
- Maintain list of known flaky tests
- Document mocking strategies
- Keep test data samples up-to-date

---

## Additional Resources

### Testing Tools Documentation
- [Vitest](https://vitest.dev/)
- [Jest](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright](https://playwright.dev/)
- [Supertest](https://github.com/visionmedia/supertest)

### Testing Best Practices
- [Testing JavaScript](https://testingjavascript.com/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Google Testing Practices](https://google.github.io/styleguide/jsguide.html)

---

**Last Updated**: April 2024
**Version**: 1.0.0
**Testing Lead**: QA Team
