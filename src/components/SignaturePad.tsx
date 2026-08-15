import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  /** Aangeroepen bij elke streek; leeg zolang er niets getekend is */
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}

/**
 * Vak waarin de klant zijn handtekening zet, met de vinger op de telefoon of
 * met de muis op de computer.
 *
 * Pointer-events dekken vinger, pen en muis in één keer, dus er is geen aparte
 * afhandeling voor touch nodig.
 */
export default function SignaturePad({ onChange, disabled = false }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawing, setHasDrawing] = useState(false);

  /**
   * Een canvas rekt zijn inhoud uit als de tekenmaat niet gelijk is aan de maat
   * op het scherm. Daarom wordt hij op de echte pixelmaat gezet, zodat de lijn
   * scherp blijft op een telefoon.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();

      // Alleen bijstellen als het echt anders is: opnieuw instellen wist de tekening
      if (canvas.width === Math.round(width * ratio) && canvas.height === Math.round(height * ratio)) {
        return;
      }

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);

      const context = canvas.getContext('2d');
      if (!context) return;

      context.scale(ratio, ratio);
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = '#000';
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const positionOf = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    const context = canvasRef.current?.getContext('2d');
    if (!context) return;

    // Zo blijft de streek doorlopen als de vinger buiten het vak komt
    event.currentTarget.setPointerCapture(event.pointerId);

    const { x, y } = positionOf(event);
    context.beginPath();
    context.moveTo(x, y);
    drawing.current = true;
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;

    const context = canvasRef.current?.getContext('2d');
    if (!context) return;

    const { x, y } = positionOf(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const stop = () => {
    if (!drawing.current) return;

    drawing.current = false;
    setHasDrawing(true);
    onChange(canvasRef.current?.toDataURL('image/png') || null);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    onChange(null);
  };

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        className="pad"
        // Zonder dit scrollt de pagina mee terwijl iemand tekent
        style={{ touchAction: 'none' }}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
      />

      <div className="footer">
        <span className="hint">
          {hasDrawing ? 'Niet goed? Wis en probeer opnieuw.' : 'Zet hier uw handtekening'}
        </span>

        <button type="button" className="clear" onClick={clear} disabled={disabled || !hasDrawing}>
          <Eraser size={15} />
          <span>Wissen</span>
        </button>
      </div>
    </div>
  );
}
