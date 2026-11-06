"use client";

import { useActionState, useEffect, useRef } from "react";
import { editBookmark, type FormState } from "@/app/actions";

type Props = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  tags: string[];
};

export function EditBookmark({ id, url, title, description, tags }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    editBookmark.bind(null, id),
    {},
  );
  const ref = useRef<HTMLDetailsElement>(null);

  // закрываем форму после успешного сохранения
  useEffect(() => {
    if (state.ok && ref.current) ref.current.open = false;
  }, [state]);

  const err = (name: string) => state.fields?.[name]?.[0];

  return (
    <details ref={ref} className="edit">
      <summary>Изменить</summary>
      <form action={action} className="form">
        {state.error && <p className="banner-error">{state.error}</p>}
        <label>
          URL
          <input name="url" type="url" defaultValue={url} required />
          {err("url") && <p className="field-error">{err("url")}</p>}
        </label>
        <label>
          Название
          <input name="title" defaultValue={title} maxLength={200} required />
          {err("title") && <p className="field-error">{err("title")}</p>}
        </label>
        <label>
          Описание
          <textarea name="description" rows={2} maxLength={1000} defaultValue={description ?? ""} />
        </label>
        <label>
          Теги
          <input name="tags" defaultValue={tags.map((t) => `#${t}`).join(" ")} />
          {err("tags") && <p className="field-error">{err("tags")}</p>}
        </label>
        <button disabled={pending}>{pending ? "Сохраняем…" : "Сохранить"}</button>
      </form>
    </details>
  );
}
