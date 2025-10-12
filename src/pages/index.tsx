// src/pages/index.tsx
import React from 'react';
import Header from '../components/website/Header';
import Content from '../components/website/Content';

export default function Home() {
  return (
    <>
      <Header />
      <Content>
        <h1>Welcome to Resynked</h1>

      </Content>
    </>
  );
}