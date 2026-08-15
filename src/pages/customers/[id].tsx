import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import CustomerForm from '@/components/CustomerForm';

export default function EditCustomer() {
  const router = useRouter();
  const { id } = router.query;

  if (!id || typeof id !== 'string') {
    return (
      <Layout title="Klant bewerken">
        <div className="loading">Laden...</div>
      </Layout>
    );
  }

  return (
    <Layout title="Klant bewerken">
      <CustomerForm mode="edit" customerId={id} />
    </Layout>
  );
}
