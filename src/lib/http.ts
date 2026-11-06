import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { auth } from "@/auth";

export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export const notFound = () =>
  NextResponse.json({ error: "Not found" }, { status: 404 });

export const badRequest = (e: ZodError) =>
  NextResponse.json(
    { error: "Validation failed", fields: e.flatten().fieldErrors },
    { status: 400 },
  );

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
