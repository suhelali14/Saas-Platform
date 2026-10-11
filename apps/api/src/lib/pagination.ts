// Ported from SAAS/backend/src/lib/utils.ts (getPaginationParams/
// createPaginatedResult) -- shared across every biz-* list endpoint.
export interface PaginationParams {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export function getPaginationParams(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page ?? ""), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? ""), 10) || 20));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export function createPaginatedResult<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);
  return { data, pagination: { page, limit, total, totalPages, hasMore: page < totalPages } };
}
