import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';

// ── Helpers ────────────────────────────────────────────────────────────────
const mockJwtService = { verify: jest.fn() };
const mockReflector = { getAllAndOverride: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue('test-secret') };

function buildContext(options: {
  authHeader?: string;
  isPublic?: boolean;
  handler?: object;
  cls?: object;
}): ExecutionContext {
  mockReflector.getAllAndOverride.mockReturnValue(options.isPublic ?? false);

  return {
    getHandler: () => options.handler ?? {},
    getClass: () => options.cls ?? {},
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization: options.authHeader },
        user: undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(
      mockJwtService as unknown as JwtService,
      mockReflector as unknown as Reflector,
      mockConfig as unknown as ConfigService,
    );
  });

  it('allows @Public() routes without a token', () => {
    const ctx = buildContext({ isPublic: true });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(mockJwtService.verify).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when Authorization header is missing', () => {
    const ctx = buildContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when token scheme is not Bearer', () => {
    const ctx = buildContext({ authHeader: 'Basic sometoken' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when token is invalid', () => {
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const ctx = buildContext({ authHeader: 'Bearer bad.token.here' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('attaches verified payload to request and returns true', () => {
    const payload = { sub: 'u1', email: 'a@a.com', role: 'USER' };
    mockJwtService.verify.mockReturnValue(payload);

    const req: Record<string, unknown> = {
      headers: { authorization: 'Bearer valid.token' },
      user: undefined,
    };
    mockReflector.getAllAndOverride.mockReturnValue(false);

    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.user).toEqual(payload);
  });
});
