import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

/** Of de gebruiker al ergens aan het typen is; dan is F gewoon een letter */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Het zoekveld, met rechts de sneltoets. Druk ergens op de pagina op F en je
 * typt meteen in het zoekveld; met Esc ben je er weer uit.
 */
export default function SearchInput({
  value,
  onChange,
  onKeyDown,
  placeholder = 'Zoeken',
  label = 'Zoeken',
  shortcut = 'f',
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  /** Voor schermlezers, als de placeholder niet genoeg zegt */
  label?: string;
  shortcut?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== shortcut || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcut]);

  return (
    <label className="search">
      <Search size={15} />
      <input
        ref={inputRef}
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        aria-keyshortcuts={shortcut.toUpperCase()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.currentTarget.blur();
          onKeyDown?.(event);
        }}
      />
      {/* De sneltoets alleen zolang je nog niet in het veld zit */}
      {!focused && !value && <kbd>{shortcut.toUpperCase()}</kbd>}
    </label>
  );
}
