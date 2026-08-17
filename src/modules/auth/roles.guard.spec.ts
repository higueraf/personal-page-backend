import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function makeGuard(requiredRoles: string[] | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) } as unknown as Reflector;
  return new RolesGuard(reflector);
}

function ctxWithUser(user: any): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows any authenticated user when no @Roles() is set on the route', () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(ctxWithUser({ role: { name: 'student' } }))).toBe(true);
  });

  it('allows a user whose role matches, case-insensitively', () => {
    const guard = makeGuard(['Teacher']);
    expect(guard.canActivate(ctxWithUser({ role: { name: 'teacher' } }))).toBe(true);
  });

  it('rejects a student from a teacher/admin-only route', () => {
    const guard = makeGuard(['admin', 'teacher']);
    expect(() => guard.canActivate(ctxWithUser({ role: { name: 'student' } }))).toThrow(ForbiddenException);
  });

  it('rejects a request without an authenticated user', () => {
    const guard = makeGuard(['admin']);
    expect(() => guard.canActivate(ctxWithUser(undefined))).toThrow(ForbiddenException);
  });
});
