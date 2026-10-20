import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Только мобильная версия (см. .back-button в global.css, брейкпоинт как у гамбургера,
 * 900px) — на десктопе для этого достаточно обычной кнопки "назад" браузера, а на
 * телефоне (особенно в туннеле/вебвью без нативного жеста) единственным способом уйти
 * со страницы входа/регистрации/оферты был логотип в шапке, ведущий только на главную.
 *
 * navigate(-1) возвращает туда, откуда реально пришли (а не всегда на "/"), но только
 * если у вкладки вообще есть история; при прямом заходе по ссылке (idx === 0 —
 * так react-router хранит позицию в history.state) откатываться некуда — идём на fallback.
 */
export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const navigate = useNavigate();

  const handleClick = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback);
  };

  return (
    <button type="button" className="back-button" onClick={handleClick}>
      <ArrowLeft size={17} strokeWidth={2.2} aria-hidden="true" />
      Назад
    </button>
  );
}
