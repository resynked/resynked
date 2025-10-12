import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export default function Header() {
  const { data: session } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <header className="header">
      <div className="header-content">
        <div className="breadcrumbs">
          {/* You can add breadcrumbs or page title here if needed */}
        </div>

        <div className="profile" ref={dropdownRef} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
          <div className="profile-avatar">
            {getInitials(userName)}
          </div>


          {isDropdownOpen && (
            <div className="profile-dropdown">

              <div className="profile-dropdown-info">
                <div className="name">{userName}</div>
                <div className="email">{userEmail}</div>
              </div>

              <div className="menu">
                <Link href="/account" className="item">
                  Account instellingen
                </Link>

                <Link href="/" className="item">
                  Terug naar website
                </Link>
              </div>

              <div className="logout">
                <button className="secondary"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  Uitloggen
                </button>

              </div>


            </div>
          )}
        </div>
      </div>
    </header>
  );
}
