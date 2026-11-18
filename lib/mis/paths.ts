export function safeNext(value: string | null | undefined): string {
  if (!value || /[\\\u0000-\u0020]/.test(value)) return "/workspace";
  return /^\/(workspace(?:[/?]|$)|auth\/update-password(?:[?]|$))/.test(value)
    ? value
    : "/workspace";
}
