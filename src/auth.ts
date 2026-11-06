import { eq } from "drizzle-orm";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyToken } from "@/lib/crypto";
import { resolveOAuthUser } from "@/lib/users";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

/**
 * Вход по паролю целиком проходит в server action (проверка пароля, капча, rate-limit, 2FA).
 * Credentials-провайдер принимает только подписанный `proof`, который action выдаёт
 * на 60 секунд после успешной проверки. Подделать его без AUTH_SECRET нельзя, поэтому
 * прямой POST на /api/auth/callback/credentials обойти эти проверки не позволяет.
 */
const providers: Provider[] = [
  Credentials({
    id: "credentials",
    credentials: { proof: {} },
    async authorize(raw) {
      const data = verifyToken(raw?.proof, "login");
      if (!data || typeof data.uid !== "string") return null;
      const user = await db.query.users.findFirst({ where: eq(users.id, data.uid) });
      return user ? { id: user.id, email: user.email, name: user.name } : null;
    },
  }),
];

/** Провайдеры, для которых заданы переменные окружения (для кнопок на странице входа). */
export const enabledOAuth: { id: "github" | "google" | "discord"; name: string }[] = [];

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(GitHub);
  enabledOAuth.push({ id: "github", name: "GitHub" });
}
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
  enabledOAuth.push({ id: "google", name: "Google" });
}
if (process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET) {
  providers.push(Discord);
  enabledOAuth.push({ id: "discord", name: "Discord" });
}

/** Подтверждён ли email у провайдера — по его собственному признаку в профиле. */
function isEmailVerified(provider: string, profile: Record<string, unknown> | undefined): boolean {
  switch (provider) {
    case "github":
      return true; // Auth.js берёт primary-email, а primary на GitHub всегда подтверждён
    case "google":
      return profile?.email_verified === true;
    case "discord":
      return profile?.verified === true;
    default:
      return false;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login", error: "/login" },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account || account.type === "credentials") return true;

      const resolved = await resolveOAuthUser({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        email: user.email ?? null,
        name: user.name ?? null,
        emailVerified: isEmailVerified(account.provider, profile),
      });
      if (!resolved) return "/login?error=OAuthEmail";

      // дальше в jwt/session попадает id из нашей БД, а не id провайдера
      user.id = resolved.id;
      user.email = resolved.email;
      user.name = resolved.name;
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
