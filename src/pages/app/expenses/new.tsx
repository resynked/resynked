import HelpButton from '@/components/HelpButton';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import { useAiAccount } from '@/hooks/useAiAccount';
import ExpenseFields, {
  EMPTY_LINE,
  applyReading,
  linesForSave,
  readFileForUpload,
  validateExpense,
  type ExpenseFile,
  type ExpenseFormData,
} from '@/components/ExpenseFields';
import { vandaag } from '@/lib/utils';

export default function NewExpense() {
  const toast = useToast();
  const router = useRouter();
  const aiAccount = useAiAccount();
  const [formData, setFormData] = useState<ExpenseFormData>({
    supplier: '',
    reference: '',
    expense_date: vandaag(),
    due_date: '',
    description: '',
    category: 'materials',
    status: 'open',
    paid_at: '',
    lines: [{ ...EMPTY_LINE }],
  });
  const [file, setFile] = useState<ExpenseFile | null>(null);
  const [scanning, setScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Pas na de eerste keer opslaan tonen wat er ontbreekt, niet al bij het openen
  const [showErrors, setShowErrors] = useState(false);

  /** Het bestand onthouden en, met een AI-plug-in, meteen laten uitlezen */
  const handleFileSelect = async (selected: File) => {
    try {
      const prepared = await readFileForUpload(selected);
      setFile(prepared);
      if (!aiAccount) return;

      setScanning(true);
      const response = await fetch('/api/expenses/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: { data: prepared.data, name: prepared.name } }),
      });
      const reading = await response.json();
      if (!response.ok) {
        toast.error('Niet gelezen', reading.error || 'Vul de gegevens met de hand in');
        return;
      }
      setFormData((current) => applyReading(current, reading));
      toast.success('Ingevuld', 'Controleer de gegevens en sla op');
    } catch (error: any) {
      toast.error('Fout', error.message || 'Het bestand kon niet gelezen worden');
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (Object.keys(validateExpense(formData)).length > 0) {
      toast.error('Nog niet compleet', 'Vul de gemarkeerde velden in');
      return;
    }
    setIsLoading(true);

    try {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          lines: linesForSave(formData.lines),
          file: file ? { data: file.data, name: file.name } : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error('Fout', data.error || 'Er is iets misgegaan');
        setIsLoading(false);
        return;
      }

      router.push('/app/expenses');
    } catch {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
      setIsLoading(false);
    }
  };

  return (
    <Layout title="Kosten toevoegen">
      <div className="header">
        <h1>Kosten toevoegen <HelpButton topic="expenses" /></h1>
        <div className="actions">
          <button type="button" className="button cancel" onClick={() => router.back()}>
            Annuleren
          </button>
          <button type="submit" form="expense-form" className="button" disabled={isLoading || scanning}>
            {isLoading ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      <div className="block">
        <form id="expense-form" onSubmit={handleSubmit}>
          <ExpenseFields
            formData={formData}
            onChange={setFormData}
            file={file}
            onFileSelect={handleFileSelect}
            onFileRemove={() => setFile(null)}
            scanning={scanning}
            hasAi={!!aiAccount}
            errors={showErrors ? validateExpense(formData) : {}}
          />
        </form>
      </div>
    </Layout>
  );
}
