import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { OffersPage } from "./pages/OffersPage";
import { OrdersPage } from "./pages/OrdersPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { LoadingView } from "./components/StateViews";

function ProtectedLayout() {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
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
          <Route path="/offers" element={<OffersPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/" element={<Navigate to="/offers" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/offers" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
