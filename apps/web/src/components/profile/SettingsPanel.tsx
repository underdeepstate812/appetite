import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { themeActions, useThemeMode, type ThemeMode } from "../../store/theme";

const OPTIONS: { value: ThemeMode; label: string; Icon: LucideIcon }[] = [
  { value: "system", label: "Системная", Icon: Monitor },
  { value: "light", label: "Светлая", Icon: Sun },
  { value: "dark", label: "Тёмная", Icon: Moon },
];

/** Настройки на сайте. Тема — как в мобильном приложении: системная, светлая, тёмная; выбор запоминается в браузере. */
export function SettingsPanel() {
  const mode = useThemeMode();
  const current = OPTIONS.find((option) => option.value === mode) ?? OPTIONS[0];
  return (
    <section className="profile-card" aria-labelledby="settings-title">
      <p id="settings-title" className="profile-overline">
        НАСТРОЙКИ
      </p>
      <div className="settings-row">
        <div className="settings-labels">
          <p className="settings-title">Тема оформления</p>
          <p className="settings-caption" data-testid="theme-caption">
            {current.label}
          </p>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Тема оформления">
          {OPTIONS.map(({ value, label, Icon }) => (
            <button key={value} type="button" role="radio" aria-checked={mode === value} aria-label={label} title={label} className={`segmented-option${mode === value ? " is-active" : ""}`} onClick={() => themeActions.set(value)}>
              <Icon size={17} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
