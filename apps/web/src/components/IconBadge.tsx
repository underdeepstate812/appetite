import type { LucideIcon } from "lucide-react";

const DIMENSIONS = { md: 52, lg: 64, xl: 80 };
const ICON_SIZES = { md: 22, lg: 28, xl: 36 };

/**
 * Стеклянная "фишка"-обёртка вокруг SVG-иконки (Lucide) — заменяет эмодзи как
 * функциональные UI-иконки (шаги, статусы) на консистентный набор с чёткими
 * размерами вместо эмодзи, которые рендерятся по-разному на разных ОС/браузерах.
 */
export function IconBadge({
  icon: Icon,
  size = "md",
  className,
}: {
  icon: LucideIcon;
  size?: keyof typeof DIMENSIONS;
  className?: string;
}) {
  const dims = DIMENSIONS[size];
  const iconSize = ICON_SIZES[size];

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dims,
        height: dims,
        borderRadius: size === "xl" ? "50%" : 16,
        background: "var(--color-primary-soft)",
        border: "1px solid var(--color-border)",
        flexShrink: 0,
      }}
    >
      <Icon size={iconSize} color="var(--color-primary)" strokeWidth={2} aria-hidden="true" />
    </div>
  );
}
