"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register, type FormState } from "@/app/actions";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="field-error">{messages[0]}</p>;
}

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="card form">
      <h1>Вход</h1>
      {state.error && <p className="banner-error">{state.error}</p>}
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Пароль
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button disabled={pending}>{pending ? "Входим…" : "Войти"}</button>
      <p className="muted">
        Нет аккаунта? <Link href="/register">Регистрация</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(register, {});
  return (
    <form action={action} className="card form">
      <h1>Регистрация</h1>
      {state.error && <p className="banner-error">{state.error}</p>}
      <label>
        Имя
        <input name="name" autoComplete="name" required />
        <FieldError messages={state.fields?.name} />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
        <FieldError messages={state.fields?.email} />
      </label>
      <label>
        Пароль
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
        <FieldError messages={state.fields?.password} />
      </label>
      <button disabled={pending}>{pending ? "Создаём…" : "Создать аккаунт"}</button>
      <p className="muted">
        Уже есть аккаунт? <Link href="/login">Войти</Link>
      </p>
    </form>
  );
}
