import { Check, ChefHat, ShoppingBag } from "lucide-react";
import { heatColor } from "@apetite/shared";
import { useNow } from "../hooks/useNow";
import { formatClock, formatTimeLeft } from "../utils/format";
import { getOrderStage, getReadiness, type OrderStage } from "../utils/orderStage";

interface Props {
  pickupStart: string;
  pickupEnd: string;
  /** Пока не задано — заведение ещё не подтвердило заказ: шкала честно стоит на «Оплачено», а не «Готовится». */
  acceptedAt?: string | null;
}

const STAGES: { key: OrderStage; label: string; Icon: typeof Check }[] = [
  { key: "confirmed", label: "Оплачено", Icon: Check },
  { key: "preparing", label: "Готовится", Icon: ChefHat },
  { key: "ready", label: "Можно забирать", Icon: ShoppingBag },
];

/**
 * Те же три стадии и тот же «фитиль», что в мобильном приложении: пока заказ готовится, второй отрезок
 * заполняется бирюзой до текущей готовности; когда готов — тот же отрезок становится фитилём окна выдачи
 * и догорает в цветах жара (это то же самое время, что на карточке оффера).
 */
export function OrderTimeline({ pickupStart, pickupEnd, acceptedAt }: Props) {
  const now = useNow(15000);
  const stage = getOrderStage(acceptedAt, pickupStart, now);
  const current = STAGES.findIndex((s) => s.key === stage);
  const isReady = stage === "ready";
  const start = new Date(pickupStart).getTime();
  const end = new Date(pickupEnd).getTime();

  const readiness = getReadiness(acceptedAt, pickupStart, now);
  const windowRemaining = isReady && end > start ? Math.min(1, Math.max(0, (end - now) / (end - start))) : 1;
  const fuse = isReady ? windowRemaining : readiness;
  const fuseColor = isReady ? heatColor(1 - windowRemaining, "light") : "var(--color-primary)";

  let hint: string;
  if (isReady) hint = `Заберите до ${formatClock(pickupEnd)}`;
  else if (!acceptedAt) hint = "Ждём подтверждения от заведения";
  else hint = `Начало через ${formatTimeLeft(Math.max(0, Math.ceil((start - now) / 60000)))}`;

  return (
    <div className="order-timeline">
      <ol className="order-timeline-track" aria-label="Статус заказа">
        <span className="order-timeline-rail" aria-hidden="true">
          <span className="order-timeline-done" style={{ width: current >= 1 ? "50%" : "0%" }} />
          <span className="order-timeline-fuse-slot">
            <span className="order-timeline-fuse" style={{ width: `${Math.round(fuse * 100)}%`, background: fuseColor }} />
          </span>
        </span>
        {STAGES.map(({ key, label, Icon }, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={key} className={`order-stage${done ? " is-done" : ""}${active ? " is-active" : ""}`} aria-current={active ? "step" : undefined}>
              <span className="order-stage-node">
                {done ? <Check size={18} strokeWidth={2.8} aria-hidden="true" /> : <Icon size={18} strokeWidth={2.4} aria-hidden="true" />}
              </span>
              <span className="order-stage-label">{label}</span>
            </li>
          );
        })}
      </ol>
      <p className={`order-timeline-hint${isReady ? " is-ready" : ""}`} role="status" style={isReady ? { borderColor: fuseColor } : undefined}>
        {hint}
        {stage === "preparing" ? ` · готовность ${Math.round(readiness * 100)}%` : ""}
      </p>
    </div>
  );
}
