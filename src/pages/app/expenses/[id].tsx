import HelpButton from '@/components/HelpButton';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/hooks/useConfirm';
import { useAiAccount } from '@/hooks/useAiAccount';
import { SkeletonForm } from '@/components/Skeleton';
import ExpenseFields, {
  EMPTY_LINE,
  applyReading,
  linesForSave,
  readFileForUpload,
  validateExpense,
  type ExpenseFile,
  type ExpenseFormData,
} from '@/components/ExpenseFields';
import type { Expense } from '@/lib/supabase';

export default function EditExpense() {
  const toast = useToast();
  const router = useRouter();
  const { id } = router.query;
  const { confirm } = useConfirm();
  const aiAccount = useAiAccount();
  const [formData, setFormData] = useState<ExpenseFormData | null>(null);
  // Het bestaande bestand, of een nieuw gekozen; changed zegt of het meegaat bij opslaan
  const [file, setFile] = useState<ExpenseFile | null>(null);
  const [fileChanged, setFileChanged] = useState(false);
  const [hasStoredFile, setHasStoredFile] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/expenses/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const expense: Expense = await res.json();
        setFormData({
          supplier: expense.supplier,
          reference: expense.reference || '',
          expense_date: expense.expense_date,
          due_date: expense.due_date || '',
          description: expense.description || '',
          category: expense.category,
          status: expense.status,
          paid_at: expense.paid_at || '',
          lines: (expense.lines || []).length
            ? expense.lines!.map(line => ({
                description: line.description,
                amount_excl: Number(line.amount_excl).toFixed(2),
                vat_rate: String(Number(line.vat_rate)),
                vat_amount: Number(line.vat_amount).toFixed(2),
              }))
            : [{ ...EMPTY_LINE }],
        });
        if (expense.file_path) {
          setFile({ data: `/api/expenses/${id}/file`, name: expense.file_name || 'Bestand' });
          setHasStoredFile(true);
        }
      })
      .catch(() => toast.error('Fout', 'Kostenpost niet gevonden'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleFileSelect = async (selected: File) => {
    try {
      const prepared = await readFileForUpload(selected);
      setFile(prepared);
      setFileChanged(true);
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
      setFormData((current) => (current ? applyReading(current, reading) : current));
      toast.success('Ingevuld', 'Controleer de gegevens en sla op');
    } catch (error: any) {
      toast.error('Fout', error.message || 'Het bestand kon niet gelezen worden');
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    setShowErrors(true);
    if (Object.keys(validateExpense(formData)).length > 0) {
      toast.error('Nog niet compleet', 'Vul de gemarkeerde velden in');
      return;
    }
    setIsLoading(true);

    try {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          lines: linesForSave(formData.lines),
          // Alleen als het bestand veranderd is: nieuw, of weggehaald (null)
          ...(fileChanged ? { file: file ? { data: file.data, name: file.name } : null } : {}),
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

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Kostenpost verwijderen',
      message:
        'Weet je zeker dat je deze kostenpost en het bestand erbij wilt verwijderen? Bonnetjes en inkoopfacturen moet je zeven jaar bewaren; verwijder alleen wat er per ongeluk in staat.',
      confirmText: 'Verwijderen',
      negative: true,
      cancelText: 'Annuleren',
    });
    if (!confirmed) return;

    const response = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (response.ok) router.push('/app/expenses');
    else toast.error('Fout', 'Verwijderen mislukt');
  };

  if (!formData) {
    return (
      <Layout title="Kosten bewerken">
        <div className="header">
          <h1>Kosten bewerken <HelpButton topic="expenses" /></h1>
        </div>
        <SkeletonForm />
      </Layout>
    );
  }

  return (
    <Layout title="Kosten bewerken">
      <div className="header">
        <h1>Kosten bewerken <HelpButton topic="expenses" /></h1>
        <div className="actions">
          <button type="button" className="button negative" onClick={handleDelete}>
            Verwijderen
          </button>
          <button type="button" className="button cancel" onClick={() => router.push('/app/expenses')}>
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
            fileUrl={hasStoredFile && !fileChanged ? `/api/expenses/${id}/file` : null}
            onFileSelect={handleFileSelect}
            onFileRemove={() => {
              setFile(null);
              setFileChanged(true);
            }}
            scanning={scanning}
            hasAi={!!aiAccount}
            errors={showErrors ? validateExpense(formData) : {}}
          />
        </form>
      </div>
    </Layout>
  );
}
