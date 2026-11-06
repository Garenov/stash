import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth-forms";

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/dashboard");
  return (
    <main className="container narrow">
      <LoginForm />
    </main>
  );
}
