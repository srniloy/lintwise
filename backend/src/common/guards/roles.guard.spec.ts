import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

const mockReflector = { getAllAndOverride: jest.fn() };

function buildContext(userRole?: string, requiredRoles?: string[]): ExecutionContext {
  mockReflector.getAllAndOverride.mockReturnValue(requiredRoles ?? null);

  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: userRole ? { sub: 'u1', email: 'a@a.com', role: userRole } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(mockReflector as unknown as Reflector);
  });

  it('allows any authenticated user when no @Roles() decorator is present', () => {
    const ctx = buildContext('USER', undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows when user role matches required roles', () => {
    const ctx = buildContext('ADMIN', ['ADMIN']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows ADMIN when required roles are PREMIUM or ADMIN', () => {
    const ctx = buildContext('ADMIN', ['PREMIUM', 'ADMIN']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user role is not in required roles', () => {
    const ctx = buildContext('USER', ['ADMIN']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when USER tries to access PREMIUM route', () => {
    const ctx = buildContext('USER', ['PREMIUM', 'ADMIN']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is missing from request', () => {
    const ctx = buildContext(undefined, ['ADMIN']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
