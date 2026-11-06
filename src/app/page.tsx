import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="container narrow hero">
      <h1>Stash</h1>
      <p className="lead">
        Складывайте ссылки, раскладывайте по тегам, находите за секунду.
      </p>
      <div className="row">
        <Link className="button" href="/register">
          Начать
        </Link>
        <Link className="button ghost" href="/login">
          Войти
        </Link>
      </div>
    </main>
  );
}
