import Link from 'next/link';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { LayoutDashboard, Users, Package, FileText } from 'lucide-react';

export default function Sidebar() {
  const router = useRouter();

  const isActive = (path: string) => {
    return router.pathname === path;
  };

  return (
    <div className="dashboard-sidebar">
      <div className="sidebar-header">
        <Image
          src="/admin/logo.svg"
          alt="Resynked Logo"
          width={45}
          height={45}
          className="sidebar-logo"
        />
      </div>
      <nav className="sidebar-nav">
        <Link href="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </Link>
        <Link href="/dashboard/customers" className={isActive('/dashboard/customers') ? 'active' : ''}>
          <Users size={20} />
          <span>Klanten</span>
        </Link>
        <Link href="/dashboard/products" className={isActive('/dashboard/products') ? 'active' : ''}>
          <Package size={20} />
          <span>Producten</span>
        </Link>
        <Link href="/dashboard/invoices" className={isActive('/dashboard/invoices') ? 'active' : ''}>
          <FileText size={20} />
          <span>Facturen</span>
        </Link>
      </nav>
    </div>
  );
}
