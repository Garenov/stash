"use client";

import { useActionState } from "react";
import { checkMyLinks, type CheckState } from "@/app/actions";

export function CheckLinks() {
  const [state, action, pending] = useActionState<CheckState, FormData>(checkMyLinks, null);
  return (
    <form action={action} className="row">
      <button className="ghost" disabled={pending}>
        {pending ? "Проверяем…" : "Проверить ссылки"}
      </button>
      {state?.error && <span className="field-error">{state.error}</span>}
      {state && !state.error && (
        <span className="muted">
          {state.checked === 0
            ? "Все ссылки уже проверены недавно"
            : `Проверено: ${state.checked}, не открылось: ${state.broken}`}
        </span>
      )}
    </form>
  );
}
