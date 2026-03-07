export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  /** ISO 8601 date - return only items updated after this (for incremental sync) */
  updatedAtAfter?: string;
}
