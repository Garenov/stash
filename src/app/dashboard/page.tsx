import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logout, removeBookmark, toggleFavorite } from "@/app/actions";
import { AddBookmarkForm } from "@/components/add-bookmark-form";
import { CheckLinks } from "@/components/check-links";
import { EditBookmark } from "@/components/edit-bookmark";
import { listBookmarks, listTags } from "@/lib/bookmarks";

// «Проверить ссылки» вызывается как server action этой страницы
export const maxDuration = 60;

const PAGE_SIZE = 20;

type Params = { q?: string; tag?: string; fav?: string; broken?: string; page?: string };

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function href(params: Params): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const userId = session.user.id;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [{ items, total }, tags] = await Promise.all([
    listBookmarks(userId, {
      q: sp.q?.trim() || undefined,
      tag: sp.tag?.trim() || undefined,
      favorite: sp.fav === "1",
      broken: sp.broken === "1",
      page,
      limit: PAGE_SIZE,
    }),
    listTags(userId),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(sp.q || sp.tag || sp.fav || sp.broken);
  const keep = { q: sp.q, tag: sp.tag, fav: sp.fav, broken: sp.broken };

  return (
    <main className="container">
      <header className="topbar">
        <strong>Stash</strong>
        <div className="row">
          <Link href="/settings">Настройки</Link>
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
                    href={href({ ...keep, tag, page: undefined })}
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
              placeholder="Слова и #теги: react hooks #db"
              aria-label="Поиск"
            />
            {sp.tag && <input type="hidden" name="tag" value={sp.tag} />}
            {sp.fav === "1" && <input type="hidden" name="fav" value="1" />}
            {sp.broken === "1" && <input type="hidden" name="broken" value="1" />}
            <button>Найти</button>
          </form>

          <div className="row filters">
            <Link
              className={`button ghost small${sp.fav === "1" ? " active" : ""}`}
              href={href({ ...keep, fav: sp.fav === "1" ? undefined : "1", page: undefined })}
            >
              ★ Избранное
            </Link>
            <Link
              className={`button ghost small${sp.broken === "1" ? " active" : ""}`}
              href={href({ ...keep, broken: sp.broken === "1" ? undefined : "1", page: undefined })}
            >
              ⚠ Битые ссылки
            </Link>
            {filtered && (
              <Link className="button ghost small" href="/dashboard">
                Сбросить
              </Link>
            )}
            <CheckLinks />
          </div>

          <p className="muted">Найдено: {total}</p>

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
                      {b.linkStatus === "broken" && (
                        <span className="badge-broken" title={b.linkError ?? undefined}>
                          {" "}
                          · не открывается{b.httpStatus ? ` (${b.httpStatus})` : ""}
                        </span>
                      )}
                    </span>
                    {b.description && <p>{b.description}</p>}
                    {b.tags.length > 0 && (
                      <div className="chips">
                        {b.tags.map((t) => (
                          <Link
                            key={t}
                            className="chip"
                            href={href({ ...keep, tag: t, page: undefined })}
                          >
                            #{t}
                          </Link>
                        ))}
                      </div>
                    )}
                    <EditBookmark
                      id={b.id}
                      url={b.url}
                      title={b.title}
                      description={b.description}
                      tags={b.tags}
                    />
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

          {pages > 1 && (
            <nav className="row pager" aria-label="Страницы">
              {page > 1 && (
                <Link className="button ghost small" href={href({ ...keep, page: String(page - 1) })}>
                  ← Назад
                </Link>
              )}
              <span className="muted">
                {page} / {pages}
              </span>
              {page < pages && (
                <Link className="button ghost small" href={href({ ...keep, page: String(page + 1) })}>
                  Вперёд →
                </Link>
              )}
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}
