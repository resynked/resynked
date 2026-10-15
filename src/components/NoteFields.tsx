import Select, { SelectOption } from '@/components/Select';
import RichTextEditor from '@/components/RichTextEditor';
import { isRichTextEmpty } from '@/lib/richtext';

export interface NoteFormData {
  customer_id: string;
  title: string;
  /** De notitie als HTML uit de teksteditor */
  content: string;
}

export type NoteErrors = Partial<Record<keyof NoteFormData, string>>;

/** Wat er nog ontbreekt; leeg als de notitie opgeslagen kan worden */
export function validateNote(formData: NoteFormData): NoteErrors {
  const errors: NoteErrors = {};
  if (!formData.customer_id) errors.customer_id = 'Kies bij welke klant de notitie hoort';
  if (!formData.title.trim()) errors.title = 'Geef de notitie een titel';
  if (isRichTextEmpty(formData.content)) errors.content = 'Schrijf iets in de notitie';
  return errors;
}

/**
 * De velden van een notitie, voor nieuw en bewerken. Zelfde opbouw als bij
 * Instellingen: links wat het is, rechts het veld. Een veld dat nog ontbreekt
 * krijgt een rode rand en eronder wat er mist.
 */
export default function NoteFields({
  formData,
  onChange,
  customerOptions,
  errors = {},
}: {
  formData: NoteFormData;
  onChange: (formData: NoteFormData) => void;
  customerOptions: SelectOption[];
  errors?: NoteErrors;
}) {
  return (
    <>
      <div className="row-section">
        <div className="information">
          <span className="title">Klant</span>
          <span className="description">De notitie staat ook bij deze klant, onder Notities.</span>
        </div>
        <div className={errors.customer_id ? 'invalid' : ''}>
          <Select
            value={customerOptions.find(o => o.value === formData.customer_id) || null}
            onChange={(option) => onChange({ ...formData, customer_id: option?.value || '' })}
            options={customerOptions}
            placeholder="Selecteer klant..."
          />
          {errors.customer_id && <p className="field-error">{errors.customer_id}</p>}
        </div>
      </div>

      <div className="row-section">
        <div className="information">
          <label className="title" htmlFor="title">Titel</label>
          <span className="description">Kort en herkenbaar, zodat je hem in de lijst terugvindt.</span>
        </div>
        <div className={errors.title ? 'invalid' : ''}>
          <input
            id="title"
            type="text"
            value={formData.title}
            aria-invalid={!!errors.title}
            onChange={(e) => onChange({ ...formData, title: e.target.value })}
            placeholder="Bijvoorbeeld: Opname badkamer"
          />
          {errors.title && <p className="field-error">{errors.title}</p>}
        </div>
      </div>

      <div className="row-section">
        <div className="information">
          <span className="title">Notitie</span>
          <span className="description">Maten, afspraken of wat je verder wilt onthouden.</span>
        </div>
        <div className={errors.content ? 'invalid' : ''}>
          <RichTextEditor
            value={formData.content}
            onChange={(content) => onChange({ ...formData, content })}
            placeholder="Schrijf je notitie..."
          />
          {errors.content && <p className="field-error">{errors.content}</p>}
        </div>
      </div>
    </>
  );
}
