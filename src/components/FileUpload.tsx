import { useRef, useState } from 'react';
import { Image as ImageIcon, Upload, X } from 'lucide-react';

interface FileUploadProps {
  /** Het gekozen bestand als data-URL; leeg als er nog niets is gekozen */
  value: string;
  /** Bestandsnaam om bij het bestand te tonen; valt terug op een vast label */
  fileName?: string | null;
  /** Grootte in bytes om bij het bestand te tonen */
  fileSize?: number | null;
  /** Toegestane types, in dezelfde vorm als het accept-attribuut */
  accept: string;
  /** Grootste bestand dat nog geaccepteerd wordt, in bytes */
  maxBytes: number;
  /** Regel onder de knop, bijvoorbeeld welke types mogen */
  hint?: string;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}

/** Grootte als 12 kB of 1,4 MB */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Controleert het type tegen het accept-attribuut, inclusief vormen als image/* */
function isAccepted(file: File, accept: string): boolean {
  const patterns = accept
    .split(',')
    .map(pattern => pattern.trim().toLowerCase())
    .filter(Boolean);

  if (patterns.length === 0) return true;

  const type = file.type.toLowerCase();
  const extension = `.${(file.name.split('.').pop() || '').toLowerCase()}`;

  return patterns.some(pattern => {
    if (pattern.startsWith('.')) return pattern === extension;
    if (pattern.endsWith('/*')) return type.startsWith(pattern.slice(0, -1));
    return pattern === type;
  });
}

/**
 * Vlak om een bestand in te slepen of aan te klikken. Is er een bestand
 * gekozen, dan komt het eronder te staan met een voorbeeld, de naam, de
 * grootte en een kruisje om het weg te halen.
 */
export default function FileUpload({
  value,
  fileName,
  fileSize,
  accept,
  maxBytes,
  hint,
  disabled = false,
  onSelect,
  onRemove,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;

    if (!isAccepted(file, accept)) {
      setError('Dit bestandstype wordt niet ondersteund.');
      return;
    }

    if (file.size > maxBytes) {
      setError(`Dit bestand is ${formatBytes(file.size)}; maximaal ${formatBytes(maxBytes)}.`);
      return;
    }

    setError(null);
    onSelect(file);
  };

  // Het slepen van een bestand over het vlak moet de browser niet zelf oppakken
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="file-upload">
      <button
        type="button"
        className={`dropzone${isDragging ? ' dragging' : ''}`}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <span className="icon">
          <Upload size={18} />
        </span>
        <span className="instruction">
          {isDragging ? 'Laat los om het bestand te kiezen' : 'Sleep een bestand hierheen of klik om te kiezen'}
        </span>
        {hint && <span className="hint">{hint}</span>}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          // Leegmaken, anders komt hetzelfde bestand een tweede keer niet door
          event.target.value = '';
        }}
      />

      {error && <p className="file-error">{error}</p>}

      {value && (
        <div className="attachment">
          <span className="preview">
            {value.startsWith('data:image') || value.startsWith('http') ? (
              <img src={value} alt="" />
            ) : (
              <ImageIcon size={18} />
            )}
          </span>

          <span className="details">
            <span className="name">{fileName || 'Gekozen bestand'}</span>
            {fileSize ? <span className="meta">{formatBytes(fileSize)}</span> : null}
          </span>

          <button
            type="button"
            className="remove"
            disabled={disabled}
            aria-label="Bestand verwijderen"
            title="Verwijderen"
            onClick={() => {
              setError(null);
              onRemove();
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
