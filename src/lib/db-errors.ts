/** Нарушение UNIQUE-ограничения (учитывает обёртки с `cause`). */
export function isUniqueViolation(e: unknown): boolean {
  for (let cur: unknown = e, depth = 0; cur && depth < 4; depth++) {
    if (String(cur).includes("UNIQUE constraint failed")) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}
