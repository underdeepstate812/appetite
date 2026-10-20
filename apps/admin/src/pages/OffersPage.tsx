import { useCallback, useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { DiscountMode, hasFoodInfo, requiresFoodInfo, type Offer } from "@apetite/shared";
import { useBusinessStore } from "../store/businessStore";
import { offersApi } from "../api/offers";
import { resolveAssetUrl } from "../api/client";
import { OfferStatusBadge } from "../components/StatusBadge";
import { LoadingView, EmptyView, ErrorView } from "../components/StateViews";
import { OfferFormModal } from "../components/OfferFormModal";
import { QuickOfferCreate } from "../components/QuickOfferCreate";
import { WorkingHoursCard } from "../components/WorkingHoursCard";
import { SchedulesPanel } from "../components/SchedulesPanel";
import { CATEGORY_LABELS } from "../constants";
import { computeNetPayout, isInTrial } from "../utils/commission";
import { foodInfoSuggestions } from "../utils/foodInfo";

export function OffersPage() {
  const business = useBusinessStore((state) => state.business);
  const businessLoading = useBusinessStore((state) => state.loading);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [modalState, setModalState] = useState<{ mode: "create" } | { mode: "edit"; offer: Offer } | null>(null);

  const load = useCallback(async () => {
    if (!business) return;
    setError(null);
    try {
      const result = await offersApi.list({ businessId: business.id, pageSize: 100 });
      setOffers(result.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить офферы");
    }
  }, [business]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleArchive = async (offer: Offer) => {
    if (!confirm(`Перевести «${offer.title}» в архив? Оффер исчезнет из витрины, история заказов сохранится.`)) return;
    setActionNote(null);
    try {
      await offersApi.update(offer.id, { status: "ARCHIVED" as Offer["status"] });
      setActionNote({ tone: "ok", text: `«${offer.title}» в архиве` });
    } catch (actionError) {
      setActionNote({ tone: "error", text: actionError instanceof Error ? actionError.message : "Не удалось убрать оффер в архив" });
    }
    await load();
  };

  const handleDelete = async (offer: Offer) => {
    const sold = offer.quantityTotal - offer.quantityLeft;
    const lines = [`Удалить «${offer.title}» безвозвратно? Это действие нельзя отменить.`];
    if (offer.status === "ACTIVE") lines.push("Оффер сейчас на витрине — покупатели перестанут его видеть сразу.");
    if (sold > 0) lines.push(`По нему уже есть заказы (${sold} шт.) — тогда удалить не получится, оффер можно только убрать в архив.`);
    if (offer.scheduleId) lines.push("Он выложен автовыкладкой: эта дата в шаблоне будет пропущена, остальные дни не затронуты.");
    if (!confirm(lines.join("\n\n"))) return;
    setActionNote(null);
    try {
      const result = await offersApi.remove(offer.id);
      setActionNote({ tone: "ok", text: result.skippedDate ? `«${offer.title}» удалён, дата ${result.skippedDate} пропущена в шаблоне` : `«${offer.title}» удалён` });
    } catch (actionError) {
      setActionNote({ tone: "error", text: actionError instanceof Error ? actionError.message : "Не удалось удалить оффер" });
    }
    await load();
  };

  if (businessLoading || (!business && !error)) {
    return <LoadingView label="Загрузка..." />;
  }
  if (!business) {
    return <ErrorView label="Заведение не найдено для этого аккаунта" />;
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Офферы</h1>
          <p style={{ color: "var(--color-text-muted)", marginTop: 4, fontSize: 14 }}>{business.name}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalState({ mode: "create" })}>
          + Новый оффер
        </button>
      </div>

      <WorkingHoursCard business={business} />

      <QuickOfferCreate business={business} onCreated={() => void load()} foodSuggestions={foodInfoSuggestions(offers ?? [])} />

      <SchedulesPanel business={business} onChanged={() => void load()} />

      {actionNote ? (
        <p
          role={actionNote.tone === "error" ? "alert" : "status"}
          data-testid="offers-action-note"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            background: actionNote.tone === "error" ? "var(--color-danger-soft)" : "var(--color-primary-soft)",
            color: actionNote.tone === "error" ? "var(--color-danger)" : "var(--color-primary-dark)",
          }}
        >
          {actionNote.text}
        </p>
      ) : null}

      {error ? (
        <ErrorView label={error} />
      ) : offers === null ? (
        <LoadingView label="Загрузка офферов..." />
      ) : offers.length === 0 ? (
        <EmptyView label="Офферов пока нет — создай первый" />
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Категория</th>
                <th>Цена</th>
                <th>Скидка</th>
                <th>Вы получаете</th>
                <th>Остаток</th>
                <th>Самовывоз</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {offer.imageUrl ? (
                        <img className="offer-thumb" src={resolveAssetUrl(offer.imageUrl) ?? ""} alt="" loading="lazy" />
                      ) : (
                        <span className="offer-thumb offer-thumb-empty" role="img" title="Без фото" aria-label="Без фото">
                          <ImageOff size={18} aria-hidden="true" />
                        </span>
                      )}
                      {offer.title}
                      {offer.scheduleId ? (
                        <span className="badge badge-primary" title="Выложен автоматически по шаблону">
                          авто
                        </span>
                      ) : null}
                      {requiresFoodInfo(offer.category) && !hasFoodInfo(offer) ? (
                        <span className="badge badge-warning" title="Покупатель не видит состав и аллергены — открой «Изменить» и заполни">
                          нет состава
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>{CATEGORY_LABELS[offer.category]}</td>
                  <td>
                    {(offer.discountedPrice / 100).toFixed(0)} ₽{" "}
                    <span style={{ color: "var(--color-text-muted)", textDecoration: "line-through", fontSize: 12 }}>
                      {(offer.originalPrice / 100).toFixed(0)} ₽
                    </span>
                  </td>
                  <td>
                    −{offer.discountPercent}%
                    <span style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)" }}>
                      {offer.discountMode === DiscountMode.FIXED ? "фиксированная" : "растёт к концу"}
                    </span>
                  </td>
                  <td>
                    {computeNetPayout(offer.discountedPrice / 100, business).toFixed(0)} ₽
                    {isInTrial(business) ? (
                      <span style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)" }}>без комиссии</span>
                    ) : null}
                  </td>
                  <td>
                    {offer.quantityLeft} / {offer.quantityTotal}
                  </td>
                  <td style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                    {new Date(offer.pickupStart).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {" – "}
                    {new Date(offer.pickupEnd).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td>
                    <OfferStatusBadge status={offer.status} />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setModalState({ mode: "edit", offer })}>
                        Изменить
                      </button>
                      {offer.status !== "ARCHIVED" ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => void handleArchive(offer)}>
                          В архив
                        </button>
                      ) : null}
                      <button className="btn btn-danger btn-sm" onClick={() => void handleDelete(offer)}>
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalState ? (
        <OfferFormModal
          business={business}
          offer={modalState.mode === "edit" ? modalState.offer : undefined}
          foodSuggestions={foodInfoSuggestions(offers ?? [])}
          onClose={() => setModalState(null)}
          onSaved={() => {
            setModalState(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
