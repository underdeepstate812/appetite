import { formatRuPhoneInput, getPasswordError, isValidEmail, isValidPhone } from "./validation";

describe("isValidEmail", () => {
  it("accepts a plausible email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("trims surrounding whitespace before checking", () => {
    expect(isValidEmail("  user@example.com  ")).toBe(true);
  });

  it.each(["", "user", "user@", "@example.com", "user example.com"])("rejects %s", (value) => {
    expect(isValidEmail(value)).toBe(false);
  });
});

describe("isValidPhone", () => {
  it("accepts +7 followed by exactly 10 digits", () => {
    expect(isValidPhone("+79111234567")).toBe(true);
  });

  it.each(["89111234567", "+7911123456", "+791112345678", "+7911123456a"])("rejects %s", (value) => {
    expect(isValidPhone(value)).toBe(false);
  });
});

describe("formatRuPhoneInput", () => {
  it("normalizes a raw 11-digit input starting with 8 to +7", () => {
    expect(formatRuPhoneInput("89111234567")).toBe("+79111234567");
  });

  it("strips non-digit characters (pasted formatted numbers)", () => {
    expect(formatRuPhoneInput("+7 (911) 123-45-67")).toBe("+79111234567");
  });

  it("prefixes a bare 10-digit local number with 7", () => {
    expect(formatRuPhoneInput("9111234567")).toBe("+79111234567");
  });

  it("truncates input longer than 11 digits", () => {
    expect(formatRuPhoneInput("891112345679999")).toBe("+79111234567");
  });

  it("never produces a result isValidPhone rejects once 11 digits are entered", () => {
    expect(isValidPhone(formatRuPhoneInput("89111234567"))).toBe(true);
  });
});

describe("getPasswordError", () => {
  it("requires a non-empty password", () => {
    expect(getPasswordError("")).toBe("Введите пароль");
  });

  it("requires the minimum length", () => {
    expect(getPasswordError("Ab1!")).toBe("Минимум 8 символов");
  });

  it("requires an uppercase letter", () => {
    expect(getPasswordError("abcdefg1!")).toBe("Нужна заглавная буква");
  });

  it("requires a lowercase letter", () => {
    expect(getPasswordError("ABCDEFG1!")).toBe("Нужна строчная буква");
  });

  it("requires a digit", () => {
    expect(getPasswordError("Abcdefgh!")).toBe("Нужна цифра");
  });

  it("requires a special character", () => {
    expect(getPasswordError("Abcdefg1")).toBe("Нужен спецсимвол (например !?#%)");
  });

  it("accepts a password meeting every rule", () => {
    expect(getPasswordError("Abcdefg1!")).toBeNull();
  });

  it("accepts Cyrillic letters as valid letter characters", () => {
    expect(getPasswordError("Пароль1!")).toBeNull();
  });
});
