"use client";

import { useActionState, useEffect, useRef } from "react";
import { addBookmark, type FormState } from "@/app/actions";

export function AddBookmarkForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addBookmark,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // после успешного добавления очищаем форму
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const err = (name: string) => state.fields?.[name]?.[0];

  return (
    <form ref={formRef} action={action} className="card form">
      <h2>Новая закладка</h2>
      <label>
        URL
        <input name="url" type="url" placeholder="https://…" required />
        {err("url") && <p className="field-error">{err("url")}</p>}
      </label>
      <label>
        Название
        <input name="title" maxLength={200} required />
        {err("title") && <p className="field-error">{err("title")}</p>}
      </label>
      <label>
        Описание
        <textarea name="description" rows={2} maxLength={1000} />
      </label>
      <label>
        Теги через запятую
        <input name="tags" placeholder="react, db, статьи" />
        {err("tags") && <p className="field-error">{err("tags")}</p>}
      </label>
      <button disabled={pending}>{pending ? "Сохраняем…" : "Добавить"}</button>
    </form>
  );
}
