import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logout, removeBookmark, toggleFavorite } from "@/app/actions";
import { AddBookmarkForm } from "@/components/add-bookmark-form";
import { listBookmarks, listTags } from "@/lib/bookmarks";

type SearchParams = Promise<{ q?: string; tag?: string; fav?: string }>;

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function href(params: { q?: string; tag?: string; fav?: string }): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const userId = session.user.id;

  const [items, tags] = await Promise.all([
    listBookmarks(userId, {
      q: sp.q?.trim() || undefined,
      tag: sp.tag?.trim().toLowerCase() || undefined,
      favorite: sp.fav === "1",
    }),
    listTags(userId),
  ]);

  const filtered = Boolean(sp.q || sp.tag || sp.fav);

  return (
    <main className="container">
      <header className="topbar">
        <strong>Stash</strong>
        <div className="row">
          <span className="muted">{session.user.name ?? session.user.email}</span>
          <form action={logout}>
            <button className="ghost small">Выйти</button>
          </form>
        </div>
      </header>

      <div className="layout">
        <aside>
          <AddBookmarkForm />
          {tags.length > 0 && (
            <div className="card">
              <h2>Теги</h2>
              <div className="chips">
                {tags.map(({ tag, count }) => (
                  <Link
                    key={tag}
                    className={`chip${sp.tag === tag ? " active" : ""}`}
                    href={href({ q: sp.q, fav: sp.fav, tag })}
                  >
                    #{tag} <span className="muted">{count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section>
          <form className="row search" action="/dashboard">
            <input
              name="q"
              defaultValue={sp.q}
              placeholder="Поиск по названию, ссылке, описанию"
            />
            {sp.tag && <input type="hidden" name="tag" value={sp.tag} />}
            {sp.fav === "1" && <input type="hidden" name="fav" value="1" />}
            <button>Найти</button>
            <Link
              className={`button ghost${sp.fav === "1" ? " active" : ""}`}
              href={href({ q: sp.q, tag: sp.tag, fav: sp.fav === "1" ? undefined : "1" })}
            >
              ★ Избранное
            </Link>
            {filtered && (
              <Link className="button ghost" href="/dashboard">
                Сбросить
              </Link>
            )}
          </form>

          {items.length === 0 ? (
            <p className="muted empty">
              {filtered ? "Ничего не найдено." : "Пока пусто — добавьте первую закладку."}
            </p>
          ) : (
            <ul className="list">
              {items.map((b) => (
                <li key={b.id} className="card item">
                  <div className="item-main">
                    <a href={b.url} target="_blank" rel="noopener noreferrer nofollow">
                      {b.title}
                    </a>
                    <span className="muted">
                      {hostname(b.url)} · {b.createdAt.toLocaleDateString("ru-RU")}
                    </span>
                    {b.description && <p>{b.description}</p>}
                    {b.tags.length > 0 && (
                      <div className="chips">
                        {b.tags.map((t) => (
                          <Link
                            key={t}
                            className="chip"
                            href={href({ q: sp.q, fav: sp.fav, tag: t })}
                          >
                            #{t}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="item-actions">
                    <form action={toggleFavorite.bind(null, b.id)}>
                      <button
                        className="ghost small"
                        aria-label={b.favorite ? "Убрать из избранного" : "В избранное"}
                      >
                        {b.favorite ? "★" : "☆"}
                      </button>
                    </form>
                    <form action={removeBookmark.bind(null, b.id)}>
                      <button className="ghost small danger" aria-label="Удалить">
                        ✕
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
