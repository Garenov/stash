import { NextResponse } from "next/server";
import { createBookmark, listBookmarks } from "@/lib/bookmarks";
import { badRequest, getUserId, readJson, unauthorized } from "@/lib/http";
import { bookmarkInput, listQuery } from "@/lib/validation";

// GET /api/bookmarks?q=...&tag=...&favorite=1
export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const query = listQuery.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!query.success) return badRequest(query.error);

  return NextResponse.json({ items: await listBookmarks(userId, query.data) });
}

// POST /api/bookmarks  { url, title, description?, tags? }
export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = bookmarkInput.safeParse(await readJson(req));
  if (!body.success) return badRequest(body.error);

  const item = await createBookmark(userId, body.data);
  return NextResponse.json({ item }, { status: 201 });
}
