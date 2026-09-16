import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Role } from "@apetite/shared";
import { useAuthStore } from "./store/authStore";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { OffersPage } from "./pages/OffersPage";
import { OrdersPage } from "./pages/OrdersPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { PlatformBusinessesPage } from "./pages/PlatformBusinessesPage";
import { PlatformStatsPage } from "./pages/PlatformStatsPage";
import { LoadingView } from "./components/StateViews";

function ProtectedLayout() {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

/** Направляет BUSINESS/ADMIN в разные разделы — экраны одной роли 403-ятся бэкендом для другой. */
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (user?.role !== role) return <DefaultRedirect />;
  return <>{children}</>;
}

function DefaultRedirect() {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "ADMIN" ? "/platform/businesses" : "/offers"} replace />;
}

export default function App() {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!isHydrated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LoadingView label="Загрузка..." />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route
            path="/offers"
            element={
              <RequireRole role={Role.BUSINESS}>
                <OffersPage />
              </RequireRole>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireRole role={Role.BUSINESS}>
                <OrdersPage />
              </RequireRole>
            }
          />
          <Route
            path="/analytics"
            element={
              <RequireRole role={Role.BUSINESS}>
                <AnalyticsPage />
              </RequireRole>
            }
          />
          <Route
            path="/platform/businesses"
            element={
              <RequireRole role={Role.ADMIN}>
                <PlatformBusinessesPage />
              </RequireRole>
            }
          />
          <Route
            path="/platform/stats"
            element={
              <RequireRole role={Role.ADMIN}>
                <PlatformStatsPage />
              </RequireRole>
            }
          />
          <Route path="/" element={<DefaultRedirect />} />
        </Route>
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
