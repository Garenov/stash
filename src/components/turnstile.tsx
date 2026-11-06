"use client";

import Script from "next/script";

declare global {
  interface Window {
    turnstile?: { reset: (widget?: string) => void };
  }
}

/** Виджет Cloudflare Turnstile. Без ключа ничего не рендерит. Токен попадает в форму сам. */
export function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="auto" />
    </>
  );
}

/** Токен одноразовый: после каждой отправки формы виджет нужно сбрасывать. */
export function resetTurnstile() {
  window.turnstile?.reset();
}

/** Скрытая ловушка для ботов: человек это поле не видит и не заполняет. */
export function Honeypot() {
  return (
    <div className="hp" aria-hidden="true">
      <label>
        Не заполняйте это поле
        <input name="hp_url" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
