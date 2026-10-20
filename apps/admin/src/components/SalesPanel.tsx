import { useCallback, useEffect, useMemo, useState } from "react";
import { SALES_PERIODS, type BusinessSales, type SalesDay, type SalesPeriod } from "@apetite/shared";
import { businessesApi } from "../api/businesses";
import {
  HEAT_META,
  HEAT_MIN_ORDERS,
  axisLabel,
  bestDay,
  dayNumber,
  deltaPercent,
  formatRub,
  heatInsight,
  isWeekend,
  longDay,
  monthShort,
  DELTA_MIN_PREVIOUS_ORDERS,
  niceAxis,
  ordersWord,
  portionsWord,
  soldOrders,
  soldRevenue,
  weekdayShort,
} from "../utils/sales";

const PERIOD_KEY = "apetite.admin.salesPeriod";

function initialPeriod(): SalesPeriod {
  try {
    const saved = Number(localStorage.getItem(PERIOD_KEY));
    if ((SALES_PERIODS as readonly number[]).includes(saved)) return saved as SalesPeriod;
  } catch {
    /* localStorage может быть недоступен — берём значение по умолчанию */
  }
  return 14;
}

/**
 * «Продажи» — график по дням в языке продукта: мята = деньги, которые заведение получило или получит, штриховка = оплачено и ждёт
 * выдачи, пунктир = не состоялось (отмена/просрочка; в сумму не входит). Ниже — «когда покупают»: тепло = время до конца самовывоза.
 */
export function SalesPanel({ businessId }: { businessId: string }) {
  const [period, setPeriod] = useState<SalesPeriod>(initialPeriod);
  const [sales, setSales] = useState<BusinessSales | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSales(await businessesApi.sales(businessId, period));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить продажи");
    }
  }, [businessId, period]);

  useEffect(() => {
    setSelected(null);
    void load();
  }, [load]);

  const choosePeriod = (next: SalesPeriod) => {
    setPeriod(next);
    try {
      localStorage.setItem(PERIOD_KEY, String(next));
    } catch {
      /* не критично */
    }
  };

  return (
    <section className="card sales" aria-labelledby="sales-title" data-testid="sales-panel">
      <header className="sales-head">
        <div>
          <h2 id="sales-title" className="sales-title">
            Продажи
          </h2>
          <p className="sales-sub">Когда у вас покупают: по дню оформления заказа</p>
        </div>
        <div className="sales-periods" role="group" aria-label="Период графика">
          {SALES_PERIODS.map((value) => (
            <button key={value} type="button" className="sales-period" aria-pressed={value === period} onClick={() => choosePeriod(value)}>
              {value} дн.
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <div role="alert" className="sales-error">
          {error}{" "}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
            Повторить
          </button>
        </div>
      ) : !sales ? (
        <div className="sales-skeleton" aria-busy="true" aria-label="Считаем продажи" />
      ) : (
        <SalesBody sales={sales} selected={selected} hovered={hovered} onSelect={setSelected} onHover={setHovered} />
      )}
    </section>
  );
}

