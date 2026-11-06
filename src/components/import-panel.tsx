"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ImportPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/import", { method: "POST", body: new FormData(form) });
      const data = (await res.json().catch(() => ({}))) as {
        added?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? `Ошибка ${res.status}` });
      } else {
        setMessage({
          ok: true,
          text: `Добавлено: ${data.added}. Пропущено дублей: ${data.skipped}.`,
        });
        form.reset();
        router.refresh();
      }
    } catch {
      setMessage({ ok: false, text: "Не удалось отправить файл" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="row">
        <input name="file" type="file" accept=".html,.htm,.json" required />
        <button disabled={busy}>{busy ? "Импортируем…" : "Импортировать"}</button>
      </form>
      <p className="muted">
        Экспорт закладок из Chrome, Firefox или Safari (.html) либо JSON из Stash. Папки браузера
        станут тегами.
      </p>
      {message && <p className={message.ok ? "banner-ok" : "banner-error"}>{message.text}</p>}
    </div>
  );
}
