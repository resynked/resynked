import { Trash2 } from 'lucide-react';
import Select from '@/components/Select';
import DatePicker from '@/components/DatePicker';
import FileUpload from '@/components/FileUpload';
import Toggle from '@/components/Toggle';
import { EXPENSE_CATEGORIES, VAT_RATES } from '@/lib/constants';
import { isVatDeductible, vatFor } from '@/lib/expenses';
import { formatCurrency } from '@/lib/utils';

const categoryOptions = EXPENSE_CATEGORIES.map(c => ({ value: c.value, label: c.label }));
const rateOptions = VAT_RATES.map(rate => ({ value: String(rate), label: `${rate}%` }));

/** Een regel zoals hij in het formulier staat: bedragen als tekst, zodat je vrij kunt typen */
export interface ExpenseLineForm {
  description: string;
  amount_excl: string;
  vat_rate: string;
  vat_amount: string;
}

export interface ExpenseFormData {
  supplier: string;
  reference: string;
  expense_date: string;
  due_date: string;
  description: string;
  category: string;
  status: 'open' | 'paid';
  paid_at: string;
  lines: ExpenseLineForm[];
}

/** Het bestand zoals het in het formulier staat: nieuw gekozen, of het bestaande */
export interface ExpenseFile {
  /** Data-URL bij een nieuw bestand; de link om te bekijken bij het bestaande */
  data: string;
  name: string;
  size?: number | null;
}

export type ExpenseErrors = Partial<Record<'supplier' | 'expense_date' | 'lines', string>>;

export const EMPTY_LINE: ExpenseLineForm = { description: '', amount_excl: '', vat_rate: '21', vat_amount: '' };

/** Wat er nog ontbreekt; leeg als de kostenpost opgeslagen kan worden */
export function validateExpense(formData: ExpenseFormData): ExpenseErrors {
  const errors: ExpenseErrors = {};
  if (!formData.supplier.trim()) errors.supplier = 'Vul de leverancier in';
  if (!formData.expense_date) errors.expense_date = 'Kies de datum van de bon of factuur';
  if (!formData.lines.some(line => Number(line.amount_excl) || Number(line.vat_amount))) errors.lines = 'Vul een bedrag in';
  return errors;
}

/** De regels als getallen, voor de API */
export function linesForSave(lines: ExpenseLineForm[]) {
  return lines.map(line => ({
    description: line.description,
    amount_excl: Number(line.amount_excl) || 0,
    vat_rate: Number(line.vat_rate) || 0,
    vat_amount: Number(line.vat_amount) || 0,
  }));
}

/**
 * Een foto als JPEG van hooguit 2000 pixels, zodat hij past (de grens is 3 MB)
 * en de AI hem snel leest. Een PDF gaat ongewijzigd mee.
 */
export function readFileForUpload(file: File): Promise<ExpenseFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Het bestand kon niet gelezen worden'));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      if (!file.type.startsWith('image/')) {
        if (dataUrl.length > 3 * 1024 * 1024 * 1.37) return reject(new Error('Deze PDF is groter dan 3 MB'));
        return resolve({ data: dataUrl, name: file.name, size: file.size });
      }

      const image = new Image();
      image.onerror = () => reject(new Error('Deze foto kon niet gelezen worden'));
      image.onload = () => {
        const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const jpeg = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ data: jpeg, name: file.name.replace(/\.\w+$/, '') + '.jpg', size: Math.round((jpeg.length * 3) / 4) });
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * De velden van een kostenpost, voor nieuw en bewerken. Zelfde opbouw als bij
 * Notities: links wat het is, rechts het veld. Bovenaan het bonnetje; met een
 * AI-plug-in vult dat de rest vanzelf in.
 */
