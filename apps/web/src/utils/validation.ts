import { PASSWORD_MIN_LENGTH, RU_PHONE_REGEX, STRONG_PASSWORD_REGEX } from "@apetite/shared";

// Простая, но реальная RFC 5322-подобная проверка — без claim на 100% строгость,
// этого достаточно, чтобы поймать явные опечатки до отправки на backend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export { PASSWORD_MIN_LENGTH };

/**
 * Пароль "по всем канонам": минимум 8 символов, заглавная и строчная буквы,
 * цифра и спецсимвол — ровно то же правило, что и у backend (RegisterDto).
 */
export function getPasswordError(password: string): string | null {
  if (password.length === 0) return "Введите пароль";
  if (password.length < PASSWORD_MIN_LENGTH) return `Минимум ${PASSWORD_MIN_LENGTH} символов`;
  if (!/[a-zа-яё]/i.test(password)) return "Нужна хотя бы одна буква";
  if (!/[A-ZА-ЯЁ]/.test(password)) return "Нужна заглавная буква";
  if (!/[a-zа-яё]/.test(password)) return "Нужна строчная буква";
  if (!/\d/.test(password)) return "Нужна цифра";
  if (!STRONG_PASSWORD_REGEX.test(password)) return "Нужен спецсимвол (например !?#%)";
  return null;
}

export type PasswordStrength = "weak" | "medium" | "strong";

/** Только визуальная подсказка — не блокирует отправку сверх getPasswordError. */
export function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-ZА-Я]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-zА-Яа-я0-9]/.test(password)) score += 1;

  if (score <= 2) return "weak";
  if (score <= 3) return "medium";
  return "strong";
}

/** Строго +7 и 10 цифр — то же правило, что у backend (RU_PHONE_REGEX). */
export function isValidPhone(value: string): boolean {
  return RU_PHONE_REGEX.test(value.trim());
}

/**
 * Автоформатирование ввода телефона к виду +7XXXXXXXXXX: любая последовательность
 * цифр (в т.ч. вставленная целиком, начинающаяся с 8 или 7) приводится к +7-форме,
 * не давая пользователю случайно уйти от единственного разрешённого формата.
 */
export function formatRuPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (!digits.startsWith("7")) digits = "7" + digits;
  digits = digits.slice(0, 11);
  return "+" + digits;
}
