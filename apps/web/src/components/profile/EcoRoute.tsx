import { Check, Earth, Package, Sprout, Trophy, type LucideIcon } from "lucide-react";
import { ECO_LEVELS, type EcoSummary } from "@apetite/shared";

export const LEVEL_NAMES: Record<number, string> = { 1: "Новичок", 2: "Спасатель еды", 3: "Герой планеты", 4: "Легенда Appetite" };
const LEVEL_ICON: Record<number, LucideIcon> = { 1: Sprout, 2: Package, 3: Earth, 4: Trophy };

/** «Твой маршрут»: четыре уровня эко-профиля как остановки. Между ними фитиль догорает до текущего прогресса; пройденные — с галочкой, текущая пульсирует. */
export function EcoRoute({ summary }: { summary: EcoSummary }) {
  const { level, nextLevel, totalPoints } = summary;
  const currentIndex = Math.max(0, ECO_LEVELS.findIndex((item) => item.id === level.id));
  const stepProgress = nextLevel ? Math.min(1, Math.max(0, (totalPoints - level.minPoints) / (nextLevel.minPoints - level.minPoints))) : 0;
  const routeProgress = nextLevel ? (currentIndex + stepProgress) / (ECO_LEVELS.length - 1) : 1;

  return (
    <section className="profile-card" aria-labelledby="route-title">
      <p id="route-title" className="profile-overline">
        ТВОЙ МАРШРУТ
      </p>
      <ol className="eco-route">
        <li className="eco-track" aria-hidden="true">
          <span className="eco-fill" style={{ width: `${routeProgress * 100}%` }}>
            <i className="eco-spark" />
          </span>
        </li>
        {ECO_LEVELS.map((item, index) => {
          const reached = index < currentIndex || (index === currentIndex && !nextLevel);
          const current = index === currentIndex && !!nextLevel;
          const Icon = LEVEL_ICON[item.id];
          return (
            <li key={item.id} className={`eco-stop${reached ? " is-reached" : ""}${current ? " is-current" : ""}`} aria-current={current ? "step" : undefined}>
              <span className="eco-node">{reached ? <Check size={17} strokeWidth={3} aria-hidden="true" /> : <Icon size={17} strokeWidth={2.1} aria-hidden="true" />}</span>
              <span className="eco-label">{LEVEL_NAMES[item.id]}</span>
            </li>
          );
        })}
      </ol>
      <p className="eco-caption">{nextLevel ? `До следующего уровня: ${Math.max(0, nextLevel.minPoints - totalPoints)} баллов` : "Ты достиг(-ла) максимального уровня!"}</p>
    </section>
  );
}
