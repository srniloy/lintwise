import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import type { AIReviewResult } from './gemini.types';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 30000;

// ✅ CORRECT MODEL NAMES for @google/genai SDK
const FALLBACK_MODELS = [
  'gemini-2.5-flash',        // Your current working model (rate limited)
  'gemini-3-flash',           // Newer model with separate quotas
  'gemini-3.1-flash-lite',    // Even newer, separate quotas (15 RPM available!)
  'gemini-2.5-flash-lite',    // Lite version, separate quotas
  'gemma-3-12b',              // Open model, different quota pool
  'gemma-3-27b',              // Larger open model
];
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

Be thorough but practical. Prioritize CRITICAL and HIGH severity issues.`;

@Injectable()
export class GeminiService {
  private readonly ai: GoogleGenAI;
  private readonly logger = new Logger(GeminiService.name);
  private readonly maxRetries: number;
  private readonly baseDelay: number;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('gemini.apiKey');
    if (!apiKey) {
      this.logger.error('Gemini API key is not configured');
      throw new Error('Gemini API key is missing');
    }

    this.ai = new GoogleGenAI({ apiKey });
    this.maxRetries = this.config.get<number>('gemini.maxRetries') ?? MAX_RETRIES;
    this.baseDelay = this.config.get<number>('gemini.baseDelay') ?? BASE_DELAY_MS;
    this.logger.log(`GeminiService initialized with models: ${FALLBACK_MODELS.join(', ')}`);
  }

  async analyzeCode(
    code: string,
    language: string,
    title?: string,
  ): Promise<AIReviewResult> {
    const userPrompt = `Title: ${title || 'N/A'}
Language: ${language}

Code to Analyze:
\`\`\`
${code}
\`\`\`

Remember: Return ONLY valid JSON. No markdown formatting, no explanatory text outside the JSON.`;

    let lastError: Error | undefined;

    // Try each model in order
    for (const model of FALLBACK_MODELS) {
      this.logger.debug(`Attempting with model: ${model}`);

      const result = await this.retryWithBackoff(
        () => this.callGeminiWithModel(model, userPrompt),
        this.maxRetries
      );

      if (result.success) {
        this.logger.log(`✅ Successfully used model: ${model}`);
        console.log(result.data);
        return result.data!;
      }

      lastError = result.error;

      // Log failure but continue to next model
      if (result.error?.message?.includes('404')) {
        this.logger.warn(`Model ${model} not found (404), trying next...`);
      } else if (result.error?.message?.includes('429')) {
        this.logger.warn(`Model ${model} quota exceeded, trying next...`);
        await this.sleep(5000); // Wait 5 seconds on quota errors
      } else if (result.error?.message?.includes('503')) {
        this.logger.warn(`Model ${model} overloaded (503), trying next...`);
        await this.sleep(3000); // Wait 3 seconds on overload
      } else {
        this.logger.warn(`Model ${model} failed: ${result.error?.message}`);
      }

      // Wait before trying next model
      if (model !== FALLBACK_MODELS[FALLBACK_MODELS.length - 1]) {
        await this.sleep(1000);
      }
    }

    this.logger.error(`All models failed after ${FALLBACK_MODELS.length} models`, lastError);
    throw new ServiceUnavailableException(
      'Code analysis service is temporarily unavailable. Please try again later.',
    );
  }

  private async callGeminiWithModel(
    model: string,
    prompt: string
  ): Promise<AIReviewResult> {
    const startTime = Date.now();

    try {
      const response = await this.ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.7,
          maxOutputTokens: 4096,
          topP: 0.95,
          topK: 40,
          responseMimeType: 'application/json',
        },
      });

      const duration = Date.now() - startTime;
      const raw = response.text;

      if (!raw) {
        throw new Error('Empty response from Gemini');
      }

      this.logger.debug(`Response from ${model} in ${duration}ms (length: ${raw.length})`);

      // Log token usage for monitoring
      if (response.usageMetadata) {
        const { totalTokenCount, promptTokenCount, candidatesTokenCount } = response.usageMetadata;
        this.logger.debug(
          `Tokens - Total: ${totalTokenCount}, Prompt: ${promptTokenCount}, Response: ${candidatesTokenCount}`
        );
      }

      return this.parseResult(raw);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      // Enhance error with model info for better debugging
      error.message = `[${model}] ${error.message}`;
      error.model = model;
      error.duration = duration;
      throw error;
    }
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number
  ): Promise<{ success: boolean; data?: T; error?: Error }> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        return { success: true, data: result };
      } catch (error: any) {
        lastError = error;

        // Don't retry on 400/401/403/404 errors
        if (error.message?.includes('400') ||
          error.message?.includes('401') ||
          error.message?.includes('403') ||
          error.message?.includes('404')) {
          this.logger.warn(`Non-retryable error, stopping retries: ${error.message}`);
          break;
        }

        // Don't retry on invalid model name errors
        if (error.message?.includes('unexpected model name format')) {
          this.logger.warn(`Invalid model name format, stopping retries`);
          break;
        }

        if (attempt === maxRetries) {
          this.logger.error(`Final attempt ${attempt} failed: ${error.message}`);
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(this.baseDelay * Math.pow(2, attempt - 1), MAX_DELAY_MS);
        this.logger.warn(
          `Attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`
        );
        await this.sleep(delay);
      }
    }

    return { success: false, error: lastError };
  }

  private parseResult(raw: string): AIReviewResult {
    try {
      // Clean the response - remove any markdown code blocks
      let cleaned = raw.trim();
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
      cleaned = cleaned.replace(/\s*```$/, '');

      // Extract JSON if there's surrounding text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      const parsed = JSON.parse(cleaned) as AIReviewResult;

      // Validate and fix the response
      if (typeof parsed.overallScore !== 'number') {
        this.logger.warn('Missing overallScore, defaulting to 50');
        parsed.overallScore = 50;
      }

      if (!parsed.summary || typeof parsed.summary !== 'string') {
        this.logger.warn('Missing summary, providing default');
        parsed.summary = 'Code review completed with some issues identified.';
      }

      if (!Array.isArray(parsed.issues)) {
        parsed.issues = [];
      }

      // Clamp score to valid range
      parsed.overallScore = Math.max(0, Math.min(100, Math.round(parsed.overallScore)));

      return parsed;
    } catch (error: any) {
      this.logger.error(`Failed to parse Gemini response: ${raw.substring(0, 200)}`);
      this.logger.error(`Parse error: ${error.message}`);
      throw new Error('Invalid response format from AI service');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}