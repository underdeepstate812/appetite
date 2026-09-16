import { useCallback, useEffect, useState } from "react";
import type { Offer } from "@apetite/shared";
import { useBusinessStore } from "../store/businessStore";
import { offersApi } from "../api/offers";
import { OfferStatusBadge } from "../components/StatusBadge";
import { LoadingView, EmptyView, ErrorView } from "../components/StateViews";
import { OfferFormModal } from "../components/OfferFormModal";
import { CATEGORY_LABELS } from "../constants";

export function OffersPage() {
  const business = useBusinessStore((state) => state.business);
  const businessLoading = useBusinessStore((state) => state.loading);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    if (!confirm(`Перевести «${offer.title}» в архив? Оффер исчезнет из витрины.`)) return;
    await offersApi.update(offer.id, { status: "ARCHIVED" as Offer["status"] });
    await load();
  };

  const handleDelete = async (offer: Offer) => {
    if (!confirm(`Удалить «${offer.title}» безвозвратно? Это действие нельзя отменить.`)) return;
    await offersApi.remove(offer.id);
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
                <th>Остаток</th>
                <th>Самовывоз</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td style={{ fontWeight: 600 }}>{offer.title}</td>
                  <td>{CATEGORY_LABELS[offer.category]}</td>
                  <td>
                    {(offer.discountedPrice / 100).toFixed(0)} ₽{" "}
                    <span style={{ color: "var(--color-text-muted)", textDecoration: "line-through", fontSize: 12 }}>
                      {(offer.originalPrice / 100).toFixed(0)} ₽
                    </span>
                  </td>
                  <td>−{offer.discountPercent}%</td>
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
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setModalState({ mode: "edit", offer })}>
                        Изменить
                      </button>
                      {offer.status !== "ARCHIVED" ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => void handleArchive(offer)}>
                          В архив
                        </button>
                      ) : (
                        <button className="btn btn-danger btn-sm" onClick={() => void handleDelete(offer)}>
                          Удалить
                        </button>
                      )}
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
          businessId={business.id}
          offer={modalState.mode === "edit" ? modalState.offer : undefined}
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
