import type { OfferStatus, OrderStatus } from "@apetite/shared";

type Tone = "primary" | "success" | "warning" | "danger" | "muted";

const OFFER_STATUS: Record<OfferStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Черновик", tone: "muted" },
  ACTIVE: { label: "Активен", tone: "primary" },
  SOLD_OUT: { label: "Раскуплен", tone: "warning" },
  ARCHIVED: { label: "В архиве", tone: "muted" },
};

const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  CONFIRMED: { label: "Ожидает самовывоза", tone: "primary" },
  COMPLETED: { label: "Выдан", tone: "success" },
  CANCELLED: { label: "Отменён", tone: "muted" },
  EXPIRED: { label: "Просрочен", tone: "danger" },
};

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  const { label, tone } = OFFER_STATUS[status];
  return <Badge label={label} tone={tone} />;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, tone } = ORDER_STATUS[status];
  return <Badge label={label} tone={tone} />;
}
