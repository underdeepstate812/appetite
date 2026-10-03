import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";

/**
 * Оформление и заказы доступны только вошедшим. Гостя отправляем на /login и запоминаем, куда он шёл
 * (state.from) — после входа LoginPage вернёт его ровно туда, например на оплату выбранного оффера.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isHydrated } = useAuth();
  const location = useLocation();

  // Пока токены из localStorage не подтверждены сервером, нельзя ни пускать, ни редиректить:
  // иначе обновление страницы на /checkout/… выкидывало бы уже вошедшего пользователя на форму входа.
  if (!isHydrated) {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" /> Загрузка…
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: { pathname: location.pathname, search: location.search } }} />;
  }
  return <>{children}</>;
}
