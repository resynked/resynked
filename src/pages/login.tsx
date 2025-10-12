

import React, { useState } from 'react';
import Content from '../components/website/Content';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Dummy validation
    if (!email || !password) {
      setError('Vul alle velden in.');
      return;
    }
    setError('');
    // Handle login logic here
    alert('Ingelogd!');
  };

  return (
    <Content>
      <div className="login-wrapper">
        <div className="login-block">
          <h1>Log in to Resynked</h1>
          <form onSubmit={handleSubmit} className="login-form">
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="login-input"
              required
              placeholder="E-mail"
            />
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="login-input"
              required
              placeholder="Wachtwoord"
            />
            {error && <div className="login-error">{error}</div>}
            <button className="button" type="submit">Login</button>
          </form>
        </div>
      </div>
    </Content>
  );
}