import { Repository } from 'typeorm';
import { ContactInfo } from '../../entities/contact-info.entity';
import { ContactMessage, ContactMessageStatus } from '../../entities/contact-message.entity';
declare class SendMessageDto {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
}
declare class UpsertContactInfoDto {
    key: string;
    label: string;
    value: string;
    icon?: string;
    is_visible?: boolean;
    order?: number;
}
export declare class ContactPublicController {
    private infoRepo;
    private msgRepo;
    constructor(infoRepo: Repository<ContactInfo>, msgRepo: Repository<ContactMessage>);
    info(): Promise<{
        data: ContactInfo[];
    }>;
    send(dto: SendMessageDto): Promise<{
        data: {
            id: string;
            ok: boolean;
        };
    }>;
}
export declare class ContactAdminController {
    private infoRepo;
    private msgRepo;
    constructor(infoRepo: Repository<ContactInfo>, msgRepo: Repository<ContactMessage>);
    listInfo(): Promise<{
        data: ContactInfo[];
    }>;
    upsertInfo(dto: UpsertContactInfoDto): Promise<{
        data: ContactInfo;
    }>;
    updateInfo(id: string, dto: Partial<UpsertContactInfoDto>): Promise<{
        error: string;
        data?: undefined;
    } | {
        data: ContactInfo;
        error?: undefined;
    }>;
    listMessages(status?: string, page?: string): Promise<{
        data: ContactMessage[];
        meta: {
            total_records: number;
            page: number;
            page_size: number;
        };
    }>;
    getMessage(id: string): Promise<{
        error: string;
        data?: undefined;
    } | {
        data: ContactMessage;
        error?: undefined;
    }>;
    updateMessage(id: string, body: {
        status: ContactMessageStatus;
    }): Promise<{
        error: string;
        data?: undefined;
    } | {
        data: ContactMessage;
        error?: undefined;
    }>;
}
export {};
