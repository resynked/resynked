import { KeyboardEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Een wachtwoordveld met een oogje om te zien wat je typt. Zelfde veld overal:
 * inloggen, een nieuw wachtwoord kiezen en Instellingen > Privacy.
 */
export default function PasswordInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  label,
  id,
  autoComplete = 'current-password',
  autoFocus,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  placeholder: string;
  /** Voor schermlezers, als er geen zichtbaar label bij staat */
  label?: string;
  id?: string;
  autoComplete?: 'current-password' | 'new-password';
  autoFocus?: boolean;
  /** Rode rand, als het veld nog niet goed is ingevuld */
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-label={label}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
      <button
        type="button"
        aria-label={visible ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
        onClick={() => setVisible((shown) => !shown)}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
