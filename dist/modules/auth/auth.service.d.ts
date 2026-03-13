import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
import { RegisterDto } from './dto/register.dto';
export declare class AuthService {
    private readonly usersRepo;
    private readonly rolesRepo;
    private readonly jwtService;
    constructor(usersRepo: Repository<User>, rolesRepo: Repository<Role>, jwtService: JwtService);
    validateUser(email: string, password: string): Promise<User>;
    sign(user: User): string;
    register(dto: RegisterDto): Promise<{
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        role: {
            name: string;
            permissions: string[];
        };
        permissions: string[];
        status: UserStatus;
        is_active: boolean;
    }>;
    findUserForJwt(id: string): Promise<User>;
    publicUser(user: User): {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        role: {
            name: string;
            permissions: string[];
        };
        permissions: string[];
        status: UserStatus;
        is_active: boolean;
    };
}
