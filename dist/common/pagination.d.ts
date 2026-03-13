export declare function paginate<T>(items: T[], page?: number, pageSize?: number): {
    data: T[];
    meta: {
        total_records: number;
        page: number;
        page_size: number;
    };
};
