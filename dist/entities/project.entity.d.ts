export declare enum ProjectStatus {
    DRAFT = "DRAFT",
    PUBLISHED = "PUBLISHED",
    ARCHIVED = "ARCHIVED"
}
export declare class Project {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    long_description: string | null;
    tech_stack: string[];
    url: string | null;
    repo_url: string | null;
    thumbnail: string | null;
    order: number;
    status: ProjectStatus;
    created_at: Date;
    updated_at: Date;
}
