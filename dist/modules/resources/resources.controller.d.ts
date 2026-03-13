import { Repository } from 'typeorm';
import { Resource, ResourceType } from '../../entities/resource.entity';
declare class UpsertResourceDto {
    title: string;
    description?: string;
    type?: ResourceType;
    url?: string;
    tags?: string[];
    is_free?: boolean;
    is_published?: boolean;
    order?: number;
}
export declare class ResourcesAdminController {
    private repo;
    constructor(repo: Repository<Resource>);
    list(search?: string, page?: string): Promise<{
        data: Resource[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    get(id: string): Promise<{
        data: Resource;
        error?: undefined;
    } | {
        error: string;
        data?: undefined;
    }>;
    create(dto: UpsertResourceDto): Promise<{
        data: Resource;
    }>;
    update(id: string, dto: Partial<UpsertResourceDto>): Promise<{
        error: string;
        data?: undefined;
    } | {
        data: Resource;
        error?: undefined;
    }>;
    remove(id: string): Promise<void>;
}
export declare class ResourcesPublicController {
    private repo;
    constructor(repo: Repository<Resource>);
    list(search?: string, page?: string, pageSize?: string): Promise<{
        data: Resource[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
}
export {};