function SalesBody({
  sales,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  sales: BusinessSales;
  selected: string | null;
  hovered: string | null;
  onSelect: (date: string | null) => void;
  onHover: (date: string | null) => void;
}) {
  const { points, totals, previous } = sales;
  const today = points[points.length - 1]?.date;
  const hasAnything = points.some((point) => soldOrders(point) + point.lostOrders > 0);
  const delta = sales.comparable ? deltaPercent(totals, previous) : null;
  const best = useMemo(() => bestDay(points), [points]);

  const peak = Math.max(0, ...points.map((point) => (soldRevenue(point) + point.lostRevenue) / 100));
  const axis = useMemo(() => niceAxis(peak), [peak]);
  const ticks = useMemo(() => Array.from({ length: Math.round(axis.max / axis.step) + 1 }, (_, index) => index * axis.step), [axis]);
  const labelEvery = points.length <= 7 ? 1 : points.length <= 14 ? 1 : 5;

  const focusDate = hovered ?? selected;
  const focused = focusDate ? points.find((point) => point.date === focusDate) ?? null : null;

  return (
    <>
      <div className="sales-kpis">
        <div>
          <p className="sales-kpi-label">Продано за {sales.days} дн.</p>
          <p className="sales-kpi-value" data-testid="sales-total">
            {formatRub(totals.revenue)}
          </p>
          <p className="sales-kpi-note">
            {ordersWord(totals.orders)} · {portionsWord(totals.portions)} ушло людям, а не в мусор
          </p>
        </div>
        <div className="sales-delta" data-testid="sales-delta">
          {delta === null ? (
            <span className="sales-delta-muted">
              {!sales.comparable
                ? "Сравнение появится, когда заведение поработает дольше предыдущего периода"
                : previous.orders === 0
                  ? "Прошлый период: продаж не было — сравнивать пока не с чем"
                  : `Предыдущие ${sales.days} дн.: ${formatRub(previous.revenue)} (${ordersWord(previous.orders)}) — меньше ${DELTA_MIN_PREVIOUS_ORDERS} заказов, процент был бы обманчив`}
            </span>
          ) : (
            <>
              <span className={delta >= 0 ? "sales-delta-up" : "sales-delta-down"}>
                {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
              </span>
              <span className="sales-delta-muted"> к предыдущим {sales.days} дн. ({formatRub(previous.revenue)})</span>
            </>
          )}
        </div>
      </div>

      <div className="sales-plot" role="group" aria-label={`Продажи по дням за ${sales.days} дней`}>
        <div className="sales-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${(tick / axis.max) * 100}%` }}>
              {axisLabel(tick)}
            </span>
          ))}
        </div>
        <div className="sales-canvas">
          <div className="sales-grid" aria-hidden="true">
            {ticks.map((tick) => (
              <i key={tick} style={{ bottom: `${(tick / axis.max) * 100}%` }} />
            ))}
          </div>
          <div className="sales-cols" onMouseLeave={() => onHover(null)}>
            {points.map((point, index) => (
              <DayColumn
                key={point.date}
                point={point}
                axisMax={axis.max}
                isToday={point.date === today}
                isBest={best?.date === point.date}
                isSelected={selected === point.date}
                showLabel={index % labelEvery === 0 || point.date === today}
                compact={points.length > 14}
                first={index === 0}
                onToggle={() => onSelect(selected === point.date ? null : point.date)}
                onHover={onHover}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="sales-legend" aria-hidden="true">
        <span><i className="lg lg-done" /> Выдано</span>
        <span><i className="lg lg-wait" /> Оплачено, ждёт выдачи</span>
        <span><i className="lg lg-lost" /> Не состоялось (отмена, просрочка) — в сумму не входит</span>
        <span><i className="lg lg-best" /> Лучший день</span>
      </div>

      <p className="sales-readout" aria-live="polite" data-testid="sales-readout">
        {focused ? <DayReadout point={focused} /> : !hasAnything ? (
          <span className="sales-delta-muted">За {sales.days} дн. заказов не было. Как только появится первая покупка, она встанет на график.</span>
        ) : best ? (
          <span>
            Лучший день — <b>{longDay(best.date)}</b>: {formatRub(soldRevenue(best))}, {ordersWord(soldOrders(best))}. Нажмите на любой день, чтобы увидеть подробности.
          </span>
        ) : (
          <span className="sales-delta-muted">Продаж за период нет — только не состоявшиеся заказы.</span>
        )}
      </p>

      <HeatStrip sales={sales} />
    </>
  );
}

function DayColumn({
  point,
  axisMax,
  isToday,
  isBest,
  isSelected,
  showLabel,
  compact,
  first,
  onToggle,
  onHover,
}: {
  point: SalesDay;
  axisMax: number;
  isToday: boolean;
  isBest: boolean;
  isSelected: boolean;
  showLabel: boolean;
  compact: boolean;
  first: boolean;
  onToggle: () => void;
  onHover: (date: string | null) => void;
}) {
  const monthStart = point.date.endsWith("-01");
  const pct = (kopecks: number) => (kopecks > 0 ? Math.max((kopecks / 100 / axisMax) * 100, 1.2) : 0);
  const label = `${longDay(point.date)}${isToday ? " (сегодня)" : ""}: продано на ${formatRub(soldRevenue(point))}, ${ordersWord(soldOrders(point))}${
    point.lostOrders ? `, не состоялось ${point.lostOrders}` : ""
  }`;
  return (
    <div className={`sales-col${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="sales-bar-btn"
        aria-label={label}
        aria-pressed={isSelected}
        data-date={point.date}
        onClick={onToggle}
        onMouseEnter={() => onHover(point.date)}
        onFocus={() => onHover(point.date)}
        onBlur={() => onHover(null)}
      >
        <span className="sales-stack">
          {point.lostRevenue > 0 ? <span className="seg seg-lost" style={{ height: `${pct(point.lostRevenue)}%` }} /> : null}
          {point.pendingRevenue > 0 ? <span className="seg seg-wait" style={{ height: `${pct(point.pendingRevenue)}%` }} /> : null}
          {point.completedRevenue > 0 ? <span className="seg seg-done" style={{ height: `${pct(point.completedRevenue)}%` }} /> : null}
        </span>
      </button>
      <span className={`sales-xlabel${isWeekend(point.date) ? " is-weekend" : ""}${isBest ? " is-best" : ""}${showLabel ? "" : " is-hidden"}`} aria-hidden="true">
        {compact ? (showLabel && (monthStart || first) ? <small>{monthShort(point.date)}</small> : null) : <small>{weekdayShort(point.date)}</small>}
        <b>{isToday && !compact ? "сегодня" : dayNumber(point.date)}</b>
      </span>
    </div>
  );
}

function DayReadout({ point }: { point: SalesDay }) {
  return (
    <span>
      <b>{longDay(point.date)}</b> · продано <b>{formatRub(soldRevenue(point))}</b>, {ordersWord(soldOrders(point))}
      {point.portions > 0 ? `, ${portionsWord(point.portions)}` : ""}
      {point.pendingOrders > 0 ? ` · ждёт выдачи: ${formatRub(point.pendingRevenue)}` : ""}
      {point.lostOrders > 0 ? ` · не состоялось: ${point.lostOrders} на ${formatRub(point.lostRevenue)}` : ""}
    </span>
  );
}

/** «Когда покупают» — одна полоса из четырёх отрезков по времени до конца самовывоза (цвет теплеет к концу). */
function HeatStrip({ sales }: { sales: BusinessSales }) {
  const total = sales.heat.reduce((sum, bucket) => sum + bucket.orders, 0);
  const insight = heatInsight(sales.heat);
  return (
    <div className="heat" data-testid="sales-heat">
      <h3 className="heat-title">За сколько до конца самовывоза покупают</h3>
      {total === 0 ? (
        <p className="sales-delta-muted">Появится, когда будут продажи за период.</p>
      ) : (
        <>
          <div className="heat-bar" role="img" aria-label={sales.heat.map((bucket) => `${HEAT_META[bucket.key].label}: ${ordersWord(bucket.orders)}`).join("; ")}>
            {sales.heat.map((bucket) =>
              bucket.orders > 0 ? <span key={bucket.key} style={{ flexGrow: bucket.orders, background: HEAT_META[bucket.key].color }} /> : null
            )}
          </div>
          <ul className="heat-legend">
            {sales.heat.map((bucket) => (
              <li key={bucket.key}>
                <i style={{ background: HEAT_META[bucket.key].color }} aria-hidden="true" />
                <span>
                  <b>{HEAT_META[bucket.key].label}</b> · {Math.round((bucket.orders / total) * 100)}%
                  <small>{ordersWord(bucket.orders)} · {formatRub(bucket.revenue)}</small>
                </span>
              </li>
            ))}
          </ul>
          <p className="heat-insight" data-testid="sales-heat-insight">
            {insight ?? `Пока ${ordersWord(total)} — выводы появятся от ${HEAT_MIN_ORDERS} заказов.`}
          </p>
        </>
      )}
    </div>
  );
}
