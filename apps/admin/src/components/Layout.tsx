import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ShoppingBag, Receipt, BarChart3, Store, TrendingUp } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useBusinessStore } from "../store/businessStore";
import { AppetiteMark } from "./AppetiteMark";

// SVG-иконки вместо эмодзи — эмодзи рендерятся по-разному на разных ОС/браузерах
// и не держат единый визуальный вес рядом с остальным интерфейсом.
const BUSINESS_NAV_ITEMS = [
  { to: "/offers", label: "Офферы", icon: ShoppingBag },
  { to: "/orders", label: "Заказы", icon: Receipt },
  { to: "/analytics", label: "Аналитика", icon: BarChart3 },
];

const ADMIN_NAV_ITEMS = [
  { to: "/platform/businesses", label: "Заведения", icon: Store },
  { to: "/platform/stats", label: "GMV", icon: TrendingUp },
];

export function Layout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const business = useBusinessStore((state) => state.business);
  const fetchBusiness = useBusinessStore((state) => state.fetch);
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    // /businesses/mine отдаёт 403 для ADMIN (RolesGuard требует именно BUSINESS) — не зовём зря.
    if (!isAdmin) void fetchBusiness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const navItems = isAdmin ? ADMIN_NAV_ITEMS : BUSINESS_NAV_ITEMS;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AppetiteMark size={22} />
            <p style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)" }}>Appetite</p>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6 }}>
            {isAdmin ? "Панель платформы" : "Панель бизнеса"}
          </p>
        </div>
        <nav className="admin-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                ...navLinkStyle,
                background: isActive ? "var(--color-primary-soft)" : "transparent",
                color: isActive ? "var(--color-primary)" : "var(--color-text)",
                fontWeight: isActive ? 700 : 500,
              })}
            >
              <item.icon size={17} strokeWidth={2} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <p style={{ fontSize: 13, fontWeight: 600 }}>{isAdmin ? user?.name : (business?.name ?? user?.name)}</p>
          <p className="admin-sidebar-email" style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>{user?.email}</p>
          <button className="btn btn-secondary btn-sm admin-logout" onClick={() => void logout()}>
            Выйти
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

const navLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: "var(--radius-sm)",
  textDecoration: "none",
  fontSize: 14,
  minHeight: 40,
  whiteSpace: "nowrap",
};
