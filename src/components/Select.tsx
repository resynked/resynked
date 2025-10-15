import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: SelectOption | null;
  onChange: (option: SelectOption | null) => void;
  placeholder?: string;
  isClearable?: boolean;
  isDisabled?: boolean;
}

export default function Select({
  options,
  value,
  onChange,
  placeholder = 'Selecteer...',
  isClearable = false,
  isDisabled = false
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: SelectOption) => {
    onChange(option);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setIsOpen(false);
  };

  return (
    <div className="select" ref={selectRef}>
      <div
        className={`control ${isOpen ? 'open' : ''}`}
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        style={{ opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
      >
        <div className="value">
          {value ? value.label : <span style={{ color: 'var(--font-color2)' }}>{placeholder}</span>}
        </div>
        <div className="arrow">
          <ChevronDown size={16} />
        </div>
      </div>

      {isOpen && !isDisabled && (
        <div className="menu">
          {isClearable && value && (
            <div className="option" onClick={handleClear}>
              <span style={{ color: 'var(--font-color2)' }}>Wissen</span>
            </div>
          )}
          {options.length === 0 ? (
            <div className="option" style={{ color: 'var(--font-color2)', cursor: 'default' }}>
              Geen opties beschikbaar
            </div>
          ) : (
            options.map((option) => (
              <div
                key={option.value}
                className={`option ${value?.value === option.value ? 'selected' : ''}`}
                onClick={() => handleSelect(option)}
              >
                {option.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
