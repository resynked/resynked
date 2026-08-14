import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { CircleUserRound, Languages, Bell, UserRoundPlus, Mail, LayoutTemplate } from 'lucide-react';
import { useToast } from '@/components/Toast';
import type { Tenant } from '@/lib/supabase';

export default function Settings() {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('account');
    const [isSaving, setIsSaving] = useState(false);
    const [templates, setTemplates] = useState({
        quote_template_html: '',
        invoice_template_html: '',
    });

    useEffect(() => {
        fetch('/api/tenant')
            .then(res => (res.ok ? res.json() : null))
            .then((tenant: Tenant | null) => {
                if (!tenant) return;
                setTemplates({
                    quote_template_html: tenant.quote_template_html || '',
                    invoice_template_html: tenant.invoice_template_html || '',
                });
            })
            .catch(() => toast.error('Fout', 'Instellingen konden niet geladen worden'));
    }, []);

    const handleSaveTemplates = async () => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/tenant', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templates),
            });

            if (!response.ok) {
                const data = await response.json();
                toast.error('Fout', data.error || 'Opslaan mislukt');
                return;
            }

            toast.success('Gelukt', 'Sjabloon opgeslagen');
        } catch (err) {
            toast.error('Fout', 'Opslaan mislukt');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Layout>
            <div className="header">
                <h1>Instellingen</h1>
                {activeTab === 'sjabloon' && (
                    <div className="actions">
                        <button className="button" onClick={handleSaveTemplates} disabled={isSaving}>
                            {isSaving ? 'Opslaan...' : 'Opslaan'}
                        </button>
                    </div>
                )}
            </div>
            <div className="grid">
                <div className="block page-navigation">
                    <nav>
                        <span className="titel">Algemeen</span>
                        <Link
                            href="#account"
                            className={`${activeTab === 'account' ? 'active' : ''}`}
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveTab('account');
                            }}
                        >
                            <CircleUserRound size={18} />
                            <span>Account</span>
                        </Link>
                        <Link
                            href="#sjabloon"
                            className={`${activeTab === 'sjabloon' ? 'active' : ''}`}
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveTab('sjabloon');
                            }}
                        >
                            <LayoutTemplate size={18} />
                            <span>Sjabloon</span>
                        </Link>
                        <Link
                            href="#taalinstellingen"
                            className={`${activeTab === 'taalinstellingen' ? 'active' : ''}`}
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveTab('taalinstellingen');
                            }}
                        >
                            <Languages size={18} />
                            <span>Taalinstellingen</span>
                        </Link>
                        <Link
                            href="#meldingen"
                            className={`${activeTab === 'meldingen' ? 'active' : ''}`}
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveTab('meldingen');
                            }}
                        >
                            <Bell size={18} />
                            <span>Meldingen</span>
                        </Link>
                        <Link
                            href="#gebruikers"
                            className={`${activeTab === 'gebruikers' ? 'active' : ''}`}
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveTab('gebruikers');
                            }}
                        >
                            <UserRoundPlus size={18} />
                            <span>Gebruikers</span>
                        </Link>
                    </nav>
                    <nav>
                        <span className="titel">API instellingen</span>
                        <Link
                            href="#email"
                            className={`${activeTab === 'email' ? 'active' : ''}`}
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveTab('email');
                            }}
                        >
                            <Mail size={18} />
                            <span>E-mail</span>
                        </Link>
                    </nav>
                </div>
                <div className="block">
                    {activeTab === 'account' && (
                        <h2>Account</h2>

                    )}

                    {activeTab === 'sjabloon' && (
                        <>
                            <div className="form-section">
                                <h2>Sjabloon</h2>
                                <p>
                                    Plak hier de HTML van je eigen offerte- en factuurontwerp. Alles wat vast is —
                                    de zijbalk, kleuren, logo, paginanummers — schrijf je zelf. De plekken die met
                                    de offerte meegroeien laat je leeg met een data-slot; die vult het systeem.
                                </p>
                            </div>

                            <div className="form-section edit-holder">
                                <h3>Plekken die het systeem vult</h3>
                                <p>
                                    Zet een leeg element neer met het juiste data-slot, bijvoorbeeld{' '}
                                    <code>&lt;div data-slot=&quot;blokken&quot;&gt;&lt;/div&gt;</code>
                                </p>
                                <ul>
                                    <li><strong>klantgegevens</strong> — naam en adres van de klant</li>
                                    <li><strong>kenmerken</strong> — nummer, datum en geldigheidsdatum</li>
                                    <li><strong>brief</strong> — de begeleidende tekst van de offerte</li>
                                    <li><strong>blokken</strong> — alle blokken met regels en subtotalen per BTW-tarief</li>
                                    <li><strong>totaal</strong> — het eindbedrag</li>
                                    <li><strong>opmerkingen</strong> — de opmerkingen bij de offerte</li>
                                    <li><strong>voorwaarden</strong> — je vaste garantie- en betalingsvoorwaarden</li>
                                    <li><strong>algemene_voorwaarden</strong> — je algemene voorwaarden</li>
                                </ul>

                                <h3>Losse waarden</h3>
                                <p>
                                    Deze kun je midden in je tekst zetten, bijvoorbeeld{' '}
                                    <code>&#123;&#123;bedrijf_naam&#125;&#125;</code>
                                </p>
                                <ul>
                                    <li><code>&#123;&#123;documenttitel&#125;&#125;</code>, <code>&#123;&#123;totaal&#125;&#125;</code></li>
                                    <li><code>&#123;&#123;klant_naam&#125;&#125;</code>, <code>&#123;&#123;klant_adres&#125;&#125;</code>, <code>&#123;&#123;klant_postcode_plaats&#125;&#125;</code></li>
                                    <li><code>&#123;&#123;bedrijf_naam&#125;&#125;</code>, <code>&#123;&#123;bedrijf_adres&#125;&#125;</code>, <code>&#123;&#123;bedrijf_kvk&#125;&#125;</code>, <code>&#123;&#123;bedrijf_btw&#125;&#125;</code>, <code>&#123;&#123;bedrijf_iban&#125;&#125;</code>, <code>&#123;&#123;logo&#125;&#125;</code></li>
                                </ul>
                                <p>
                                    Laat je een veld leeg, dan valt de offerte terug op de standaardweergave.
                                </p>
                            </div>

                            <div className="form-section">
                                <div className="form-group">
                                    <label htmlFor="quote_template_html">Offertesjabloon</label>
                                    <textarea
                                        id="quote_template_html"
                                        value={templates.quote_template_html}
                                        onChange={(e) =>
                                            setTemplates({ ...templates, quote_template_html: e.target.value })
                                        }
                                        placeholder={'<style>\n  .zijbalk { background: #efe8da; }\n</style>\n\n<section class="pagina">\n  <aside class="zijbalk">\n    <img src="{{logo}}" alt="">\n    <h1>Offerte</h1>\n  </aside>\n  <main>\n    <div data-slot="klantgegevens"></div>\n    <div data-slot="kenmerken"></div>\n    <div data-slot="brief"></div>\n    <div data-slot="blokken"></div>\n  </main>\n</section>'}
                                        rows={20}
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <div className="form-group">
                                    <label htmlFor="invoice_template_html">Factuursjabloon</label>
                                    <textarea
                                        id="invoice_template_html"
                                        value={templates.invoice_template_html}
                                        onChange={(e) =>
                                            setTemplates({ ...templates, invoice_template_html: e.target.value })
                                        }
                                        placeholder="Leeg laten om hetzelfde ontwerp als de standaardfactuur te gebruiken"
                                        rows={20}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'taalinstellingen' && (
                        <h2>Taalinstellingen</h2>

                    )}

                    {activeTab === 'meldingen' && (
                        <h2>Meldingen</h2>

                    )}

                    {activeTab === 'gebruikers' && (
                        <h2>Gebruikers</h2>

                    )}

                    {activeTab === 'email' && (
                        <h2>E-mail</h2>

                    )}
                </div>
            </div>
        </Layout>
    )
}
