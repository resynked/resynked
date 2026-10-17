import React, { useState } from 'react';
import Link from 'next/link';
import { CircleCheck } from 'lucide-react';
import SiteLayout from '@/components/site/SiteLayout';
import { useToast } from '@/components/Toast';

const EMPTY = { name: '', company: '', email: '', phone: '', message: '' };

/**
 * Demo aanvragen: een kort formulier dat als mail bij Synbased binnenkomt.
 * Daarna bellen of mailen we om een moment af te spreken.
 */
export default function Demo() {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(current => ({ ...current, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Fout', 'Vul je naam en e-mailadres in.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error('Fout', data.error || 'Er is iets misgegaan. Probeer het opnieuw.');
        return;
      }
      setSent(true);
    } catch {
      toast.error('Fout', 'Er is iets misgegaan. Probeer het opnieuw.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SiteLayout
      title="Demo aanvragen"
      description="Vraag een demo van Synbased aan. We laten je in een halfuur zien hoe je offertes en facturen maakt, laat tekenen en sneller betaald krijgt."
    >
      <section className="site-section">
        <div className="site-container site-split">
          <div>
            <span className="site-eyebrow">Demo aanvragen</span>
            <h1>Zie Synbased werken, met jouw manier van werken.</h1>
            <p className="site-lead">
              In een halfuur laten we zien hoe je een offerte maakt, laat tekenen en omzet naar een factuur. Daarna
              zetten we je account klaar, met je eigen logo en gegevens.
            </p>
            <ul className="site-checklist">
              <li>
                <CircleCheck size={16} /> Vrijblijvend en zonder verplichtingen
              </li>
              <li>
                <CircleCheck size={16} /> € 35 per maand, excl. btw
              </li>
              <li>
                <CircleCheck size={16} /> We nemen snel contact met je op
              </li>
            </ul>
          </div>

          <div className="site-card">
            {sent ? (
              <div className="site-sent">
                <CircleCheck size={28} />
                <h2>Bedankt, {form.name.split(' ')[0]}!</h2>
                <p className="placeholder">
                  We hebben je aanvraag ontvangen en nemen snel contact met je op via {form.email}
                  {form.phone ? ` of ${form.phone}` : ''}.
                </p>
                <Link href="/" className="button tertiary">
                  Terug naar de homepage
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="form-section">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name">Naam</label>
                    <input id="name" type="text" autoComplete="name" value={form.name} onChange={set('name')} placeholder="Vul je naam in" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="company">Bedrijf</label>
                    <input id="company" type="text" autoComplete="organization" value={form.company} onChange={set('company')} placeholder="Vul je bedrijfsnaam in" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="email">E-mail</label>
                    <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="Vul je e-mailadres in" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="phone">Telefoon</label>
                    <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="Vul je telefoonnummer in" />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="message">Bericht</label>
                  <textarea id="message" value={form.message} onChange={set('message')} placeholder="Vul in wat je wilt weten of hoe je nu werkt" />
                </div>
                <button className="button" type="submit" disabled={isLoading}>
                  {isLoading ? 'Bezig met versturen...' : 'Demo aanvragen'}
                </button>
                <p className="field-note">
                  We gebruiken je gegevens alleen om contact met je op te nemen. Lees de{' '}
                  <Link href="/privacy">privacyverklaring</Link>.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
