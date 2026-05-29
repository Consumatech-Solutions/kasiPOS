import type { AppNotification } from "@/types/notifications";
import type { PaginationMeta } from "@/types/pagination";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function coerceNotification(raw: unknown): AppNotification | null {
  if (!isRecord(raw)) return null;
  const id = raw.id != null ? String(raw.id) : "";
  const title = raw.title != null ? String(raw.title) : "";
  const body = raw.body != null ? String(raw.body) : "";
  const type = raw.type != null ? String(raw.type) : "credit_payment_reminder";
  const createdAt =
    raw.createdAt != null ? String(raw.createdAt) : new Date().toISOString();
  if (id === "" || title === "") return null;

  return {
    id,
    type: type as AppNotification["type"],
    title,
    body,
    readAt: raw.readAt != null && raw.readAt !== "" ? String(raw.readAt) : null,
    createdAt,
    metadata: (raw.metadata as AppNotification["metadata"]) ?? null,
  };
}

export function parseUnreadCountResponse(data: unknown): number {
  if (!isRecord(data)) return 0;
  if (typeof data.count === "number") return data.count;
  if (typeof data.unreadCount === "number") return data.unreadCount;
  if (isRecord(data.data)) {
    if (typeof data.data.count === "number") return data.data.count;
    if (typeof data.data.unreadCount === "number") return data.data.unreadCount;
  }
  return 0;
}

export function normalizeNotificationsResponse(body: unknown): {
  data: AppNotification[];
  meta: PaginationMeta;
} {
  const emptyMeta: PaginationMeta = {
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  };

  if (Array.isArray(body)) {
    const data = body
      .map(coerceNotification)
      .filter((n): n is AppNotification => n != null);
    return {
      data,
      meta: {
        total: data.length,
        page: 1,
        limit: data.length || 20,
        totalPages: 1,
      },
    };
  }

  if (!isRecord(body)) {
    return { data: [], meta: emptyMeta };
  }

  const listCandidate =
    body.data ?? body.notifications ?? body.items ?? body.results;

  if (Array.isArray(listCandidate)) {
    const data = listCandidate
      .map(coerceNotification)
      .filter((n): n is AppNotification => n != null);
    const meta = isRecord(body.meta)
      ? (body.meta as PaginationMeta)
      : {
          total: typeof body.total === "number" ? body.total : data.length,
          page: typeof body.page === "number" ? body.page : 1,
          limit: typeof body.limit === "number" ? body.limit : 20,
          totalPages:
            typeof body.totalPages === "number"
              ? body.totalPages
              : Math.ceil(data.length / 20) || 1,
        };
    return { data, meta };
  }

  if (isRecord(body.data) && Array.isArray(body.data.data)) {
    return normalizeNotificationsResponse(body.data);
  }

  return { data: [], meta: emptyMeta };
}
