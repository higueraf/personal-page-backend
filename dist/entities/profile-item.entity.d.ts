export declare enum ProfileItemType {
    EXPERIENCE = "EXPERIENCE",
    EDUCATION = "EDUCATION",
    CERTIFICATION = "CERTIFICATION",
    SKILL = "SKILL",
    LANGUAGE = "LANGUAGE",
    AWARD = "AWARD",
    PUBLICATION = "PUBLICATION",
    VOLUNTEER = "VOLUNTEER"
}
export declare class ProfileItem {
    id: string;
    type: ProfileItemType;
    title: string;
    subtitle: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    description: string | null;
    tags: string[];
    url: string | null;
    logo: string | null;
    order: number;
    is_visible: boolean;
    created_at: Date;
    updated_at: Date;
}
