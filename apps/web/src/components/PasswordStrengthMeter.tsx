import { getPasswordStrength } from "../utils/validation";

const STRENGTH_LABEL: Record<ReturnType<typeof getPasswordStrength>, string> = {
  weak: "Слабый пароль",
  medium: "Средний пароль",
  strong: "Надёжный пароль",
};

const BAR_COUNT = 3;
const STRENGTH_LEVEL: Record<ReturnType<typeof getPasswordStrength>, number> = {
  weak: 1,
  medium: 2,
  strong: 3,
};

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const strength = getPasswordStrength(password);
  const level = STRENGTH_LEVEL[strength];

  return (
    <div>
      <div className="strength-meter">
        {Array.from({ length: BAR_COUNT }).map((_, index) => (
          <div key={index} className={`strength-bar ${index < level ? `is-filled-${strength}` : ""}`} />
        ))}
      </div>
      <p className="field-hint" style={{ marginTop: 4 }}>
        {STRENGTH_LABEL[strength]}
      </p>
    </div>
  );
}
