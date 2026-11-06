import { NextResponse } from "next/server";
import { importBookmarks } from "@/lib/bookmarks";
import { authenticate, tooManyRequests } from "@/lib/http";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ITEMS,
  parseImport,
} from "@/lib/import-export";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/import  (multipart/form-data, поле "file")
// Принимает HTML-экспорт закладок браузера (Chrome, Firefox, Safari) или JSON из Stash.
// Папки браузера превращаются в теги. Дубли по URL пропускаются.
export async function POST(req: Request) {
  const a = await authenticate(req);
  if (a instanceof NextResponse) return a;

  const lim = await rateLimit(`import:${a.userId}`, 10, 3600);
  if (!lim.ok) return tooManyRequests(lim.retryAfter);

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Ожидается multipart/form-data с полем file" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Не передан файл" }, { status: 400 });
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: "Файл больше 5 МБ" }, { status: 413 });
  }

  const items = parseImport(file.name, await file.text());
  if (items.length === 0) {
    return NextResponse.json({ error: "В файле не найдено ни одной ссылки" }, { status: 400 });
  }
  if (items.length > MAX_IMPORT_ITEMS) {
    return NextResponse.json(
      { error: `Слишком много ссылок: ${items.length}, максимум ${MAX_IMPORT_ITEMS}` },
      { status: 413 },
    );
  }

  const result = await importBookmarks(a.userId, items);
  return NextResponse.json({ total: items.length, ...result });
}
