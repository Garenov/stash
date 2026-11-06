import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth-forms";
import { OAuthButtons } from "@/components/oauth-buttons";

export default async function RegisterPage() {
  if ((await auth())?.user) redirect("/dashboard");
  return (
    <main className="container narrow">
      <RegisterForm />
      <OAuthButtons callbackUrl="/dashboard" />
    </main>
  );
}
