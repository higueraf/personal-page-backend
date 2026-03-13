import { Role } from './role.entity';
export declare enum UserStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    SUSPENDED = "SUSPENDED",
    REJECTED = "REJECTED"
}
export declare class User {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    password_hash: string;
    role: Role;
    status: UserStatus;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
