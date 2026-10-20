/**
 * Фокус пришёл с клавиатуры (или от скринридера), а не от указателя. На native onFocus и так только такой; на web
 * спрашиваем браузер (:focus-visible) — он сам отличает Tab от касания.
 */
export function isKeyboardFocus(event?: { nativeEvent?: { target?: unknown }; target?: unknown }): boolean {
  const target = (event?.nativeEvent?.target ?? event?.target) as { matches?: (selector: string) => boolean } | undefined;
  if (!target || typeof target.matches !== "function") return true;
  try {
    return target.matches(":focus-visible");
  } catch {
    return true;
  }
}
