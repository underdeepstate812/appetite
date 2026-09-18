import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ScrollProgress } from "./components/ScrollProgress";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { BusinessRegisterPage } from "./pages/BusinessRegisterPage";
import { OfertaPage } from "./pages/OfertaPage";

const NO_FOOTER_PATHS = ["/login", "/register", "/for-business"];

function Layout() {
  const location = useLocation();
  const isAuthPage = NO_FOOTER_PATHS.includes(location.pathname);

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
      </Routes>
      {isAuthPage ? null : <Footer />}
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
