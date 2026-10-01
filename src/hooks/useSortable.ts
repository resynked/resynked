import { useState } from 'react';

/**
 * Waarmee een rij herkend wordt. Meestal zijn dat de plekken in één lijst,
 * maar bij regels in een prijstabel staan er meer lijsten onder elkaar; dan
 * is het bijvoorbeeld "2:5" voor de zesde regel van het derde element.
 */
export type Sleutel = string | number;

/**
 * Slepen om de volgorde te veranderen, met wat de browser er zelf voor heeft.
 *
 * Alleen het handvat begint een sleep: de rij zelf wordt pas sleepbaar zodra
 * de muisknop op het handvat ingedrukt wordt. Anders zou je geen tekst meer
 * kunnen selecteren in de velden die in zo'n rij staan.
 */
export function useSortable(onMove: (van: Sleutel, naar: Sleutel) => void) {
  const [sleept, setSleept] = useState<Sleutel | null>(null);
  const [doel, setDoel] = useState<Sleutel | null>(null);
  const [losgelaten, setLosgelaten] = useState<Sleutel | null>(null);

  const stop = () => {
    setSleept(null);
    setDoel(null);
    setLosgelaten(null);
  };

  return {
    /** Welke rij op dit moment gesleept wordt */
    sleept,
    /** Waar hij terechtkomt als je nu loslaat */
    doel,

    /** Op het handvat: pas hier wordt de rij sleepbaar */
    greep: (index: Sleutel) => ({
      onMouseDown: () => setLosgelaten(index),
      onMouseUp: () => setLosgelaten(null),
    }),

    /** Op de rij zelf */
    item: (index: Sleutel) => ({
      draggable: losgelaten === index,
      onDragStart: (event: React.DragEvent) => {
        setSleept(index);
        event.dataTransfer.effectAllowed = 'move';
        // Zonder inhoud begint Firefox niet eens aan een sleep
        event.dataTransfer.setData('text/plain', String(index));
      },
      onDragEnd: stop,
      onDragOver: (event: React.DragEvent) => {
        if (sleept === null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (doel !== index) setDoel(index);
      },
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        if (sleept !== null && sleept !== index) onMove(sleept, index);
        stop();
      },
    }),

    /** De toestand als klassenaam, voor de opmaak */
    klasse: (index: Sleutel) =>
      [sleept === index ? 'dragging' : '', doel === index && sleept !== index ? 'drop-target' : '']
        .filter(Boolean)
        .join(' '),
  };
}
