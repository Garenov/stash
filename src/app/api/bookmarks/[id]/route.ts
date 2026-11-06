import { NextResponse } from "next/server";
import { deleteBookmark, DuplicateBookmarkError, updateBookmark } from "@/lib/bookmarks";
import { authenticate, badRequest, notFound, readJson } from "@/lib/http";
import { bookmarkPatch } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/bookmarks/:id  { title?, url?, description?, tags?, favorite? }
export async function PATCH(req: Request, { params }: Ctx) {
  const a = await authenticate(req);
  if (a instanceof NextResponse) return a;

  const body = bookmarkPatch.safeParse(await readJson(req));
  if (!body.success) return badRequest(body.error);

  const { id } = await params;
  try {
    const item = await updateBookmark(a.userId, id, body.data);
    return item ? NextResponse.json({ item }) : notFound();
  } catch (e) {
    if (e instanceof DuplicateBookmarkError) {
      return NextResponse.json({ error: "Already saved" }, { status: 409 });
    }
    throw e;
  }
}

// DELETE /api/bookmarks/:id
export async function DELETE(req: Request, { params }: Ctx) {
  const a = await authenticate(req);
  if (a instanceof NextResponse) return a;

  const { id } = await params;
  return (await deleteBookmark(a.userId, id))
    ? new NextResponse(null, { status: 204 })
    : notFound();
}
