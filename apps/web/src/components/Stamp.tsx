import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Круглая "печать" — сквозной визуальный мотив документа/договора: используется
 * и на карточке заявки для бизнеса, и на публичной оферте, и в success-state.
 * Не иконка-бейдж (IconBadge) — та плоская и квадратная, эта нарочно "физическая":
 * двойное кольцо, наклон, как настоящий оттиск штампа на бумаге.
 */
export function Stamp({
  icon: Icon,
  label,
  sublabel,
  size = 96,
  tone = "primary",
  style,
}: {
  icon: LucideIcon;
  label: string;
  sublabel?: string;
  size?: number;
  tone?: "primary" | "onDark";
  style?: CSSProperties;
}) {
  return (
    <div
      className="doc-stamp"
      style={{
        width: size,
        height: size,
        color: tone === "onDark" ? "var(--color-primary-soft)" : "var(--color-primary)",
        ...style,
      }}
    >
      <Icon size={size * 0.26} strokeWidth={1.75} />
      <span className="doc-stamp-label" style={{ fontSize: size * 0.1 }}>
        {label}
      </span>
      {sublabel ? (
        <span className="doc-stamp-sublabel" style={{ fontSize: size * 0.075 }}>
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}
