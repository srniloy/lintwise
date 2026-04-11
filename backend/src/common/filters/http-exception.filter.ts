import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface ValidationBody {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = 'An error occurred';
    let errors: Record<string, string[]> | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const body = exceptionResponse as ValidationBody;

      if (Array.isArray(body.message)) {
        // Class-validator returns an array of constraint strings
        message = 'Validation failed';
        errors = { validation: body.message };
      } else {
        message = body.message ?? exception.message;
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${status} — ${message}`);
    }

    response.status(status).json({
      status: 'error',
      statusCode: status,
      message,
      ...(errors && { errors }),
    });
  }
}
