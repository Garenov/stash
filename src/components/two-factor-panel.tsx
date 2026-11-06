"use client";

import { useActionState } from "react";
import {
  beginTotpSetup,
  confirmTotp,
  disableTotp,
  type TotpConfirmState,
  type TotpDisableState,
  type TotpSetupState,
} from "@/app/settings/actions";

export function TwoFactorPanel({
  enabled,
  hasPassword,
  recoveryLeft,
}: {
  enabled: boolean;
  hasPassword: boolean;
  recoveryLeft: number;
}) {
  const [setup, setupAction, setupPending] = useActionState<TotpSetupState, FormData>(
    beginTotpSetup,
    {},
  );
  const [confirm, confirmAction, confirmPending] = useActionState<TotpConfirmState, FormData>(
    confirmTotp,
    {},
  );
  const [disable, disableAction, disablePending] = useActionState<TotpDisableState, FormData>(
    disableTotp,
    {},
  );

  // Сразу после включения показываем recovery-коды: больше их увидеть нельзя.
  if (confirm.recoveryCodes) {
    return (
      <div>
        <p className="banner-ok">2FA включена.</p>
        <p>
          Сохраните recovery-коды в надёжном месте. Каждый подходит один раз, если вы потеряете
          доступ к телефону. <strong>Повторно они показаны не будут.</strong>
        </p>
        <ul className="codes">
          {confirm.recoveryCodes.map((c) => (
            <li key={c}>
              <code>{c}</code>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!hasPassword) {
    return (
      <p className="muted">
        Ваш аккаунт входит через внешний сервис (GitHub, Google или Discord), поэтому 2FA
        настраивается у провайдера. Здесь она защищает только вход по паролю.
      </p>
    );
  }

  if (enabled) {
    return (
      <form action={disableAction} className="form">
        <p>
          Двухфакторная аутентификация <strong>включена</strong>. Неиспользованных
          recovery-кодов: {recoveryLeft}.
        </p>
        {disable.error && <p className="banner-error">{disable.error}</p>}
        <label>
          Чтобы отключить, введите код из приложения или recovery-код
          <input name="code" autoComplete="one-time-code" required />
        </label>
        <button className="ghost danger" disabled={disablePending}>
          Отключить 2FA
        </button>
      </form>
    );
  }

  if (setup.qr) {
    return (
      <form action={confirmAction} className="form">
        <p>
          Отсканируйте QR-код в приложении-аутентификаторе (Google Authenticator, Aegis, 1Password
          и т. п.) и введите 6-значный код.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qr} alt="QR-код для 2FA" width={220} height={220} className="qr" />
        <p className="muted">
          Не получается отсканировать? Введите ключ вручную: <code>{setup.secret}</code>
        </p>
        {confirm.error && <p className="banner-error">{confirm.error}</p>}
        <label>
          Код из приложения
          <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
        </label>
        <button disabled={confirmPending}>Подтвердить и включить</button>
      </form>
    );
  }

  return (
    <form action={setupAction} className="form">
      <p className="muted">
        Дополнительный код при входе по паролю. Защищает аккаунт, даже если пароль утёк.
      </p>
      {setup.error && <p className="banner-error">{setup.error}</p>}
      <button disabled={setupPending}>Включить 2FA</button>
    </form>
  );
}
