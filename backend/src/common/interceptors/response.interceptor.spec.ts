import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

function buildContext(): ExecutionContext {
  return {} as ExecutionContext;
}

function buildHandler<T>(data: T): CallHandler<T> {
  return { handle: () => of(data) };
}

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  it('wraps plain object in { status: "success", data }', (done) => {
    const payload = { id: '1', name: 'Alice' };

    interceptor
      .intercept(buildContext(), buildHandler(payload))
      .subscribe((result) => {
        expect(result).toEqual({ status: 'success', data: payload });
        done();
      });
  });

  it('wraps null in { status: "success", data: null }', (done) => {
    interceptor
      .intercept(buildContext(), buildHandler(null))
      .subscribe((result) => {
        expect(result).toEqual({ status: 'success', data: null });
        done();
      });
  });

  it('wraps array in { status: "success", data: [...] }', (done) => {
    const list = [1, 2, 3];

    interceptor
      .intercept(buildContext(), buildHandler(list))
      .subscribe((result) => {
        expect(result).toEqual({ status: 'success', data: list });
        done();
      });
  });
});
