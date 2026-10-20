import { useEffect, useState } from "react";
import { LifeBuoy, LogOut, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { EcoSummary } from "@apetite/shared";
import { ecoApi } from "../api/eco";
import { authActions, useAuth } from "../store/auth";
import { usePageTitle } from "../hooks/usePageTitle";
import { AppetiteMark } from "../components/AppetiteMark";
import { PassCard } from "../components/profile/PassCard";
import { EcoRoute } from "../components/profile/EcoRoute";
import { SettingsPanel } from "../components/profile/SettingsPanel";
import { SupportDialog } from "../components/profile/SupportDialog";

/**
 * Профиль — «пропуск спасателя еды», как в мобильном приложении: фото, имя, уровень и контакты на одном билете с линией отрыва,
 * рядом — маршрут по уровням, настройки (тема), помощь и выход. Правка имени/email и смена фото — прямо на месте.
 */
export function ProfilePage() {
  usePageTitle("Профиль — Appetite");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [eco, setEco] = useState<EcoSummary | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ecoApi
      .me()
      .then((data) => {
        if (!cancelled) setEco(data);
      })
      .catch(() => {
        /* эко-данные — украшение пропуска: без них цифры остаются «—» */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  return (
    <div className="app-page profile-page">
      <div className="profile-title">
        <AppetiteMark size={22} />
        <span>ПРОФИЛЬ</span>
      </div>

      <div className="profile-grid">
        <div className="profile-main">
          <PassCard eco={eco} />
        </div>
        <div className="profile-side">
          {eco ? <EcoRoute summary={eco} /> : null}
          <SettingsPanel />
          <button type="button" className="profile-card profile-link" onClick={() => setSupportOpen(true)}>
            <LifeBuoy size={22} aria-hidden="true" />
            <span className="profile-link-text">
              <strong>Помощь и поддержка</strong>
              <small>Напишите нам — ответим на почту</small>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button type="button" className="profile-logout" onClick={() => void authActions.logout().then(() => navigate("/", { replace: true }))}>
            <LogOut size={16} aria-hidden="true" /> Выйти
          </button>
        </div>
      </div>

      {supportOpen ? <SupportDialog user={user} onClose={() => setSupportOpen(false)} /> : null}
    </div>
  );
}
