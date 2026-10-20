import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ScrollProgress } from "./components/ScrollProgress";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { BusinessRegisterPage } from "./pages/BusinessRegisterPage";
import { OfertaPage } from "./pages/OfertaPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { HomePage } from "./pages/HomePage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { OrderTicketPage } from "./pages/OrderTicketPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RequireAuth } from "./components/RequireAuth";
import { authActions } from "./store/auth";

// Футер нужен только контентным страницам: экраны входа, 404 и рабочие экраны покупки (оплата, заказы) —
// самодостаточные, футер под ними только мешал бы. Витрина — длинная страница (лента + карта), под ней он уместен.
const FOOTER_PATHS = ["/", "/home", "/legal/oferta"];

function Layout() {
  const location = useLocation();
  const showFooter = FOOTER_PATHS.includes(location.pathname);

  // Подтверждаем сохранённую сессию один раз при старте приложения.
  useEffect(() => {
    void authActions.hydrate();
  }, []);

  // Переход на "/#how" или "/#faq" с любой другой страницы (см. Header/NavLink) сначала
  // монтирует LandingPage, и только потом можно скроллить к секции — id ещё не существует
  // в момент самого перехода браузера по хешу.
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [location.pathname, location.hash]);

  return (
    <>
      <ScrollProgress />
      <Header />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/for-business" element={<BusinessRegisterPage />} />
        <Route path="/legal/oferta" element={<OfertaPage />} />
        <Route path="/home" element={<HomePage />} />
        {/* Прежний адрес отдельной карты: закладки и ссылки продолжают работать — карта теперь секция витрины. */}
        <Route path="/map" element={<Navigate to="/home#map" replace />} />
        <Route
          path="/checkout/:offerId"
          element={
            <RequireAuth>
              <CheckoutPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/orders"
          element={
            <RequireAuth>
              <OrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/orders/:orderId"
          element={
            <RequireAuth>
              <OrderTicketPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {showFooter ? <Footer /> : null}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
