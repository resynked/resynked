
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';


const Header: React.FC = () => (
  <header className="header-holder">
    <div className="header-content">
      <Image src="/shared/logo.svg" alt="Resynked Logo" width={35} height={35} />
      <Link href="/login" className="button primary login">Login</Link>
    </div>
  </header>
);

export default Header;
