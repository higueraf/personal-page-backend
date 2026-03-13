import { ExecutionContext } from '@nestjs/common';
declare const OptionalJwtAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class OptionalJwtAuthGuard extends OptionalJwtAuthGuard_base {
    canActivate(context: ExecutionContext): any;
    handleRequest(err: any, user: any): any;
}
export {};
