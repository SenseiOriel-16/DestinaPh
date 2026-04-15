import { useEffect, useMemo, useRef, useState } from "react";

export type SearchableSelectOption = { value: string; label: string };

export type SearchableSelectProps = {
  id: string;
  /** Optional className for the root wrapper (useful for layout/width tweaks). */
  className?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  disabled?: boolean;
  /** Text when closed and no value */
  placeholder: string;
  /** Search input hint when panel is open */
  searchPlaceholder?: string;
  /** Show a first row that sets value to "" */
  allowClear?: boolean;
  clearLabel?: string;
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export function SearchableSelect({
  id,
  className,
  value,
  onChange,
  options,
  disabled,
  placeholder,
  searchPlaceholder = "Search…",
  allowClear,
  clearLabel = "— Clear —",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options;
    return options.filter(
      (o) => normalize(o.label).includes(q) || normalize(o.value).includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const showTriggerText = disabled ? placeholder : selectedLabel || placeholder;

  return (
    <div
      ref={rootRef}
      className={[`searchable-select${open ? " searchable-select--open" : ""}`, className].filter(Boolean).join(" ")}
    >
      <button
        id={id}
        type="button"
        className="searchable-select__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
      >
        <span className={`searchable-select__value${!selectedLabel && !disabled ? " searchable-select__value--muted" : ""}`}>
          {showTriggerText}
        </span>
        <span className="searchable-select__chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open && !disabled && (
        <div className="searchable-select__panel" role="listbox" aria-labelledby={id}>
          <input
            type="search"
            className="searchable-select__search"
            placeholder={searchPlaceholder}
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={searchPlaceholder}
          />
          <div className="searchable-select__list">
            {allowClear && (
              <button
                type="button"
                role="option"
                aria-selected={value === ""}
                className={`searchable-select__option${value === "" ? " searchable-select__option--active" : ""}`}
                onClick={() => pick("")}
              >
                {clearLabel}
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="searchable-select__empty">No matches</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value || "__empty__"}
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`searchable-select__option${o.value === value ? " searchable-select__option--active" : ""}`}
                  onClick={() => pick(o.value)}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
