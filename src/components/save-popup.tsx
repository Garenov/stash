"use client";

import { useCallback } from "react";
import { AddBookmarkForm } from "./add-bookmark-form";

/** Форма для окна bookmarklet: после сохранения окно закрывается само. */
export function SavePopup({ url, title }: { url: string; title: string }) {
  const onSaved = useCallback(() => {
    setTimeout(() => window.close(), 700);
  }, []);
  return (
    <AddBookmarkForm
      defaultUrl={url}
      defaultTitle={title}
      onSaved={onSaved}
      heading="Сохранить в Stash"
    />
  );
}
