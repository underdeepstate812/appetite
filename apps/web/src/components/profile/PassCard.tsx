import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Camera, Lock, Pencil } from "lucide-react";
import type { EcoSummary } from "@apetite/shared";
import { usersApi } from "../../api/users";
import { ApiError, resolveAssetUrl } from "../../api/client";
import { authActions, useAuth } from "../../store/auth";
import { formatMemberSince, levelProgressRatio, passBars, passSerial } from "../../utils/pass";
import { isValidEmail } from "../../utils/validation";
import { LEVEL_NAMES } from "./EcoRoute";

const MIN_NAME_LENGTH = 2;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const RING = 92;
const STROKE = 2;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Кольцо вокруг фото — прогресс до следующего уровня (как кольцо активности); камера внизу справа — сменить фото. */
function Hero({ eco }: { eco: EcoSummary | null }) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const uri = resolveAssetUrl(user?.avatarUrl);
  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase();
  useEffect(() => setLoadFailed(false), [uri]);

  const progress = eco ? levelProgressRatio(eco.totalPoints, eco.level, eco.nextLevel) : 0;
  const levelName = eco ? LEVEL_NAMES[eco.level.id] : undefined;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!AVATAR_TYPES.includes(file.type)) return setError("Подойдёт фото в формате JPEG, PNG или WebP");
    if (file.size > MAX_AVATAR_BYTES) return setError("Фото больше 5 МБ — выберите поменьше");
    setUploading(true);
    try {
      authActions.setUser(await usersApi.uploadAvatar(file));
    } catch (uploadError) {
      setError(uploadError instanceof ApiError ? uploadError.message : "Не удалось загрузить фото");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="pass-hero">
      <button type="button" className="pass-avatar-btn" onClick={() => input.current?.click()} disabled={uploading} aria-label="Изменить фото">
        <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="pass-ring" aria-hidden="true">
          <circle cx={RING / 2} cy={RING / 2} r={RADIUS} stroke="rgba(255,255,255,0.22)" strokeWidth={STROKE} fill="none" />
          <circle
            cx={RING / 2}
            cy={RING / 2}
            r={RADIUS}
            stroke="#99f6e4"
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            className="pass-ring-arc"
          />
        </svg>
        <span className="pass-avatar">
          {uri && !loadFailed ? <img src={uri} alt="" onError={() => setLoadFailed(true)} /> : <b>{initial}</b>}
          {uploading ? <span className="pass-avatar-overlay"><span className="spinner" aria-hidden="true" /></span> : null}
        </span>
        <span className="pass-camera" aria-hidden="true">
          <Camera size={14} strokeWidth={2.4} />
        </span>
      </button>
      <input ref={input} type="file" accept={AVATAR_TYPES.join(",")} hidden onChange={(event) => void pick(event.target.files?.[0])} data-testid="avatar-input" />

      <h1 className="pass-name">{user?.name}</h1>
      <p className="pass-meta">
        {levelName ? (
          <>
            <span className="pass-level">{levelName.toUpperCase()}</span>
            <i aria-hidden="true" />
          </>
        ) : null}
        {user?.createdAt ? <span>С нами с {formatMemberSince(user.createdAt)}</span> : null}
      </p>
      <p className={`pass-status${error ? " is-error" : ""}`} role={error ? "alert" : "status"} aria-live="polite">
        {error ?? (uploading ? "Загружаем фото…" : "")}
      </p>
    </div>
  );
}

function Stat({ value, decimals, label }: { value: number | null; decimals: number; label: string }) {
  return (
    <div className="pass-stat">
      <strong>{value === null ? "—" : value.toFixed(decimals)}</strong>
      <span>{label.toUpperCase()}</span>
    </div>
  );
}

