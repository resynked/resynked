interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Voor schermlezers: waar de schakelaar over gaat */
  label: string;
  disabled?: boolean;
}

/** Een aan/uit-schakelaar; groen als hij aan staat. */
export default function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle${checked ? ' on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="knob" />
    </button>
  );
}
