"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { login, register, type FormState } from "@/app/actions";
import { Honeypot, resetTurnstile, Turnstile } from "./turnstile";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="field-error">{messages[0]}</p>;
}

export function LoginForm({ callbackUrl, notice }: { callbackUrl: string; notice?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});

  // токен капчи одноразовый
  useEffect(() => {
    resetTurnstile();
  }, [state]);

  // Шаг 2: у аккаунта включена 2FA
  if (state.ticket) {
    return (
      <form action={action} className="card form">
        <h1>Код подтверждения</h1>
        <p className="muted">
          Введите 6-значный код из приложения-аутентификатора или один из recovery-кодов.
        </p>
        {state.error && <p className="banner-error">{state.error}</p>}
        <input type="hidden" name="ticket" value={state.ticket} />
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <label>
          Код
          <input name="code" autoComplete="one-time-code" autoFocus required />
        </label>
        <button disabled={pending}>{pending ? "Проверяем…" : "Подтвердить"}</button>
      </form>
    );
  }

  const message = state.error ?? notice;
  return (
    <form action={action} className="card form">
      <h1>Вход</h1>
      {message && <p className="banner-error">{message}</p>}
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <Honeypot />
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Пароль
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <Turnstile />
      <button disabled={pending}>{pending ? "Входим…" : "Войти"}</button>
      <p className="muted">
        Нет аккаунта? <Link href="/register">Регистрация</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(register, {});

  useEffect(() => {
    resetTurnstile();
  }, [state]);

  return (
    <form action={action} className="card form">
      <h1>Регистрация</h1>
      {state.error && <p className="banner-error">{state.error}</p>}
      <Honeypot />
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
      <Turnstile />
      <button disabled={pending}>{pending ? "Создаём…" : "Создать аккаунт"}</button>
      <p className="muted">
        Уже есть аккаунт? <Link href="/login">Войти</Link>
      </p>
    </form>
  );
}
