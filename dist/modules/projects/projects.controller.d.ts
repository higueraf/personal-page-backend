import { Repository } from 'typeorm';
import { Project, ProjectStatus } from '../../entities/project.entity';
declare class UpsertProjectDto {
    title: string;
    slug?: string;
    description?: string;
    long_description?: string;
    tech_stack?: string[];
    url?: string;
    repo_url?: string;
    thumbnail?: string;
    order?: number;
    status?: ProjectStatus;
}
export declare class ProjectsAdminController {
    private repo;
    constructor(repo: Repository<Project>);
    list(search?: string, page?: string): Promise<{
        data: Project[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    get(id: string): Promise<{
        error: string;
        data?: undefined;
    } | {
        data: Project;
        error?: undefined;
    }>;
    create(dto: UpsertProjectDto): Promise<{
        data: Project;
    }>;
    update(id: string, dto: Partial<UpsertProjectDto>): Promise<{
        error: string;
        data?: undefined;
    } | {
        data: Project;
        error?: undefined;
    }>;
    remove(id: string): Promise<void>;
}
export declare class ProjectsPublicController {
    private repo;
    constructor(repo: Repository<Project>);
    list(search?: string, page?: string, pageSize?: string): Promise<{
        data: Project[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    featured(): Promise<{
        data: Project[];
    }>;
    get(slug: string): Promise<{
        error: string;
        data?: undefined;
    } | {
        data: Project;
        error?: undefined;
    }>;
}
export declare class ProjectsModule {
}
export {};
