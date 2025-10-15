import Layout from '@/components/Layout';
import CustomerForm from '@/components/CustomerForm';

export default function NewCustomer() {
  return (
    <Layout>
      <CustomerForm mode="create" />
    </Layout>
  );
}
