import { Test, TestingModule } from '@nestjs/testing';
import { ExportService } from './export.service';

// ── Factories ─────────────────────────────────────────────────────────────────

function makeReview(overrides: Partial<any> = {}): any {
  return {
    id: 'review-1',
    userId: 'user-1',
    title: 'My Test Review',
    language: 'typescript',
    code: 'const x = 1;',
    status: 'COMPLETED',
    overallScore: 85,
    summary: 'Overall code quality is good.',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    ...overrides,
  };
}

function makeIssue(overrides: Partial<any> = {}): any {
  return {
    id: 'issue-1',
    reviewId: 'review-1',
    category: 'SECURITY',
    severity: 'HIGH',
    title: 'SQL injection risk',
    description: 'Unsanitized input is used directly in a SQL query.',
    suggestion: 'Use parameterized queries or an ORM.',
    lineStart: 10,
    lineEnd: 12,
    fileName: 'db.ts',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExportService],
    }).compile();

    service = module.get<ExportService>(ExportService);
  });

  // ── exportAsJson() ────────────────────────────────────────────────────────

  describe('exportAsJson()', () => {
    it('returns valid JSON containing all review fields', () => {
      const review = makeReview();
      const issue = makeIssue();

      const result = service.exportAsJson(review, [issue]);
      const parsed = JSON.parse(result);

      expect(parsed.id).toBe('review-1');
      expect(parsed.title).toBe('My Test Review');
      expect(parsed.language).toBe('typescript');
      expect(parsed.status).toBe('COMPLETED');
      expect(parsed.overallScore).toBe(85);
      expect(parsed.summary).toBe('Overall code quality is good.');
    });

    it('includes all issue fields in the issues array', () => {
      const review = makeReview();
      const issue = makeIssue();

      const result = service.exportAsJson(review, [issue]);
      const parsed = JSON.parse(result);

      expect(parsed.issues).toHaveLength(1);
      expect(parsed.issues[0]).toMatchObject({
        id: 'issue-1',
        category: 'SECURITY',
        severity: 'HIGH',
        title: 'SQL injection risk',
        lineStart: 10,
        lineEnd: 12,
        fileName: 'db.ts',
      });
    });

    it('returns an empty issues array when there are no issues', () => {
      const review = makeReview();

      const result = service.exportAsJson(review, []);
      const parsed = JSON.parse(result);

      expect(parsed.issues).toEqual([]);
    });

    it('handles null optional fields without throwing', () => {
      const review = makeReview({ title: null, overallScore: null, summary: null });
      const issue = makeIssue({ suggestion: null, lineStart: null, lineEnd: null, fileName: null });

      expect(() => service.exportAsJson(review, [issue])).not.toThrow();
      const parsed = JSON.parse(service.exportAsJson(review, [issue]));
      expect(parsed.title).toBeNull();
      expect(parsed.issues[0].suggestion).toBeNull();
    });
  });

  // ── exportAsMarkdown() ────────────────────────────────────────────────────

  describe('exportAsMarkdown()', () => {
    it('returns a string containing the review title as an H1', () => {
      const review = makeReview();
      const result = service.exportAsMarkdown(review, []);

      expect(result).toContain('# My Test Review');
    });

    it('contains all issue titles', () => {
      const review = makeReview();
      const issues = [
        makeIssue({ title: 'SQL injection risk' }),
        makeIssue({ id: 'issue-2', title: 'Missing null check', severity: 'MEDIUM', category: 'QUALITY' }),
      ];

      const result = service.exportAsMarkdown(review, issues);

      expect(result).toContain('SQL injection risk');
      expect(result).toContain('Missing null check');
    });

    it('includes the summary section when summary is present', () => {
      const review = makeReview({ summary: 'Overall code quality is good.' });
      const result = service.exportAsMarkdown(review, []);

      expect(result).toContain('## Summary');
      expect(result).toContain('Overall code quality is good.');
    });

    it('includes language, status and score metadata', () => {
      const review = makeReview();
      const result = service.exportAsMarkdown(review, []);

      expect(result).toContain('typescript');
      expect(result).toContain('COMPLETED');
      expect(result).toContain('85/100');
    });

    it('shows "No issues found" when issues array is empty', () => {
      const review = makeReview();
      const result = service.exportAsMarkdown(review, []);

      expect(result).toContain('No issues found');
    });

    it('uses review id as title when title is null', () => {
      const review = makeReview({ title: null });
      const result = service.exportAsMarkdown(review, []);

      expect(result).toContain(`# Review ${review.id}`);
    });
  });

  // ── exportAsCsv() ─────────────────────────────────────────────────────────

  describe('exportAsCsv()', () => {
    it('returns comma-separated lines with a header row', () => {
      const issue = makeIssue();
      const result = service.exportAsCsv([issue]);
      const lines = result.trim().split('\n');

      // At least header + one data row
      expect(lines.length).toBeGreaterThanOrEqual(2);
    });

    it('includes expected column headers', () => {
      const result = service.exportAsCsv([makeIssue()]);
      expect(result).toContain('category');
      expect(result).toContain('severity');
      expect(result).toContain('title');
      expect(result).toContain('description');
    });

    it('contains issue data in the CSV output', () => {
      const issue = makeIssue();
      const result = service.exportAsCsv([issue]);

      expect(result).toContain('SECURITY');
      expect(result).toContain('HIGH');
      expect(result).toContain('SQL injection risk');
    });

    it('returns a header-only string when issues array is empty', () => {
      const result = service.exportAsCsv([]);

      // Should still contain column headers
      expect(result).toContain('category');
      expect(result).toContain('severity');
    });
  });

  // ── exportAsPdf() ─────────────────────────────────────────────────────────

  describe('exportAsPdf()', () => {
    it('returns a non-empty Buffer', async () => {
      const review = makeReview();
      const buffer = await service.exportAsPdf(review, [makeIssue()]);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('PDF buffer starts with the PDF magic bytes %PDF', async () => {
      const review = makeReview();
      const buffer = await service.exportAsPdf(review, []);

      expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    });

    it('generates a PDF when there are no issues', async () => {
      const review = makeReview();
      const buffer = await service.exportAsPdf(review, []);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('generates a PDF when title is null', async () => {
      const review = makeReview({ title: null });
      const buffer = await service.exportAsPdf(review, [makeIssue()]);

      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });
});
