// Простая, но реальная RFC 5322-подобная проверка — без claim на 100% строгость,
// этого достаточно, чтобы поймать явные опечатки до отправки на backend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Жёсткое правило — ровно то же самое, что требует backend (RegisterDto: MinLength(8)). */
export const PASSWORD_MIN_LENGTH = 8;

export function getPasswordError(password: string): string | null {
  if (password.length === 0) return "Введите пароль";
  if (password.length < PASSWORD_MIN_LENGTH) return `Минимум ${PASSWORD_MIN_LENGTH} символов`;
  return null;
}

export type PasswordStrength = "weak" | "medium" | "strong";

/** Только визуальная подсказка — не блокирует отправку сверх PASSWORD_MIN_LENGTH. */
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

export function isValidPhone(value: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(value.trim());
}
