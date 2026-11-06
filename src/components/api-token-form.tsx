"use client";

import { useActionState } from "react";
import { createToken, type TokenState } from "@/app/settings/actions";

export function ApiTokenForm() {
  const [state, action, pending] = useActionState<TokenState, FormData>(createToken, {});
  return (
    <div>
      <form action={action} className="row">
        <input name="name" placeholder="Название, например: скрипт на сервере" maxLength={60} required />
        <button disabled={pending}>Создать токен</button>
      </form>
      {state.error && <p className="banner-error">{state.error}</p>}
      {state.token && (
        <div className="token-once">
          <p>
            Скопируйте токен сейчас, <strong>потом он не будет показан</strong>:
          </p>
          <code>{state.token}</code>
        </div>
      )}
    </div>
  );
}
