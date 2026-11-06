import Link from "next/link";
import { auth } from "@/auth";
import { SavePopup } from "@/components/save-popup";

export default async function SavePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; title?: string }>;
}) {
  const sp = await searchParams;
  const url = sp.url && /^https?:\/\//i.test(sp.url) ? sp.url.slice(0, 2048) : "";
  const title = (sp.title ?? "").slice(0, 200);

  const session = await auth();
  if (!session?.user) {
    const back = `/save?${new URLSearchParams({ url, title })}`;
    return (
      <main className="container narrow">
        <div className="card form">
          <p>Войдите в Stash, чтобы сохранить эту ссылку.</p>
          <Link className="button" href={`/login?callbackUrl=${encodeURIComponent(back)}`}>
            Войти
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container narrow popup">
      <SavePopup url={url} title={title} />
    </main>
  );
}
