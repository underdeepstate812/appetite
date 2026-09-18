import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useBusinessStore } from "../store/businessStore";

const BUSINESS_NAV_ITEMS = [
  { to: "/offers", label: "Офферы", icon: "🍱" },
  { to: "/orders", label: "Заказы", icon: "🧾" },
  { to: "/analytics", label: "Аналитика", icon: "📊" },
];

const ADMIN_NAV_ITEMS = [
  { to: "/platform/businesses", label: "Заведения", icon: "🏪" },
  { to: "/platform/stats", label: "GMV", icon: "📈" },
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
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={sidebarStyle}>
        <div style={{ padding: "20px 20px 8px" }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: "var(--color-primary)" }}>Appetite</p>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
            {isAdmin ? "Панель платформы" : "Панель бизнеса"}
          </p>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "12px 12px" }}>
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
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: "auto", padding: 16, borderTop: "1px solid var(--color-border)" }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>{isAdmin ? user?.name : (business?.name ?? user?.name)}</p>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>{user?.email}</p>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 12, width: "100%" }} onClick={() => void logout()}>
            Выйти
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: 32, maxWidth: 1100 }}>
        <Outlet />
      </main>
    </div>
  );
}

const sidebarStyle: React.CSSProperties = {
  width: 220,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  background: "var(--color-surface-elevated)",
  borderRight: "1px solid var(--color-border)",
};

const navLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: "var(--radius-sm)",
  textDecoration: "none",
  fontSize: 14,
  minHeight: 40,
};
