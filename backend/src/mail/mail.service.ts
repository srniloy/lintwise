import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly from: string;
  private readonly frontendUrl: string;
  private readonly isDev: boolean;

  constructor(private readonly config: ConfigService) {
    this.from = config.get<string>('mail.from', 'noreply@lintwise.com');
    this.frontendUrl = config.get<string>('frontendUrl', 'http://localhost:5173');
    this.isDev = config.get<string>('nodeEnv', 'development') !== 'production';

    const host = config.get<string>('mail.host');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get<number>('mail.port', 587),
        secure: config.get<number>('mail.port', 587) === 465,
        auth: {
          user: config.get<string>('mail.user'),
          pass: config.get<string>('mail.pass'),
        },
      });
      this.logger.log(`Mail transporter configured: ${host}`);
    } else {
      this.logger.warn(
        'MAIL_HOST not set — emails will be logged to console (dev mode)',
      );
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private async send(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    // In dev mode always print the plain-text content so tokens are visible
    // in the console even when SMTP is not configured or credentials are wrong.
    if (this.isDev) {
      this.logger.log(
        `\n──────────────── [DEV MAIL] ────────────────\n` +
        `To:      ${to}\n` +
        `Subject: ${subject}\n` +
        `${html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()}\n` +
        `────────────────────────────────────────────`,
      );
    }

    if (!this.transporter) return;

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      this.logger.log(`Mail sent → ${to}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send mail to ${to}: ${msg}`);
      // Non-fatal — dev console log above already showed the content
    }
  }

  // ── Public methods ────────────────────────────────────────────────

  async sendVerificationEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const url = `${this.frontendUrl}/verify-email?token=${token}`;
    await this.send(
      email,
      'Verify your LintWise account',
      `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2>Welcome to LintWise, ${name}!</h2>
        <p>Click the button below to verify your email address. This link expires in 24 hours.</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
          Verify Email
        </a>
        <p style="color:#6b7280;font-size:14px">Or copy this link: ${url}</p>
        <p style="color:#6b7280;font-size:12px">If you didn't create a LintWise account, you can ignore this email.</p>
      </div>`,
    );
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
  ): Promise<void> {
    const url = `${this.frontendUrl}/reset-password?token=${token}`;
    await this.send(
      email,
      'Reset your LintWise password',
      `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2>Password Reset Request</h2>
        <p>Hi ${name}, we received a request to reset your password. Click below — this link expires in 1 hour.</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
          Reset Password
        </a>
        <p style="color:#6b7280;font-size:14px">Or copy this link: ${url}</p>
        <p style="color:#6b7280;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
      </div>`,
    );
  }

  async sendReviewCompleteEmail(
    email: string,
    name: string,
    reviewId: string,
    issueCount: number,
  ): Promise<void> {
    const url = `${this.frontendUrl}/review/${reviewId}`;
    await this.send(
      email,
      'Your LintWise code review is ready',
      `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2>Review Complete</h2>
        <p>Hi ${name}, your code review has finished. We found <strong>${issueCount}</strong> issue${issueCount === 1 ? '' : 's'}.</p>
        <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
          View Results
        </a>
      </div>`,
    );
  }
}
