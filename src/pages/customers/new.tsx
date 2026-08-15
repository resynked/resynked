import Layout from '@/components/Layout';
import CustomerForm from '@/components/CustomerForm';

export default function NewCustomer() {
  return (
    <Layout title="Nieuwe klant">
      <CustomerForm mode="create" />
    </Layout>
  );
}
