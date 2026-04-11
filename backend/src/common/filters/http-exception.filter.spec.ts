import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function buildHost(statusFn = jest.fn(), jsonFn = jest.fn()): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        status: (code: number) => {
          statusFn(code);
          return { json: jsonFn };
        },
      }),
    }),
  } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('returns { status: "error", message } for a plain string exception', () => {
    const statusFn = jest.fn();
    const jsonFn = jest.fn();
    const host = buildHost(statusFn, jsonFn);

    filter.catch(
      new HttpException('Not found', HttpStatus.NOT_FOUND),
      host,
    );

    expect(statusFn).toHaveBeenCalledWith(404);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', message: 'Not found' }),
    );
  });

  it('returns validation errors array for 400 from ValidationPipe', () => {
    const statusFn = jest.fn();
    const jsonFn = jest.fn();
    const host = buildHost(statusFn, jsonFn);

    filter.catch(
      new HttpException(
        { message: ['email must be valid', 'password too short'], error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );

    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        message: 'Validation failed',
        errors: { validation: ['email must be valid', 'password too short'] },
      }),
    );
  });

  it('returns { status: "error", message } for object body with single message', () => {
    const statusFn = jest.fn();
    const jsonFn = jest.fn();
    const host = buildHost(statusFn, jsonFn);

    filter.catch(
      new HttpException({ message: 'Conflict' }, HttpStatus.CONFLICT),
      host,
    );

    expect(statusFn).toHaveBeenCalledWith(409);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', message: 'Conflict' }),
    );
  });
});
