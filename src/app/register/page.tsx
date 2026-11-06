import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth-forms";

export default async function RegisterPage() {
  if ((await auth())?.user) redirect("/dashboard");
  return (
    <main className="container narrow">
      <RegisterForm />
    </main>
  );
}