/** Личные данные: просмотр или правка на месте. Телефон в форму не входит — он нужен для входа и заказов, backend его не принимает. */
function Details() {
  const { user } = useAuth();
  const nameId = useId();
  const emailId = useId();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const nameError = touched && name.trim().length < MIN_NAME_LENGTH ? "Имя — минимум 2 символа" : null;
  const emailError = touched && !isValidEmail(email) ? "Некорректный email" : null;

  const start = () => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setTouched(false);
    setSaveError(null);
    setSaved(false);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setSaveError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (name.trim().length < MIN_NAME_LENGTH || !isValidEmail(email)) return;
    // Шлём только изменённое: правка имени не должна трогать email (и его уникальность).
    const changes: { name?: string; email?: string } = {};
    if (name.trim() !== user?.name) changes.name = name.trim();
    if (email.trim() !== user?.email) changes.email = email.trim();
    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      authActions.setUser(await usersApi.updateProfile(changes));
      setEditing(false);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof ApiError ? error.message : "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  };

  const phone = (
    <div className="pass-field">
      <p className="profile-overline">ТЕЛЕФОН</p>
      <p className="pass-value">
        <span className={editing || !user?.phone ? "is-muted" : ""}>{user?.phone ?? "Не указан"}</span>
        {user?.phone ? (
          <span className="pass-lock">
            <Lock size={11} strokeWidth={2.4} aria-hidden="true" /> закреплён
          </span>
        ) : null}
      </p>
      {editing ? <p className="pass-hint">Нельзя изменить — номер нужен для входа и заказов</p> : null}
    </div>
  );

  return (
    <div className="pass-details">
      <div className="pass-details-head">
        <p className="profile-overline">ЛИЧНЫЕ ДАННЫЕ</p>
        {editing ? null : (
          <button type="button" className="pass-edit" onClick={start} aria-label="Редактировать">
            <Pencil size={13} strokeWidth={2.4} aria-hidden="true" /> Редактировать
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <div className="field">
            <label htmlFor={nameId}>Имя</label>
            <input id={nameId} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className={nameError ? "field-invalid" : ""} aria-invalid={!!nameError} aria-describedby={nameError ? `${nameId}-err` : undefined} />
            {nameError ? <span id={`${nameId}-err`} className="field-error" role="alert">{nameError}</span> : null}
          </div>
          <div className="field">
            <label htmlFor={emailId}>Email</label>
            <input id={emailId} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className={emailError ? "field-invalid" : ""} aria-invalid={!!emailError} aria-describedby={emailError ? `${emailId}-err` : undefined} />
            {emailError ? <span id={`${emailId}-err`} className="field-error" role="alert">{emailError}</span> : null}
          </div>
          {phone}
          {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
          <div className="pass-actions">
            <button type="button" className="btn btn-secondary" onClick={cancel} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="pass-field">
            <p className="profile-overline">EMAIL</p>
            <p className="pass-value">{user?.email}</p>
          </div>
          {phone}
          <p className="pass-saved" role="status" aria-live="polite">
            {saved ? "Сохранено" : ""}
          </p>
        </>
      )}
    </div>
  );
}

/** Штрих-код корешка: номер и рисунок выводятся из id пользователя — это именно этот пропуск, а не картинка-заполнитель. */
function Footer({ userId }: { userId: string | undefined }) {
  const serial = passSerial(userId);
  const bars = useMemo(() => passBars(userId), [userId]);
  let x = 0;
  const rects = bars.map((w, i) => {
    const rect = { x, w, i };
    x += w + 1.6;
    return rect;
  });
  return (
    <div className="pass-footer">
      <span className="pass-serial">№ {serial}</span>
      <svg width={x} height={26} viewBox={`0 0 ${x} 26`} aria-hidden="true" className="pass-barcode">
        {rects.map(({ x: rx, w, i }) => (
          <rect key={i} x={rx} y={0} width={w} height={26} />
        ))}
      </svg>
    </div>
  );
}

/** «Пропуск спасателя еды»: фото, имя и уровень — на лицевой части, цифры, данные и штрих-код — на корешке за линией отрыва. */
export function PassCard({ eco }: { eco: EcoSummary | null }) {
  const { user } = useAuth();
  return (
    <article className="pass" aria-label="Пропуск спасателя еды">
      <Hero eco={eco} />
      <div className="pass-stub">
        <div className="pass-stats">
          <Stat value={eco ? eco.totalPoints : null} decimals={0} label="Баллы" />
          <Stat value={eco ? eco.totalWeightSavedKg : null} decimals={1} label="Кг спасено" />
          <Stat value={eco ? eco.ordersCompleted : null} decimals={0} label="Заказов" />
        </div>
        <Details />
        <Footer userId={user?.id} />
      </div>
    </article>
  );
}
