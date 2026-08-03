# AppFolio API v2 — Auth & Client

## Environment variables

```
APPFOLIO_CLIENT_ID=your_client_id
APPFOLIO_CLIENT_SECRET=your_client_secret
APPFOLIO_SUBDOMAIN=yourcompany.appfolio.com   # full hostname, no https://
```

## Base client (lib/appfolio.ts)

```typescript
/**
 * Server-side AppFolio API v2 client.
 * Only import from server components, actions, or API routes.
 */

function authHeader(): string {
  const clientId = process.env.APPFOLIO_CLIENT_ID;
  const clientSecret = process.env.APPFOLIO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("APPFOLIO_CLIENT_ID and APPFOLIO_CLIENT_SECRET must be set");
  }
  const token = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${token}`;
}

function subdomain(): string {
  const s = process.env.APPFOLIO_SUBDOMAIN;
  if (!s) throw new Error("APPFOLIO_SUBDOMAIN must be set");
  return s;
}

/** Generic paginated report fetcher. Returns all rows across all pages. */
export async function fetchReport<T>(
  reportName: string,
  filters: Record<string, unknown> = {},
): Promise<T[]> {
  const auth = authHeader();
  let url: string | null =
    `https://${subdomain()}/api/v2/reports/${reportName}.json`;
  const rows: T[] = [];

  while (url) {
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ paginate_results: true, ...filters }),
      cache: "no-store",
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`AppFolio API error ${resp.status} on ${reportName}: ${body}`);
    }

    const data: unknown = await resp.json();
    const pageRows: T[] = Array.isArray(data)
      ? data
      : ((data as Record<string, unknown>).results as T[] ?? []);
    rows.push(...pageRows);
    url =
      typeof (data as Record<string, unknown>)?.next_page_url === "string"
        ? ((data as Record<string, unknown>).next_page_url as string)
        : null;
  }

  return rows;
}
```

## Rate limiting notes

AppFolio's v2 API does not publish a hard rate limit, but in practice:
- Stay under 3 requests/second to avoid 429s
- For bulk syncs hitting multiple reports, add a small delay between report fetches if you're seeing throttling
- Pagination requests (following `next_page_url`) count toward rate limits

## Error handling pattern

The `fetchReport` helper throws on non-2xx responses. Wrap call sites:

```typescript
let rows;
try {
  rows = await fetchReport<MyRowType>("report_name", filters);
} catch (e) {
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "AppFolio fetch failed" },
    { status: 502 },
  );
}
```
