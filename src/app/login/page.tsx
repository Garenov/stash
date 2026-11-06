import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth-forms";
import { OAuthButtons } from "@/components/oauth-buttons";
import { safePath } from "@/lib/validation";

const ERRORS: Record<string, string> = {
  OAuthEmail:
    "Не удалось войти через провайдера: нужен подтверждённый email. Если этот email уже зарегистрирован с паролем, войдите паролем.",
  AccessDenied: "Доступ запрещён.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = safePath(sp.callbackUrl);
  if ((await auth())?.user) redirect(callbackUrl);

  const notice = sp.error ? (ERRORS[sp.error] ?? "Ошибка входа. Попробуйте ещё раз.") : undefined;

  return (
    <main className="container narrow">
      <LoginForm callbackUrl={callbackUrl} notice={notice} />
      <OAuthButtons callbackUrl={callbackUrl} />
    </main>
  );
}
