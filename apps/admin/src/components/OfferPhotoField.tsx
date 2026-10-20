import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { ImagePlus, Images, Trash2, Upload } from "lucide-react";
import type { OfferCategory } from "@apetite/shared";
import { offersApi, type PhotoPreset } from "../api/offers";
import { ApiError, resolveAssetUrl } from "../api/client";
import { CATEGORY_LABELS } from "../constants";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface OfferPhotoFieldProps {
  value: string | null;
  onChange: (imageUrl: string | null) => void;
  category: OfferCategory;
  /** Для alt-текста превью. */
  title?: string;
  /** Компактный вид для строки быстрого создания. */
  compact?: boolean;
  /** Пока идёт загрузка, форму нельзя отправлять: иначе оффер сохранится без только что выбранного фото. */
  onBusyChange?: (busy: boolean) => void;
  /** id подписи поля (для скринридеров). */
  labelledBy?: string;
}

// Библиотека не меняется во время сессии — грузим один раз на все формы.
let presetsPromise: Promise<PhotoPreset[]> | null = null;
function loadPresets(): Promise<PhotoPreset[]> {
  presetsPromise ??= offersApi.photoPresets().catch((error) => {
    presetsPromise = null; // после сбоя следующая попытка должна пойти заново
    throw error;
  });
  return presetsPromise;
}

/** Проверка на клиенте — только ради быстрой обратной связи; настоящая проверка (по содержимому файла) на сервере. */
export function validatePhotoFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Подойдут только изображения JPEG, PNG или WebP";
  if (file.size > MAX_PHOTO_BYTES) return "Файл слишком большой — максимум 5 МБ";
  return null;
}

/**
 * Фото оффера: своё (загрузка, перетаскивание, вставка из буфера) или готовое из библиотеки по умолчанию.
 * Без фото покупатель увидит значок категории — фото не обязательно.
 */
export function OfferPhotoField({ value, onChange, category, title, compact = false, onBusyChange, labelledBy }: OfferPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [presets, setPresets] = useState<PhotoPreset[] | null>(null);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const src = resolveAssetUrl(value);

  useEffect(() => {
    onBusyChange?.(uploading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploading]);

  useEffect(() => {
    if (!libraryOpen || presets) return;
    let cancelled = false;
    setPresetsError(null);
    loadPresets().then(
      (list) => !cancelled && setPresets(list),
      (loadError) => !cancelled && setPresetsError(loadError instanceof ApiError ? loadError.message : "Не удалось загрузить библиотеку")
    );
    return () => {
      cancelled = true;
    };
  }, [libraryOpen, presets]);

  const upload = async (file: File) => {
    const problem = validatePhotoFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const { imageUrl } = await offersApi.uploadPhoto(file);
      onChange(imageUrl);
      setLibraryOpen(false);
    } catch (uploadError) {
      setError(uploadError instanceof ApiError ? uploadError.message : "Не удалось загрузить фото");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file && !uploading) void upload(file);
  };

  const handlePaste = (event: ClipboardEvent) => {
    const item = Array.from(event.clipboardData.items).find((entry) => entry.kind === "file" && entry.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file && !uploading) {
      event.preventDefault();
      void upload(file);
    }
  };

  // Сначала фото своей категории — человеку, который добавляет роллы, не нужен букет первым в списке.
  const sortedPresets = presets ? [...presets].sort((a, b) => Number(b.category === category) - Number(a.category === category)) : null;

  return (
    <div className={`photo-field${compact ? " is-compact" : ""}`} onPaste={handlePaste} role="group" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : "Фото оффера"}>
      <div className="photo-field-main">
        <div
          className={`photo-field-preview${dragOver ? " is-dragover" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {src ? (
            <img src={src} alt={title ? `Фото: ${title}` : "Фото оффера"} />
          ) : (
            <span className="photo-field-empty">
              <ImagePlus size={compact ? 20 : 28} aria-hidden="true" />
              {compact ? null : <small>Перетащите фото сюда или вставьте из буфера</small>}
            </span>
          )}
          {uploading ? (
            <span className="photo-field-busy" role="status">
              Загружаем…
            </span>
          ) : null}
        </div>

        <div className="photo-field-actions">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            hidden
            aria-label="Файл с фото"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = ""; // тот же файл можно выбрать повторно после ошибки
              if (file) void upload(file);
            }}
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload size={14} aria-hidden="true" /> Загрузить своё
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-expanded={libraryOpen}
            onClick={() => setLibraryOpen((open) => !open)}
            disabled={uploading}
          >
            <Images size={14} aria-hidden="true" /> Из библиотеки
          </button>
          {value ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(null)} disabled={uploading}>
              <Trash2 size={14} aria-hidden="true" /> Убрать
            </button>
          ) : null}
          {compact ? null : (
            <p className="field-hint">JPEG, PNG или WebP до 5 МБ. Без фото покупатели увидят значок категории «{CATEGORY_LABELS[category]}».</p>
          )}
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {libraryOpen ? (
        <div className="photo-library" role="group" aria-label="Библиотека фото">
          {presetsError ? (
            <p className="form-error" role="alert">
              {presetsError}{" "}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPresets(null)}>
                Повторить
              </button>
            </p>
          ) : !sortedPresets ? (
            <p className="field-hint">Загружаем библиотеку…</p>
          ) : (
            sortedPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`photo-library-item${value === preset.url ? " is-selected" : ""}`}
                aria-pressed={value === preset.url}
                onClick={() => {
                  onChange(preset.url);
                  setError(null);
                  setLibraryOpen(false);
                }}
              >
                <img src={resolveAssetUrl(preset.url) ?? ""} alt="" loading="lazy" />
                <span>{preset.label}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
