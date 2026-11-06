import type { Metadata } from "next";
import type { ReactNode } from "react";
// @ts-expect-error Next.js handles global CSS imports at runtime.
import "./globals.css";

export const metadata: Metadata = {
  title: "Stash — закладки с тегами",
  description: "Небольшой full-stack сервис: Next.js, Auth.js, Drizzle, Turso.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
