import { NextResponse } from "next/server";
import { exportAll } from "@/lib/bookmarks";
import { authenticate } from "@/lib/http";
import { toJson, toNetscapeHtml } from "@/lib/import-export";

// GET /api/export?format=json|html
export async function GET(req: Request) {
  const a = await authenticate(req);
  if (a instanceof NextResponse) return a;

  const format = new URL(req.url).searchParams.get("format") === "html" ? "html" : "json";
  const items = await exportAll(a.userId);

  const body = format === "html" ? toNetscapeHtml(items) : toJson(items);
  return new NextResponse(body, {
    headers: {
      "Content-Type":
        format === "html" ? "text/html; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="stash-export.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
