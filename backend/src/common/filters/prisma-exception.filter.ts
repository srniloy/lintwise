import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

const PRISMA_ERROR_MAP: Record<string, { status: number; message: string }> = {
  // Unique constraint violation
  P2002: { status: 409, message: 'Resource already exists' },
  // Record not found
  P2025: { status: 404, message: 'Resource not found' },
  // Foreign key constraint failed
  P2003: { status: 400, message: 'Related resource not found' },
  // Required field missing
  P2011: { status: 400, message: 'Required field is missing' },
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const mapped = PRISMA_ERROR_MAP[exception.code];

    if (mapped) {
      response.status(mapped.status).json({
        status: 'error',
        statusCode: mapped.status,
        message: mapped.message,
        prismaCode: exception.code,
      });
    } else {
      this.logger.error(`Unhandled Prisma error [${exception.code}]: ${exception.message}`);
      response.status(500).json({
        status: 'error',
        statusCode: 500,
        message: 'Database error',
        prismaCode: exception.code,
      });
    }
  }
}
