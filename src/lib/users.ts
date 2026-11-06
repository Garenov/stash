import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, users, type User } from "@/db/schema";
import { isUniqueViolation } from "./db-errors";

export class EmailTakenError extends Error {
  constructor() {
    super("Email already registered");
  }
}

// Сравниваем с заглушкой, когда пользователя нет, чтобы время ответа
// не выдавало, существует ли email.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12);

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email),
    columns: { id: true },
  });
  if (existing) throw new EmailTakenError();

  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const [row] = await db
      .insert(users)
      .values({ name: input.name, email: input.email, passwordHash })
      .returning({ id: users.id, email: users.email, name: users.name });
    return row!;
  } catch (e) {
    // гонка между проверкой и вставкой: сработал UNIQUE на email
    if (isUniqueViolation(e)) throw new EmailTakenError();
    throw e;
  }
}

/** Проверка пароля. Возвращает пользователя или null; время ответа не зависит от существования email. */
export async function verifyPassword(email: string, password: string): Promise<User | null> {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  return user && user.passwordHash && ok ? user : null;
}

type OAuthInput = {
  provider: string;
  providerAccountId: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
};

/**
 * Находит или создаёт пользователя для входа через OAuth.
 *
 * Автоматическая привязка к существующему аккаунту с паролем намеренно запрещена:
 * email при обычной регистрации не подтверждается, и злоумышленник мог бы заранее
 * зарегистрировать чужой email со своим паролем, а потом получить доступ к тому же
 * аккаунту после входа жертвы через Google (pre-hijacking).
 */
export async function resolveOAuthUser(
  input: OAuthInput,
): Promise<{ id: string; email: string; name: string } | null> {
  const linked = await db.query.accounts.findFirst({
    where: (a, { and, eq }) =>
      and(eq(a.provider, input.provider), eq(a.providerAccountId, input.providerAccountId)),
  });
  if (linked) {
    const user = await db.query.users.findFirst({ where: eq(users.id, linked.userId) });
    if (user) return { id: user.id, email: user.email, name: user.name };
  }

  const email = input.email?.trim().toLowerCase();
  if (!email || !input.emailVerified) return null;

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing?.passwordHash) return null; // email занят аккаунтом с паролем

  let user = existing;
  if (!user) {
    [user] = await db
      .insert(users)
      .values({ email, name: input.name?.trim() || email.split("@")[0] || "User" })
      .returning();
  }
  if (!user) return null;

  await db
    .insert(accounts)
    .values({
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      userId: user.id,
    })
    .onConflictDoNothing();

  return { id: user.id, email: user.email, name: user.name };
}
