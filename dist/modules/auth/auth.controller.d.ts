import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto, res: Response): Promise<{
        jwt: string;
    }>;
    register(dto: RegisterDto): Promise<{
        data: {
            id: string;
            first_name: string;
            last_name: string;
            email: string;
            role: {
                name: string;
                permissions: string[];
            };
            permissions: string[];
            status: import("../../entities/user.entity").UserStatus;
            is_active: boolean;
        };
    }>;
    logout(res: Response): {
        ok: boolean;
    };
    me(req: Request & {
        user: any;
    }): {
        data: {
            id: string;
            first_name: string;
            last_name: string;
            email: string;
            role: {
                name: string;
                permissions: string[];
            };
            permissions: string[];
            status: import("../../entities/user.entity").UserStatus;
            is_active: boolean;
        };
    };
}
