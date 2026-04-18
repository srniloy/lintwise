import { Injectable } from '@nestjs/common';
import { parse as toCsv } from 'json2csv';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import type { Review, Issue } from '@prisma/client';

@Injectable()
export class ExportService {
  // ── JSON ──────────────────────────────────────────────────────────────────

  exportAsJson(review: Review, issues: Issue[]): string {
    const payload = {
      id: review.id,
      title: review.title ?? null,
      language: review.language,
      status: review.status,
      overallScore: review.overallScore ?? null,
      summary: review.summary ?? null,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      issues: issues.map((i) => ({
        id: i.id,
        category: i.category,
        severity: i.severity,
        title: i.title,
        description: i.description,
        suggestion: i.suggestion ?? null,
        lineStart: i.lineStart ?? null,
        lineEnd: i.lineEnd ?? null,
        fileName: i.fileName ?? null,
      })),
    };
    return JSON.stringify(payload, null, 2);
  }

  // ── Markdown ──────────────────────────────────────────────────────────────

  exportAsMarkdown(review: Review, issues: Issue[]): string {
    const title = review.title ?? `Review ${review.id}`;
    const lines: string[] = [];

    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`**Language:** ${review.language}`);
    lines.push(`**Status:** ${review.status}`);
    if (review.overallScore !== null) {
      lines.push(`**Score:** ${review.overallScore}/100`);
    }
    lines.push(`**Date:** ${review.createdAt.toISOString()}`);

    if (review.summary) {
      lines.push('');
      lines.push('## Summary');
      lines.push('');
      lines.push(review.summary);
    }

    if (issues.length > 0) {
      lines.push('');
      lines.push('## Issues');
      lines.push('');

      for (const issue of issues) {
        const loc = issue.fileName
          ? ` — \`${issue.fileName}\`${issue.lineStart != null ? ` L${issue.lineStart}` : ''}${issue.lineEnd != null && issue.lineEnd !== issue.lineStart ? `–${issue.lineEnd}` : ''}`
          : '';
        lines.push(`### [${issue.severity}] ${issue.title}${loc}`);
        lines.push('');
        lines.push(`**Category:** ${issue.category}`);
        lines.push('');
        lines.push(issue.description);
        if (issue.suggestion) {
          lines.push('');
          lines.push(`**Suggestion:** ${issue.suggestion}`);
        }
        lines.push('');
      }
    } else {
      lines.push('');
      lines.push('## Issues');
      lines.push('');
      lines.push('_No issues found._');
    }

    return lines.join('\n');
  }

  // ── CSV ───────────────────────────────────────────────────────────────────

  exportAsCsv(issues: Issue[]): string {
    if (issues.length === 0) {
      return 'category,severity,title,description,suggestion,fileName,lineStart,lineEnd\n';
    }

    const rows = issues.map((i) => ({
      category: i.category,
      severity: i.severity,
      title: i.title,
      description: i.description,
      suggestion: i.suggestion ?? '',
      fileName: i.fileName ?? '',
      lineStart: i.lineStart ?? '',
      lineEnd: i.lineEnd ?? '',
    }));

    return toCsv(rows, {
      fields: ['category', 'severity', 'title', 'description', 'suggestion', 'fileName', 'lineStart', 'lineEnd'],
    });
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  exportAsPdf(review: Review, issues: Issue[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const title = review.title ?? `Review ${review.id}`;

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'left' });
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica');
      doc.text(`Language: ${review.language}   Status: ${review.status}   Score: ${review.overallScore ?? 'N/A'}/100`);
      doc.text(`Date: ${review.createdAt.toISOString()}`);
      doc.moveDown();

      // Summary
      if (review.summary) {
        doc.fontSize(14).font('Helvetica-Bold').text('Summary');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').text(review.summary, { align: 'justify' });
        doc.moveDown();
      }

      // Issues
      doc.fontSize(14).font('Helvetica-Bold').text(`Issues (${issues.length})`);
      doc.moveDown(0.3);

      if (issues.length === 0) {
        doc.fontSize(10).font('Helvetica').text('No issues found.');
      } else {
        for (const issue of issues) {
          doc.fontSize(11).font('Helvetica-Bold').text(`[${issue.severity}] ${issue.title}`);
          doc.fontSize(9).font('Helvetica').text(`Category: ${issue.category}`);
          if (issue.fileName) {
            const loc = issue.lineStart != null ? ` (line ${issue.lineStart}${issue.lineEnd && issue.lineEnd !== issue.lineStart ? `–${issue.lineEnd}` : ''})` : '';
            doc.text(`File: ${issue.fileName}${loc}`);
          }
          doc.moveDown(0.2);
          doc.fontSize(10).font('Helvetica').text(issue.description, { align: 'justify' });
          if (issue.suggestion) {
            doc.moveDown(0.2);
            doc.font('Helvetica-Oblique').text(`Suggestion: ${issue.suggestion}`, { align: 'justify' });
          }
          doc.moveDown(0.8);
        }
      }

      doc.end();
    });
  }
}
