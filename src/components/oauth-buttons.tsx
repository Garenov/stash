import { oauthSignIn } from "@/app/actions";
import { enabledOAuth } from "@/auth";

/** Серверный компонент: кнопки только для тех провайдеров, у которых заданы ключи. */
export function OAuthButtons({ callbackUrl }: { callbackUrl: string }) {
  if (enabledOAuth.length === 0) return null;
  return (
    <div className="card oauth">
      <p className="muted">или войдите через</p>
      <div className="row">
        {enabledOAuth.map((p) => (
          <form key={p.id} action={oauthSignIn}>
            <input type="hidden" name="provider" value={p.id} />
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <button className="ghost">{p.name}</button>
          </form>
        ))}
      </div>
    </div>
  );
}
