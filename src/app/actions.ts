"use server";

import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { signIn, signOut } from "@/auth";
import * as bookmarksRepo from "@/lib/bookmarks";
import { getUserId } from "@/lib/http";
import { createUser, EmailTakenError } from "@/lib/users";
import {
  bookmarkInput,
  loginSchema,
  parseTags,
  registerSchema,
} from "@/lib/validation";

export type FormState = {
  error?: string;
  fields?: Record<string, string[] | undefined>;
  ok?: boolean;
};

async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (!id) throw new Error("Unauthorized");
  return id;
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };

  try {
    await createUser(parsed.data);
  } catch (e) {
    if (e instanceof EmailTakenError) {
      return { fields: { email: ["Этот email уже зарегистрирован"] } };
    }
    throw e;
  }

  return signInAndRedirect(parsed.data.email, parsed.data.password);
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Неверный email или пароль" };
  return signInAndRedirect(parsed.data.email, parsed.data.password);
}

async function signInAndRedirect(email: string, password: string): Promise<FormState> {
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (e) {
    // успешный вход бросает NEXT_REDIRECT — его пробрасываем дальше
    if (e instanceof AuthError) return { error: "Неверный email или пароль" };
    throw e;
  }
  return { ok: true };
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

export async function addBookmark(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();

  const parsed = bookmarkInput.safeParse({
    url: form.get("url"),
    title: form.get("title"),
    description: form.get("description") || undefined,
    tags: parseTags(String(form.get("tags") ?? "")),
  });
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };

  await bookmarksRepo.createBookmark(userId, parsed.data);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function toggleFavorite(id: string): Promise<void> {
  await bookmarksRepo.toggleFavorite(await requireUserId(), id);
  revalidatePath("/dashboard");
}

export async function removeBookmark(id: string): Promise<void> {
  await bookmarksRepo.deleteBookmark(await requireUserId(), id);
  revalidatePath("/dashboard");
}
