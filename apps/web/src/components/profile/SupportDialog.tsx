import { useRef, useState } from "react";
import { LifeBuoy } from "lucide-react";
import type { User } from "@apetite/shared";
import { useModalA11y } from "../../hooks/useModalA11y";
import { SUPPORT_EMAIL, SUPPORT_REASONS, buildSupportMailto, type SupportReason } from "../../utils/support";

/** «Помощь и поддержка»: тема обращения попадает в письмо вместе с данными аккаунта, поддержке не нужно переспрашивать. */
export function SupportDialog({ user, onClose }: { user: Pick<User, "id" | "name" | "email">; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState<SupportReason>("general");
  useModalA11y(ref, onClose);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={ref} className="modal card" role="dialog" aria-modal="true" aria-labelledby="support-title" tabIndex={-1}>
        <span className="modal-icon" aria-hidden="true">
          <LifeBuoy size={22} />
        </span>
        <h2 id="support-title">Нужна помощь?</h2>
        <p className="modal-offer">Выберите тему — мы подставим её в письмо.</p>
        <div className="support-reasons" role="radiogroup" aria-label="О чём письмо">
          {SUPPORT_REASONS.map((item) => (
            <button key={item.value} type="button" role="radio" aria-checked={reason === item.value} className={`support-reason${reason === item.value ? " is-active" : ""}`} onClick={() => setReason(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
        <p className="modal-fineprint">
          Отменить оплаченный заказ можно только через поддержку. Если почта не открылась — напишите на <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
          <a className="btn btn-primary" href={buildSupportMailto(reason, user)} onClick={onClose}>
            Написать на почту
          </a>
        </div>
      </div>
    </div>
  );
}
