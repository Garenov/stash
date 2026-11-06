import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export class EmailTakenError extends Error {
  constructor() {
    super("Email already registered");
  }
}

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
    if (String(e).includes("UNIQUE")) throw new EmailTakenError();
    throw e;
  }
}
