import { PASSWORD_MIN_LENGTH, RU_PHONE_REGEX, STRONG_PASSWORD_REGEX } from "@apetite/shared";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Строго +7 и 10 цифр — то же правило, что у backend. */
export function isValidPhone(value: string): boolean {
  return RU_PHONE_REGEX.test(value.trim());
}

/** Любой ввод (включая вставленный целиком, с 8 или без +) приводится к виду +7XXXXXXXXXX. */
export function formatRuPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (!digits.startsWith("7")) digits = "7" + digits;
  digits = digits.slice(0, 11);
  return "+" + digits;
}

/**
 * Пароль "по всем канонам": минимум 8 символов, заглавная и строчная буквы,
 * цифра и спецсимвол — то же правило, что у backend (RegisterDto).
 */
export function getPasswordError(password: string): string | null {
  if (password.length === 0) return "Введите пароль";
  if (password.length < PASSWORD_MIN_LENGTH) return `Минимум ${PASSWORD_MIN_LENGTH} символов`;
  if (!/[A-ZА-ЯЁ]/.test(password)) return "Нужна заглавная буква";
  if (!/[a-zа-яё]/.test(password)) return "Нужна строчная буква";
  if (!/\d/.test(password)) return "Нужна цифра";
  if (!STRONG_PASSWORD_REGEX.test(password)) return "Нужен спецсимвол (например !?#%)";
  return null;
}
