import { Repository } from 'typeorm';
import { User, UserStatus } from '../../entities/user.entity';
import { Role } from '../../entities/role.entity';
declare class UpdateUserDto {
    status?: UserStatus;
    role_id?: string;
    is_active?: boolean;
}
export declare class UsersAdminController {
    private readonly usersRepo;
    private readonly rolesRepo;
    constructor(usersRepo: Repository<User>, rolesRepo: Repository<Role>);
    list(page?: string, pageSize?: string, status?: string, search?: string): Promise<{
        data: {
            id: string;
            first_name: string;
            last_name: string;
            email: string;
            status: UserStatus;
            is_active: boolean;
            role: {
                id: string;
                name: string;
            };
            created_at: Date;
        }[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    roles(): Promise<{
        data: {
            id: string;
            name: string;
        }[];
    }>;
    update(id: string, dto: UpdateUserDto): Promise<{
        error: string;
        data?: undefined;
    } | {
        data: {
            id: string;
            first_name: string;
            last_name: string;
            email: string;
            status: UserStatus;
            is_active: boolean;
            role: {
                id: string;
                name: string;
            };
            created_at: Date;
        };
        error?: undefined;
    }>;
    private serialize;
}
export {};
