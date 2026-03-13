export function paginate<T>(items: T[], page = 1, pageSize = 50) {
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const safePageSize = Number(pageSize) > 0 ? Number(pageSize) : 50;
  const start = (safePage - 1) * safePageSize;
  return {
    data: items.slice(start, start + safePageSize),
    meta: {
      total_records: items.length,
      page: safePage,
      page_size: safePageSize,
    },
  };
}
