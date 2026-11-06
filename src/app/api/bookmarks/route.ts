import { NextResponse } from "next/server";
import { createBookmark, DuplicateBookmarkError, listBookmarks } from "@/lib/bookmarks";
import { authenticate, badRequest, readJson } from "@/lib/http";
import { bookmarkInput, listQuery } from "@/lib/validation";

// GET /api/bookmarks?q=react %23db&tag=...&favorite=1&broken=1&page=1&limit=20
// В q слова ищутся полнотекстово, слова с # фильтруют по тегу.
export async function GET(req: Request) {
  const a = await authenticate(req);
  if (a instanceof NextResponse) return a;

  const query = listQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!query.success) return badRequest(query.error);

  const { items, total } = await listBookmarks(a.userId, query.data);
  return NextResponse.json({
    items,
    total,
    page: query.data.page,
    pageSize: query.data.limit,
  });
}

// POST /api/bookmarks  { url, title, description?, tags? }
export async function POST(req: Request) {
  const a = await authenticate(req);
  if (a instanceof NextResponse) return a;

  const body = bookmarkInput.safeParse(await readJson(req));
  if (!body.success) return badRequest(body.error);

  try {
    const item = await createBookmark(a.userId, body.data);
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    if (e instanceof DuplicateBookmarkError) {
      return NextResponse.json({ error: "Already saved" }, { status: 409 });
    }
    throw e;
  }
}
