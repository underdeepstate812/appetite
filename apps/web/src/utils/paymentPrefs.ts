import type { PaymentMethod } from "../components/PaymentMethodSelector";

const METHOD_KEY = "apetite.web.paymentMethod";
const ONE_CLICK_KEY = "apetite.web.oneClickConsent";

export function readPaymentMethod(): PaymentMethod {
  try {
    return localStorage.getItem(METHOD_KEY) === "sbp" ? "sbp" : "card";
  } catch {
    return "card";
  }
}

export function writePaymentMethod(method: PaymentMethod) {
  try {
    localStorage.setItem(METHOD_KEY, method);
  } catch {
    // хранилище недоступно — выбор просто не запомнится
  }
}

/** Пользователь один раз явно согласился, что «заказ в 1 клик» оплачивается сразу и без отмены. */
export function hasOneClickConsent(): boolean {
  try {
    return localStorage.getItem(ONE_CLICK_KEY) === "1";
  } catch {
    return false;
  }
}

export function grantOneClickConsent() {
  try {
    localStorage.setItem(ONE_CLICK_KEY, "1");
  } catch {
    // без хранилища согласие придётся подтверждать заново — это безопасный отказ
  }
}

/** Выход из аккаунта снимает согласие: на общем компьютере следующий человек не должен покупать «в один клик» за предыдущего. */
export function revokeOneClickConsent() {
  try {
    localStorage.removeItem(ONE_CLICK_KEY);
  } catch {
    // не критично
  }
}
