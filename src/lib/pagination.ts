export function getPagination(request: Request, defaultLimit = 25, maxLimit = 100) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
  const rawLimit = Number(url.searchParams.get("limit") || String(defaultLimit)) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { page, limit, from, to };
}

export function paginationMeta(count: number | null, page: number, limit: number) {
  const total = count ?? 0;
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
