export declare enum ContactMessageStatus {
    PENDING = "PENDING",
    READ = "READ",
    REPLIED = "REPLIED"
}
export declare class ContactMessage {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    subject: string;
    message: string;
    status: ContactMessageStatus;
    created_at: Date;
    updated_at: Date;
}
