import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { LayoutDashboard, Users, Package, FileText, FileCheck, ReceiptEuro, FilePen, Euro, Calculator } from 'lucide-react';

export default function Sidebar() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => {
    return router.pathname === path;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const userName = (session?.user as any)?.name || 'User';
  const userEmail = (session?.user as any)?.email || '';

  return (
    <div className="dashboard-sidebar">
      <div className="sidebar-header">
        <Image
          src="/logo.svg"
          alt="Resynked Logo"
          width={45}
          height={45}
          className="sidebar-logo"
        />
      </div>
      <nav className="sidebar-nav">
        <Link href="/" className={isActive('/') ? 'active' : ''}>
          <LayoutDashboard size={16} />
          <span>Dashboard</span>
        </Link>
        <Link href="/customers" className={isActive('/customers') || router.pathname.startsWith('/customers') ? 'active' : ''}>
          <Users size={16} />
          <span>Klanten</span>
        </Link>
        <Link href="/products" className={isActive('/products') || router.pathname.startsWith('/products') ? 'active' : ''}>
          <Package size={16} />
          <span>Producten</span>
        </Link>
        <Link href="/quotes" className={isActive('/quotes') || router.pathname.startsWith('/quotes') ? 'active' : ''}>
          <FileText size={16} />
          <span>Offertes</span>
        </Link>
        <Link href="/orders" className={isActive('/orders') || router.pathname.startsWith('/orders') ? 'active' : ''}>
          <FileCheck size={16} />
          <span>Orderbevestigingen</span>
        </Link>
        <Link href="/invoices" className={isActive('/invoices') || router.pathname.startsWith('/invoices') ? 'active' : ''}>
          <ReceiptEuro size={16} />
          <span>Facturen</span>
        </Link>
        <Link href="#">
          <FilePen size={16} />
          <span>Notities</span>
        </Link>
        <Link href="#">
          <Euro size={16} />
          <span>Uitgaven</span>
        </Link>
        <Link href="#">
          <Calculator size={16} />
          <span>BTW-overzicht</span>
        </Link>
      </nav>

      <div className="sidebar-profile" ref={dropdownRef} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
        <div className="profile-avatar">
          {getInitials(userName)}
        </div>
        <div className="profile-dropdown-info">
          <div className="name">{userName}</div>
          <div className="email">{userEmail}</div>
        </div>


        {isDropdownOpen && (
          <div className="profile-dropdown">


            <div className="menu">
              <Link href="/settings" className="item">
                Account instellingen
              </Link>

              <Link href="/" className="item">
                Terug naar website
              </Link>
            </div>

            <div className="logout">
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  Uitloggen
                </button>

            </div>


          </div>
        )}
      </div>
    </div>
  );
}
