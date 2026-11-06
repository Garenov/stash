"use client";

import { useActionState, useEffect, useRef } from "react";
import { addBookmark, type FormState } from "@/app/actions";

type Props = {
  defaultUrl?: string;
  defaultTitle?: string;
  /** вызывается после успешного сохранения (окно bookmarklet закрывается) */
  onSaved?: () => void;
  heading?: string;
};

export function AddBookmarkForm({ defaultUrl, defaultTitle, onSaved, heading }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(addBookmark, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    onSaved?.();
  }, [state, onSaved]);

  const err = (name: string) => state.fields?.[name]?.[0];

  return (
    <form ref={formRef} action={action} className="card form">
      <h2>{heading ?? "Новая закладка"}</h2>
      {state.ok && <p className="banner-ok">Сохранено ✓</p>}
      <label>
        URL
        <input name="url" type="url" placeholder="https://…" defaultValue={defaultUrl} required />
        {err("url") && <p className="field-error">{err("url")}</p>}
      </label>
      <label>
        Название
        <input name="title" maxLength={200} defaultValue={defaultTitle} required />
        {err("title") && <p className="field-error">{err("title")}</p>}
      </label>
      <label>
        Описание
        <textarea name="description" rows={2} maxLength={1000} />
      </label>
      <label>
        Теги
        <input name="tags" placeholder="#react #db статьи" />
        {err("tags") && <p className="field-error">{err("tags")}</p>}
      </label>
      <button disabled={pending}>{pending ? "Сохраняем…" : "Добавить"}</button>
    </form>
  );
}
