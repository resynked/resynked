import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { CircleUserRound, Languages, Bell, UserRoundPlus, Mail, LayoutTemplate } from 'lucide-react';
import { useToast } from '@/components/Toast';
import FileUpload from '@/components/FileUpload';
import RichTextEditor from '@/components/RichTextEditor';
import type { Tenant } from '@/lib/supabase';

/** Boven deze grootte wordt het logo te zwaar om in de offerte mee te sturen */
const MAX_LOGO_BYTES = 300 * 1024;

const LOGO_ACCEPT = 'image/svg+xml,image/png,image/jpeg';

export default function Settings() {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('account');
    const [isSaving, setIsSaving] = useState(false);
    const [logo, setLogo] = useState('');
    // Naam en grootte kennen we alleen van een logo dat net gekozen is; van
    // een opgeslagen logo is enkel de data-URL bewaard
    const [logoFile, setLogoFile] = useState<{ name: string; size: number } | null>(null);
    const [templates, setTemplates] = useState({
        quote_template_html: '',
        invoice_template_html: '',
    });
    const [emailSettings, setEmailSettings] = useState({
        email_from: '',
        email_subject: '',
        email_intro_text: '',
    });

    useEffect(() => {
        fetch('/api/tenant')
            .then(res => (res.ok ? res.json() : null))
            .then((tenant: Tenant | null) => {
                if (!tenant) return;
                setLogo(tenant.logo_url || '');
                setTemplates({
                    quote_template_html: tenant.quote_template_html || '',
                    invoice_template_html: tenant.invoice_template_html || '',
                });
                setEmailSettings({
                    email_from: tenant.email_from || '',
                    email_subject: tenant.email_subject || '',
                    email_intro_text: tenant.email_intro_text || '',
                });
            })
            .catch(() => toast.error('Fout', 'Instellingen konden niet geladen worden'));
    }, []);

    const save = async (updates: Record<string, string | null>, melding: string) => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/tenant', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                const data = await response.json();
                toast.error('Fout', data.error || 'Opslaan mislukt');
                return;
            }

            toast.success('Gelukt', melding);
        } catch (err) {
            toast.error('Fout', 'Opslaan mislukt');
        } finally {
            setIsSaving(false);
        }
    };

    // Het logo wordt als afbeelding in de offerte meegestuurd, dus het gaat
    // als data-URL de database in. Zo hoeft de PDF straks niets op te halen.
    // De grens op de grootte controleert FileUpload al.
    const handleLogoSelect = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result);
            setLogo(dataUrl);
            setLogoFile({ name: file.name, size: file.size });
            save({ logo_url: dataUrl }, 'Logo opgeslagen');
        };
        reader.onerror = () => toast.error('Fout', 'Het bestand kon niet gelezen worden');
        reader.readAsDataURL(file);
    };

    const handleLogoRemove = () => {
        setLogo('');
        setLogoFile(null);
        save({ logo_url: null }, 'Logo verwijderd');
    };

    const handleSaveTemplates = () => save(templates, 'Sjabloon opgeslagen');

    const handleSaveEmail = () => save(emailSettings, 'E-mailinstellingen opgeslagen');

    return (
        <Layout title="Instellingen">
            <div className="header">
                <h1>Instellingen</h1>
                {activeTab === 'sjabloon' && (
                    <div className="actions">
                        <button className="button" onClick={handleSaveTemplates} disabled={isSaving}>
                            {isSaving ? 'Opslaan...' : 'Opslaan'}
                        </button>
                    </div>
                )}
                {activeTab === 'email' && (
                    <div className="actions">
                        <button className="button" onClick={handleSaveEmail} disabled={isSaving}>
                            {isSaving ? 'Opslaan...' : 'Opslaan'}
                        </button>
                    </div>
                )}
            </div>
            <div className="grid">
                <div className="block page-navigation">
                    <nav>
                        <span className="section-title">Algemeen</span>
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
                        <span className="section-title">API instellingen</span>
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
                        <>
                            <h2>Account</h2>

                            <div className="row-section">
                                <div className="information">
                                    <span className="title">Logo</span>
                                    <span className="description">Dit logo verschijnt op je offertes, facturen en e-mail.</span>
                                </div>
                                <div>
                                    <FileUpload
                                        value={logo}
                                        fileName={logoFile?.name || (logo ? 'Huidig logo' : null)}
                                        fileSize={logoFile?.size ?? null}
                                        accept={LOGO_ACCEPT}
                                        maxBytes={MAX_LOGO_BYTES}
                                        hint="SVG, PNG of JPG, maximaal 300 kB"
                                        disabled={isSaving}
                                        onSelect={handleLogoSelect}
                                        onRemove={handleLogoRemove}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'sjabloon' && (
                        <>
                            <h2>Sjabloon</h2>

                            <div className="row-section">
                                <div className="information">
                                    <span className="title">Plekken die het systeem vult</span>
                                    <span className="description">
                                        Alles wat vast is — de zijbalk, kleuren, logo, paginanummers —
                                        schrijf je zelf. De plekken die met de offerte meegroeien laat je
                                        leeg met een data-slot, bijvoorbeeld{' '}
                                        <code>&lt;div data-slot=&quot;blokken&quot;&gt;&lt;/div&gt;</code>
                                    </span>
                                </div>
                                <div>
                                    <ul>
                                        <li><strong>klantgegevens</strong> — naam en adres van de klant</li>
                                        <li><strong>kenmerken</strong> — nummer, datum en geldigheidsdatum</li>
                                        <li><strong>brief</strong> — de begeleidende tekst van de offerte</li>
                                        <li><strong>blokken</strong> — alle blokken achter elkaar</li>
                                        <li><strong>tekstblokken</strong> — alleen de tekstblokken, zoals de omschrijving van de werkzaamheden</li>
                                        <li><strong>prijsblokken</strong> — alleen de blokken met bedragen en subtotalen per BTW-tarief</li>
                                        <li><strong>totaal</strong> — het eindbedrag</li>
                                        <li><strong>opmerkingen</strong> — de opmerkingen bij de offerte</li>
                                        <li><strong>voorwaarden</strong> — je vaste garantie- en betalingsvoorwaarden</li>
                                        <li><strong>algemene_voorwaarden</strong> — je algemene voorwaarden</li>
                                    </ul>
                                </div>
                            </div>

                            <div className="row-section">
                                <div className="information">
                                    <span className="title">Losse waarden</span>
                                    <span className="description">
                                        Deze kun je midden in je tekst zetten, bijvoorbeeld{' '}
                                        <code>&#123;&#123;bedrijf_naam&#125;&#125;</code>
                                    </span>
                                </div>
                                <div>
                                    <ul>
                                        <li><code>&#123;&#123;documenttitel&#125;&#125;</code>, <code>&#123;&#123;totaal&#125;&#125;</code></li>
                                        <li><code>&#123;&#123;klant_naam&#125;&#125;</code>, <code>&#123;&#123;klant_adres&#125;&#125;</code>, <code>&#123;&#123;klant_postcode_plaats&#125;&#125;</code></li>
                                        <li><code>&#123;&#123;bedrijf_naam&#125;&#125;</code>, <code>&#123;&#123;bedrijf_adres&#125;&#125;</code>, <code>&#123;&#123;bedrijf_kvk&#125;&#125;</code>, <code>&#123;&#123;bedrijf_btw&#125;&#125;</code>, <code>&#123;&#123;bedrijf_iban&#125;&#125;</code>, <code>&#123;&#123;logo&#125;&#125;</code></li>
                                    </ul>
                                </div>
                            </div>

                            <div className="row-section">
                                <div className="information">
                                    <label className="title" htmlFor="quote_template_html">Offertesjabloon</label>
                                    <span className="description">
                                        De HTML van je eigen offerteontwerp. Laat je dit leeg, dan valt de
                                        offerte terug op de standaardweergave.
                                    </span>
                                </div>
                                <div>
                                    <textarea
                                        id="quote_template_html"
                                        value={templates.quote_template_html}
                                        onChange={(e) =>
                                            setTemplates({ ...templates, quote_template_html: e.target.value })
                                        }
                                        placeholder="Plak hier uw offertesjabloon"
                                        rows={20}
                                    />
                                </div>
                            </div>

                            <div className="row-section">
                                <div className="information">
                                    <label className="title" htmlFor="invoice_template_html">Factuursjabloon</label>
                                    <span className="description">
                                        De HTML van je eigen factuurontwerp. Laat je dit leeg, dan valt de
                                        factuur terug op de standaardweergave.
                                    </span>
                                </div>
                                <div>
                                    <textarea
                                        id="invoice_template_html"
                                        value={templates.invoice_template_html}
                                        onChange={(e) =>
                                            setTemplates({ ...templates, invoice_template_html: e.target.value })
                                        }
                                        placeholder="Plak hier uw factuursjabloon"
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
                        <>
                            <h2>E-mail</h2>

                            <div className="row-section">
                                <div className="information">
                                    <label className="title" htmlFor="email_from">Afzendadres</label>
                                    <span className="description">
                                        Hiervandaan gaan je offertes de deur uit. Het domein van dit adres
                                        moet geverifieerd zijn bij de mailverzender; is dat niet zo, dan
                                        wordt de mail geweigerd. Laat je dit leeg, dan gaat de offerte uit
                                        vanaf het algemene adres van het systeem en komt een antwoord van
                                        de klant alsnog bij jou terecht.
                                    </span>
                                </div>
                                <div>
                                    <input
                                        id="email_from"
                                        type="email"
                                        value={emailSettings.email_from}
                                        onChange={(e) =>
                                            setEmailSettings({ ...emailSettings, email_from: e.target.value })
                                        }
                                        placeholder="offertes@jouwdomein.nl"
                                    />
                                </div>
                            </div>

                            <div className="row-section">
                                <div className="information">
                                    <label className="title" htmlFor="email_subject">Onderwerp</label>
                                    <span className="description">
                                        Het onderwerp van de mail. Laat je dit leeg, dan wordt het
                                        &quot;Offerte&quot; met het offertenummer erachter.
                                    </span>
                                </div>
                                <div>
                                    <input
                                        id="email_subject"
                                        type="text"
                                        value={emailSettings.email_subject}
                                        onChange={(e) =>
                                            setEmailSettings({ ...emailSettings, email_subject: e.target.value })
                                        }
                                        placeholder="Uw offerte van Hendrikse Onderhoud"
                                    />
                                </div>
                            </div>

                            <div className="row-section">
                                <div className="information">
                                    <span className="title">Tekst in de mail</span>
                                    <span className="description">
                                        Bovenin de mail komt je logo uit het tabblad Account, daaronder deze
                                        tekst, en daaronder een knop naar de offerte waar de klant hem kan
                                        bekijken en ondertekenen.
                                    </span>
                                </div>
                                <div>
                                    <RichTextEditor
                                        value={emailSettings.email_intro_text}
                                        onChange={(email_intro_text) =>
                                            setEmailSettings({ ...emailSettings, email_intro_text })
                                        }
                                        placeholder="Beste klant, hierbij ontvangt u onze offerte."
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Layout>
    )
}
