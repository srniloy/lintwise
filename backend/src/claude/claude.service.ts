import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { AIReviewResult } from './claude.types';

const MODEL = 'claude-haiku-4-5-20251001'; // most token-efficient on free tier
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

const SYSTEM_PROMPT = `You are an expert code reviewer. Analyze the provided code thoroughly and return a structured JSON review.

Your response MUST be valid JSON only — no markdown, no explanation outside the JSON.

Return exactly this shape:
{
  "overallScore": <integer 0-100>,
  "summary": "<2-4 sentence overall assessment>",
  "issues": [
    {
      "category": "<SECURITY|PERFORMANCE|QUALITY|STYLE|DOCUMENTATION|TESTING|DEPENDENCIES>",
      "severity": "<CRITICAL|HIGH|MEDIUM|LOW>",
      "title": "<short issue title>",
      "description": "<detailed explanation of the problem>",
      "suggestion": "<concrete fix or improvement>",
      "lineStart": <line number or null>,
      "lineEnd": <line number or null>,
      "fileName": "<filename or null>"
    }
  ]
}

Scoring guide:
- 90-100: Excellent — production-ready, minor style notes only
- 70-89:  Good — a few improvements needed
- 50-69:  Fair — several issues, needs work before production
- 30-49:  Poor — significant problems across multiple areas
- 0-29:   Critical — severe security or correctness issues

Category definitions:
- SECURITY: SQL injection, XSS, auth bypass, secrets in code, insecure crypto, etc.
- PERFORMANCE: unnecessary loops, N+1 queries, memory leaks, blocking calls, etc.
- QUALITY: dead code, error handling gaps, null safety issues, code correctness, etc.
- STYLE: naming conventions, formatting, readability, code organization
- DOCUMENTATION: missing/incorrect comments, undocumented public APIs
- TESTING: missing tests, untestable code, test coverage gaps
- DEPENDENCIES: outdated/vulnerable packages, unnecessary dependencies

Be thorough but practical. Prioritize CRITICAL and HIGH severity issues.`;

@Injectable()
export class ClaudeService {
  private readonly client: Anthropic;
  private readonly logger = new Logger(ClaudeService.name);

  constructor(private readonly config: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.config.get<string>('claude.apiKey'),
    });
  }

  async analyzeCode(
    code: string,
    language: string,
    title?: string,
  ): Promise<AIReviewResult> {
    const userContent = [
      title ? `Title: ${title}\n` : '',
      `Language: ${language}\n\n`,
      '```\n',
      code,
      '\n```',
    ].join('');

    let lastError: Error | undefined;
    let finalAttempt = 0;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      finalAttempt = attempt;
      try {
        const message = await this.client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: [
            {
              type: 'text',
              text: SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [{ role: 'user', content: userContent }],
        });

        const raw = message.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { type: 'text'; text: string }).text)
          .join('');

        return this.parseResult(raw);
      } catch (err: unknown) {
        lastError = err as Error;

        if (!this.isTransientError(err)) break;

        const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
        this.logger.warn(
          `Claude attempt ${attempt} failed (${lastError.message}). Retrying in ${delay}ms…`,
        );
        await this.sleep(delay);
      }
    }

    if (lastError instanceof Anthropic.APIError) {
      if (lastError.status === 400 || lastError.status === 401 || lastError.status === 403) {
        this.logger.error(`Claude non-retryable error (${lastError.status})`, lastError.message);

        // 400 with credit message → billing problem, not a config bug
        if (
          lastError.status === 400 &&
          lastError.message.toLowerCase().includes('credit balance')
        ) {
          throw new ServiceUnavailableException(
            'Code analysis is temporarily unavailable: insufficient API credits.',
          );
        }

        throw new ServiceUnavailableException(
          'Code analysis service is misconfigured. Please contact support.',
        );
      }
    }

    this.logger.error(`Claude failed after ${finalAttempt} attempt(s)`, lastError);
    throw new ServiceUnavailableException(
      'Code analysis service is temporarily unavailable. Please try again later.',
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private parseResult(raw: string): AIReviewResult {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');

    const parsed = JSON.parse(cleaned) as AIReviewResult;
    parsed.overallScore = Math.max(0, Math.min(100, Math.round(parsed.overallScore)));
    return parsed;
  }

  private isTransientError(err: unknown): boolean {
    if (err instanceof Anthropic.APIError) {
      return err.status === 429 || err.status === 529 || (err.status ?? 0) >= 500;
    }
    const msg = (err as Error)?.message ?? '';
    return msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('fetch');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
