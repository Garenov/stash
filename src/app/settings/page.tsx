import { eq } from "drizzle-orm";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import { ApiTokenForm } from "@/components/api-token-form";
import { Bookmarklet } from "@/components/bookmarklet";
import { ImportPanel } from "@/components/import-panel";
import { TwoFactorPanel } from "@/components/two-factor-panel";
import { revokeToken } from "./actions";
import { listApiTokens } from "@/lib/tokens";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) redirect("/login");

  const [tokens, linked] = await Promise.all([
    listApiTokens(userId),
    db.select({ provider: accounts.provider }).from(accounts).where(eq(accounts.userId, userId)),
  ]);

  const host = (await headers()).get("host") ?? "localhost:3000";
  const origin = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  return (
    <main className="container narrow-wide">
      <header className="topbar">
        <strong>Настройки</strong>
        <Link href="/dashboard">← К закладкам</Link>
      </header>

      <section className="card">
        <h2>Аккаунт</h2>
        <p>
          {user.name} · <span className="muted">{user.email}</span>
        </p>
        {linked.length > 0 && (
          <p className="muted">Вход через: {linked.map((l) => l.provider).join(", ")}</p>
        )}
      </section>

      <section className="card">
        <h2>Двухфакторная аутентификация</h2>
        <TwoFactorPanel
          enabled={user.totpEnabled}
          hasPassword={Boolean(user.passwordHash)}
          recoveryLeft={user.recoveryCodes?.length ?? 0}
        />
      </section>

      <section className="card">
        <h2>Сохранение с любой страницы</h2>
        <Bookmarklet />
      </section>

      <section className="card">
        <h2>Импорт и экспорт</h2>
        <ImportPanel />
        <p className="row">
          Скачать: <a href="/api/export?format=json">JSON</a>
          <a href="/api/export?format=html">HTML (для браузеров)</a>
        </p>
      </section>

      <section className="card">
        <h2>API-токены</h2>
        <p className="muted">
          Для скриптов и расширений. Токен даёт полный доступ к вашим закладкам, храните его как пароль.
        </p>
        <ApiTokenForm />

        {tokens.length > 0 && (
          <ul className="token-list">
            {tokens.map((t) => (
              <li key={t.id} className="row">
                <div>
                  <strong>{t.name}</strong>{" "}
                  <code>{t.prefix}…</code>
                  <div className="muted">
                    создан {t.createdAt.toLocaleDateString("ru-RU")} ·{" "}
                    {t.lastUsedAt
                      ? `использован ${t.lastUsedAt.toLocaleDateString("ru-RU")}`
                      : "не использовался"}
                  </div>
                </div>
                <form action={revokeToken.bind(null, t.id)}>
                  <button className="ghost small danger">Отозвать</button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <details>
          <summary>Пример использования</summary>
          <pre>{`curl -H "Authorization: Bearer stash_..." \\
  "${origin}/api/bookmarks?q=react%20%23db"

curl -X POST -H "Authorization: Bearer stash_..." \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com","title":"Example","tags":["demo"]}' \\
  ${origin}/api/bookmarks`}</pre>
        </details>
      </section>
    </main>
  );
}
