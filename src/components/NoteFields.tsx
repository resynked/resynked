import Select, { SelectOption } from '@/components/Select';

export interface NoteFormData {
  customer_id: string;
  title: string;
  content: string;
}

/**
 * De velden van een notitie, voor nieuw en bewerken. Zelfde opbouw als bij
 * Instellingen: links wat het is, rechts het veld.
 */
export default function NoteFields({
  formData,
  onChange,
  customerOptions,
}: {
  formData: NoteFormData;
  onChange: (formData: NoteFormData) => void;
  customerOptions: SelectOption[];
}) {
  return (
    <>
      <div className="row-section">
        <div className="information">
          <span className="title">Klant</span>
          <span className="description">De notitie staat ook bij deze klant, onder Notities.</span>
        </div>
        <div>
          <Select
            value={customerOptions.find(o => o.value === formData.customer_id) || null}
            onChange={(option) => onChange({ ...formData, customer_id: option?.value || '' })}
            options={customerOptions}
            placeholder="Selecteer klant..."
          />
        </div>
      </div>

      <div className="row-section">
        <div className="information">
          <label className="title" htmlFor="title">Titel</label>
          <span className="description">Kort en herkenbaar, zodat je hem in de lijst terugvindt.</span>
        </div>
        <div>
          <input
            id="title"
            type="text"
            value={formData.title}
            onChange={(e) => onChange({ ...formData, title: e.target.value })}
            placeholder="Bijvoorbeeld: Opname badkamer"
            required
          />
        </div>
      </div>

      <div className="row-section">
        <div className="information">
          <label className="title" htmlFor="content">Notitie</label>
          <span className="description">Maten, afspraken of wat je verder wilt onthouden.</span>
        </div>
        <div>
          <textarea
            id="content"
            rows={12}
            value={formData.content}
            onChange={(e) => onChange({ ...formData, content: e.target.value })}
            placeholder="Schrijf je notitie..."
            required
          />
        </div>
      </div>
    </>
  );
}