export default function ExpenseFields({
  formData,
  onChange,
  file,
  fileUrl,
  onFileSelect,
  onFileRemove,
  scanning = false,
  hasAi,
  errors = {},
}: {
  formData: ExpenseFormData;
  onChange: (formData: ExpenseFormData) => void;
  file: ExpenseFile | null;
  /** Om het opgeslagen bestand te bekijken; leeg bij een nieuw bestand */
  fileUrl?: string | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  scanning?: boolean;
  hasAi: boolean;
  errors?: ExpenseErrors;
}) {
  const setLine = (index: number, changes: Partial<ExpenseLineForm>) => {
    const lines = formData.lines.map((line, i) => {
      if (i !== index) return line;
      const next = { ...line, ...changes };
      // Een nieuw bedrag of tarief rekent de btw opnieuw uit; de btw zelf blijft aan te passen
      if (changes.amount_excl !== undefined || changes.vat_rate !== undefined) {
        next.vat_amount = next.amount_excl === '' ? '' : vatFor(Number(next.amount_excl), Number(next.vat_rate)).toFixed(2);
      }
      return next;
    });
    onChange({ ...formData, lines });
  };

  const totalExcl = formData.lines.reduce((sum, line) => sum + (Number(line.amount_excl) || 0), 0);
  const totalVat = formData.lines.reduce((sum, line) => sum + (Number(line.vat_amount) || 0), 0);

  return (
    <>
      <div className="row-section">
        <div className="information">
          <span className="title">Bonnetje of factuur</span>
          <span className="description">
            {hasAi
              ? 'Een foto of PDF. De gegevens worden vanzelf ingevuld; controleer ze daarna.'
              : 'Een foto of PDF, zodat je hem zeven jaar terugvindt. Met een AI-plug-in worden de gegevens vanzelf ingevuld.'}
          </span>
        </div>
        <div className="form-section">
          <FileUpload
            value={file?.data || ''}
            fileName={scanning ? 'Wordt gelezen...' : file?.name}
            fileSize={file?.size ?? null}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            maxBytes={15 * 1024 * 1024}
            hint="JPG, PNG of PDF"
            disabled={scanning}
            onSelect={onFileSelect}
            onRemove={onFileRemove}
          />
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noreferrer" className="field-note">
              Bestand bekijken
            </a>
          )}
        </div>
      </div>

      <div className="row-section">
        <div className="information">
          <label className="title" htmlFor="supplier">Leverancier</label>
          <span className="description">De winkel of het bedrijf waar je het kocht.</span>
        </div>
        <div className={errors.supplier ? 'invalid' : ''}>
          <input
            id="supplier"
            type="text"
            value={formData.supplier}
            aria-invalid={!!errors.supplier}
            onChange={(e) => onChange({ ...formData, supplier: e.target.value })}
            placeholder="Vul de leverancier in"
          />
          {errors.supplier && <p className="field-error">{errors.supplier}</p>}
        </div>
      </div>

      <div className="row-section">
        <div className="information">
          <span className="title">Datum</span>
          <span className="description">De datum op de bon of factuur; daarop telt de btw.</span>
        </div>
        <div className={errors.expense_date ? 'invalid' : ''}>
          <DatePicker
            value={formData.expense_date}
            onChange={(expense_date) => onChange({ ...formData, expense_date })}
            placeholder="Selecteer een datum"
          />
          {errors.expense_date && <p className="field-error">{errors.expense_date}</p>}
        </div>
      </div>

      <div className="row-section">
        <div className="information">
          <label className="title" htmlFor="reference">Factuurnummer</label>
          <span className="description">Van de leverancier; bij een kassabon mag dit leeg.</span>
        </div>
        <div>
          <input
            id="reference"
            type="text"
            value={formData.reference}
            onChange={(e) => onChange({ ...formData, reference: e.target.value })}
            placeholder="Vul een factuurnummer in"
          />
        </div>
      </div>

      <div className="row-section">
        <div className="information">
          <span className="title">Categorie</span>
          <span className="description">
            Waar de kosten in je jaarcijfers op komen.
            {!isVatDeductible(formData.category) && ' Bij eten en drinken krijg je de btw niet terug.'}
          </span>
        </div>
        <div>
          <Select
            value={categoryOptions.find(o => o.value === formData.category) || null}
            onChange={(option) => onChange({ ...formData, category: option?.value || 'other' })}
            options={categoryOptions}
          />
        </div>
      </div>

      <div className="row-section">
        <div className="information">
          <label className="title" htmlFor="description">Omschrijving</label>
          <span className="description">Kort, zodat je hem in de lijst herkent.</span>
        </div>
        <div>
          <input
            id="description"
            type="text"
            value={formData.description}
            onChange={(e) => onChange({ ...formData, description: e.target.value })}
            placeholder="Vul een omschrijving in"
          />
        </div>
      </div>

      <div className="row-section">
        <div className="information">
          <span className="title">Bedragen</span>
          <span className="description">
            Per btw-tarief het bedrag exclusief btw, zoals onderaan de bon. Totaal {formatCurrency(totalExcl + totalVat)},
            waarvan {formatCurrency(totalVat)} btw.
          </span>
        </div>
        <div className={`form-section${errors.lines ? ' invalid' : ''}`}>
          {formData.lines.map((line, index) => (
            <div key={index} className="form-row">
              <div className="form-group">
                {index === 0 && <label>Bedrag excl. btw</label>}
                <input
                  type="number"
                  step="0.01"
                  value={line.amount_excl}
                  aria-label="Bedrag exclusief btw"
                  aria-invalid={!!errors.lines}
                  onChange={(e) => setLine(index, { amount_excl: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="form-group">
                {index === 0 && <label>Tarief</label>}
                <Select
                  value={rateOptions.find(o => o.value === line.vat_rate) || null}
                  onChange={(option) => setLine(index, { vat_rate: option?.value || '21' })}
                  options={rateOptions}
                />
              </div>
              <div className="form-group">
                {index === 0 && <label>Btw</label>}
                <input
                  type="number"
                  step="0.01"
                  value={line.vat_amount}
                  aria-label="Btw-bedrag"
                  onChange={(e) => setLine(index, { vat_amount: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              {formData.lines.length > 1 && (
                <button
                  type="button"
                  className="button icon"
                  aria-label="Regel verwijderen"
                  title="Regel verwijderen"
                  onClick={() => onChange({ ...formData, lines: formData.lines.filter((_, i) => i !== index) })}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          {errors.lines && <p className="field-error">{errors.lines}</p>}
          <div className="form-row">
            <button
              type="button"
              className="button cancel"
              onClick={() => onChange({ ...formData, lines: [...formData.lines, { ...EMPTY_LINE }] })}
            >
              Tarief toevoegen
            </button>
          </div>
        </div>
      </div>

      <div className="row-section">
        <div className="information">
          <span className="title">Betaald</span>
          <span className="description">Een kassabon is meteen betaald; een inkoopfactuur vaak later.</span>
        </div>
        <div className="form-section setting-option">
          <Toggle
            label="Al betaald"
            checked={formData.status === 'paid'}
            onChange={(on) =>
              onChange({ ...formData, status: on ? 'paid' : 'open', paid_at: on ? formData.paid_at || formData.expense_date : '' })
            }
          />
          {formData.status === 'paid' ? (
            <div className="edit-holder form-section">
              <p className="field-note">Wanneer is hij betaald?</p>
              <DatePicker
                value={formData.paid_at}
                onChange={(paid_at) => onChange({ ...formData, paid_at })}
                placeholder="Selecteer een datum"
              />
            </div>
          ) : (
            <div className="edit-holder form-section">
              <p className="field-note">Vervaldatum, als die op de factuur staat</p>
              <DatePicker
                value={formData.due_date}
                onChange={(due_date) => onChange({ ...formData, due_date })}
                placeholder="Selecteer een datum"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Wat de AI van een bonnetje las, in het formulier; wat hij niet kon lezen blijft staan */
export function applyReading(formData: ExpenseFormData, reading: any): ExpenseFormData {
  const date = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '');
  const lines: ExpenseLineForm[] = (Array.isArray(reading?.lines) ? reading.lines : [])
    .filter((line: any) => Number(line?.amount_excl) || Number(line?.vat_amount))
    .map((line: any) => ({
      description: String(line.description || ''),
      amount_excl: (Number(line.amount_excl) || 0).toFixed(2),
      vat_rate: (VAT_RATES as readonly number[]).includes(Number(line.vat_rate)) ? String(Number(line.vat_rate)) : '21',
      vat_amount: (Number(line.vat_amount) || 0).toFixed(2),
    }));
  const expenseDate = date(reading?.date) || formData.expense_date;

  return {
    ...formData,
    supplier: reading?.supplier || formData.supplier,
    reference: reading?.reference || formData.reference,
    expense_date: expenseDate,
    due_date: date(reading?.due_date) || formData.due_date,
    description: reading?.description || formData.description,
    category: EXPENSE_CATEGORIES.some(c => c.value === reading?.category) ? reading.category : formData.category,
    status: reading?.paid ? 'paid' : formData.status,
    paid_at: reading?.paid ? expenseDate : formData.paid_at,
    lines: lines.length ? lines : formData.lines,
  };
}
