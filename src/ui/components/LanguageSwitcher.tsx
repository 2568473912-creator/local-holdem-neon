import { LANGUAGE_OPTIONS, type AppLanguage } from '../../i18n';

interface LanguageSwitcherProps {
  language: AppLanguage;
  onChange: (language: AppLanguage) => void;
  compact?: boolean;
  label: string;
}

export function LanguageSwitcher({ language, onChange, compact = false, label }: LanguageSwitcherProps) {
  return (
    <label className={`language-switcher ${compact ? 'compact' : ''}`}>
      <span>{label}</span>
      <select value={language} onChange={(event) => onChange(event.target.value as AppLanguage)} aria-label={label}>
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
