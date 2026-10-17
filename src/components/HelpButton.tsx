import { useState } from 'react';
import { CircleQuestionMark } from 'lucide-react';
import SidePanel from '@/components/SidePanel';
import { HELP } from '@/lib/help';

/**
 * Het vraagteken naast de titel van een pagina. Een klik opent rechts het
 * paneel met uitleg over die module; de teksten staan in lib/help.
 * Zelfde knop en paneel als de uitleg bij de sjablonen in Instellingen.
 */
export default function HelpButton({ topic }: { topic: keyof typeof HELP }) {
  const [open, setOpen] = useState(false);
  const help = HELP[topic];
  if (!help) return null;

  return (
    <>
      <button
        type="button"
        className="help"
        title={help.title}
        aria-label={help.title}
        onClick={() => setOpen(true)}
      >
        <CircleQuestionMark size={16} />
      </button>

      {open && (
        <SidePanel title={help.title} onClose={() => setOpen(false)}>
          {help.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {help.sections.map((section) => (
            <div key={section.title}>
              <h3>{section.title}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </SidePanel>
      )}
    </>
  );
}
