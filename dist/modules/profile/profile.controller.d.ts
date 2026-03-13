import { Repository } from 'typeorm';
import { ProfileItem, ProfileItemType } from '../../entities/profile-item.entity';
declare class UpsertProfileItemDto {
    type: ProfileItemType;
    title: string;
    subtitle?: string;
    location?: string;
    start_date?: string;
    end_date?: string;
    description?: string;
    tags?: string[];
    url?: string;
    logo?: string;
    order?: number;
    is_visible?: boolean;
}
export declare class ProfileAdminController {
    private repo;
    constructor(repo: Repository<ProfileItem>);
    list(type?: string): Promise<{
        data: ProfileItem[];
    }>;
    get(id: string): Promise<{
        data: ProfileItem;
        error?: undefined;
    } | {
        error: string;
        data?: undefined;
    }>;
    create(dto: UpsertProfileItemDto): Promise<{
        data: ProfileItem;
    }>;
    update(id: string, dto: Partial<UpsertProfileItemDto>): Promise<{
        error: string;
        data?: undefined;
    } | {
        data: ProfileItem;
        error?: undefined;
    }>;
    remove(id: string): Promise<void>;
}
export declare class ProfilePublicController {
    private repo;
    constructor(repo: Repository<ProfileItem>);
    all(type?: string): Promise<{
        data: ProfileItem[];
    }>;
}
export {};
