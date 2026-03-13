export declare enum ResourceType {
    LINK = "LINK",
    BOOK = "BOOK",
    TOOL = "TOOL",
    COURSE = "COURSE",
    VIDEO = "VIDEO",
    ARTICLE = "ARTICLE",
    OTHER = "OTHER"
}
export declare class Resource {
    id: string;
    title: string;
    description: string | null;
    type: ResourceType;
    url: string | null;
    tags: string[];
    is_free: boolean;
    is_published: boolean;
    order: number;
    created_at: Date;
    updated_at: Date;
}
