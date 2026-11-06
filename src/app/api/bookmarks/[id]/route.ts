import { NextResponse } from "next/server";
import { deleteBookmark, updateBookmark } from "@/lib/bookmarks";
import {
  badRequest,
  getUserId,
  notFound,
  readJson,
  unauthorized,
} from "@/lib/http";
import { bookmarkPatch } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/bookmarks/:id  { title?, url?, description?, tags?, favorite? }
export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const body = bookmarkPatch.safeParse(await readJson(req));
  if (!body.success) return badRequest(body.error);

  const { id } = await params;
  const item = await updateBookmark(userId, id, body.data);
  return item ? NextResponse.json({ item }) : notFound();
}

// DELETE /api/bookmarks/:id
export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  return (await deleteBookmark(userId, id))
    ? new NextResponse(null, { status: 204 })
    : notFound();
}
