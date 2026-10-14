import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { useMailAccount } from '@/hooks/useMailAccount';
import { useMailUnread } from '@/hooks/useMailUnread';
import { LayoutDashboard, Inbox, CalendarDays, Users, FileText, ReceiptEuro, FilePen, PanelLeft } from 'lucide-react';

// Of de zijbalk ingeklapt staat, onthouden voor de volgende keer
const COLLAPSED_KEY = 'resynked:sidebar-collapsed';

// Elke pagina bouwt de zijbalk opnieuw op. Zonder dit geheugen zou hij bij
// elke klik eerst even uitgeklapt staan voordat de opgeslagen stand er is
let rememberedCollapsed: boolean | null = null;

export default function Sidebar() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  // De Inbox staat er alleen als de module aan staat: als er een mailbox gekoppeld is
  const mailAccount = useMailAccount();
  const unreadMail = useMailUnread(!!mailAccount);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Ingeklapt blijven alleen de iconen over; een klik op het logo klapt hem weer uit
  const [collapsed, setCollapsed] = useState(rememberedCollapsed ?? false);
  // Alleen schuiven als iemand zelf klikt; bij het laden staat hij meteen goed
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (rememberedCollapsed !== null) return;
    try {
      rememberedCollapsed = localStorage.getItem(COLLAPSED_KEY) === '1';
      setCollapsed(rememberedCollapsed);
    } catch {
      // Zonder opslag begint de zijbalk gewoon uitgeklapt
    }
  }, []);

  const toggleCollapsed = (next: boolean) => {
    rememberedCollapsed = next;
    setAnimated(true);
    setCollapsed(next);
    setIsDropdownOpen(false);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // Dan geldt het alleen voor nu
    }
  };

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
    <div className={`sidebar${collapsed ? ' collapsed' : ''}${animated ? ' animated' : ''}`}>
      {/* In beide standen dezelfde elementen op dezelfde plek, zodat er bij het
          in- en uitklappen niets verspringt; alleen de breedte schuift */}
      <div className="logo">
        <button
          type="button"
          className="expand"
          aria-label="Zijbalk uitklappen"
          tabIndex={collapsed ? 0 : -1}
          onClick={() => collapsed && toggleCollapsed(false)}
        >
          <Image src="/logo.svg" alt="Resynked Logo" width={30} height={30} className="sidebar-logo" />
          <PanelLeft size={18} className="expand-icon" />
        </button>
        <button
          type="button"
          className="collapse"
          aria-label="Zijbalk inklappen"
          tabIndex={collapsed ? -1 : 0}
          onClick={() => toggleCollapsed(true)}
        >
          <PanelLeft size={18} />
        </button>
      </div>
      <nav className="navigation">
        <Link href="/" className={isActive('/') ? 'active' : ''} data-label="Dashboard">
          <LayoutDashboard size={16} />
          <span className="label">Dashboard</span>
        </Link>
        {mailAccount && (
          <Link href="/inbox" className={isActive('/inbox') ? 'active' : ''} data-label="Inbox">
            <Inbox size={16} />
            <span className="label">Inbox</span>
            {!!unreadMail && <span className="count">{unreadMail > 999 ? '999+' : unreadMail}</span>}
          </Link>
        )}
        {mailAccount && (
          <Link href="/calendar" className={isActive('/calendar') ? 'active' : ''} data-label="Agenda">
            <CalendarDays size={16} />
            <span className="label">Agenda</span>
          </Link>
        )}
        <Link href="/customers" className={isActive('/customers') || router.pathname.startsWith('/customers') ? 'active' : ''} data-label="Klanten">
          <Users size={16} />
          <span className="label">Klanten</span>
        </Link>
        <Link href="/quotes" className={isActive('/quotes') || router.pathname.startsWith('/quotes') ? 'active' : ''} data-label="Offertes">
          <FileText size={16} />
          <span className="label">Offertes</span>
        </Link>
        <Link href="/invoices" className={isActive('/invoices') || router.pathname.startsWith('/invoices') ? 'active' : ''} data-label="Facturen">
          <ReceiptEuro size={16} />
          <span className="label">Facturen</span>
        </Link>
        <Link href="/notes" className={isActive('/notes') || router.pathname.startsWith('/notes') ? 'active' : ''} data-label="Notities">
          <FilePen size={16} />
          <span className="label">Notities</span>
        </Link>
      </nav>

      <div className="profile" ref={dropdownRef} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
        <div className="avatar">
          {getInitials(userName)}
        </div>
        <div className="info">
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
