import React from 'react';

interface ContentProps {
  children: React.ReactNode;
}

const Content: React.FC<ContentProps> = ({ children }) => {
  return (
    <main>
      <div className="content">
        {children}
      </div>
    </main>
  );
};

export default Content;
