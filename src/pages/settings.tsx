import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { CircleUserRound, ShieldCheck, Mail, LayoutTemplate, CircleQuestionMark, Plug } from 'lucide-react';
import { useToast } from '@/components/Toast';
import FileUpload from '@/components/FileUpload';
import RichTextEditor from '@/components/RichTextEditor';
import SidePanel from '@/components/SidePanel';
import PluginsSettings from '@/components/PluginsSettings';
import Toggle from '@/components/Toggle';
import Select from '@/components/Select';
import PasswordInput from '@/components/PasswordInput';
import type { Tenant } from '@/lib/supabase';
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';
import { DEFAULT_INVOICE_TEMPLATE, DEFAULT_QUOTE_TEMPLATE } from '@/lib/document-templates';

const PAPER_OPTIONS = [
    { value: 'portrait', label: 'A4 staand' },
    { value: 'landscape', label: 'A4 liggend' },
];

/** Het standaardsjabloon per veld, om te tonen als er nog niets eigens is */
const DEFAULT_TEMPLATES = {
    quote_template_html: DEFAULT_QUOTE_TEMPLATE,
    invoice_template_html: DEFAULT_INVOICE_TEMPLATE,
} as const;

/** Boven deze grootte wordt het logo te zwaar om in de offerte mee te sturen */
const MAX_LOGO_BYTES = 300 * 1024;

const LOGO_ACCEPT = 'image/svg+xml,image/png,image/jpeg';

export default function Settings() {
    const toast = useToast();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('account');

    // Een tabblad kan in het adres staan, zoals ?tab=plugins na het koppelen
    // van de Inbox zonder popup
    useEffect(() => {
        if (!router.isReady) return;

        const { tab, mail_error } = router.query;
        if (typeof tab === 'string') setActiveTab(tab);
        if (typeof mail_error === 'string' && mail_error) toast.error('Koppelen mislukt', mail_error);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady]);
    const [isSaving, setIsSaving] = useState(false);
    const [logo, setLogo] = useState('');
    // Naam en grootte kennen we alleen van een logo dat net gekozen is; van
    // een opgeslagen logo is enkel de data-URL bewaard
    const [logoFile, setLogoFile] = useState<{ name: string; size: number } | null>(null);
    const [templates, setTemplates] = useState({
        quote_template_html: '',
        invoice_template_html: '',
    });
    // Staand of liggend A4 voor het standaardsjabloon
    const [paperOrientation, setPaperOrientation] = useState<'portrait' | 'landscape'>('portrait');
    const [emailSettings, setEmailSettings] = useState({
        quote_email_subject: '',
        quote_email_intro_text: '',
        invoice_email_subject: '',
        invoice_email_intro_text: '',
        quote_reminder_days: '',
    });
    // De herinnering staat aan of uit; het aantal dagen blijft bewaard als je hem even uitzet
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [numbering, setNumbering] = useState({
        quote_number_next: '',
        invoice_number_next: '',
    });
    const [showTemplateHelp, setShowTemplateHelp] = useState(false);

    // Wie er ingelogd is. De naam is aan te passen; het e-mailadres is ook de
    // inlognaam en staat er alleen ter informatie
    const { update: updateSession } = useSession();
    const [profile, setProfile] = useState({ name: '', email: '' });
    const [savedName, setSavedName] = useState('');
    // Wachtwoord wijzigen in twee stappen: eerst het huidige, dan pas de velden voor het nieuwe
    const [currentPassword, setCurrentPassword] = useState('');
    const [passwordUnlocked, setPasswordUnlocked] = useState(false);
    const [passwords, setPasswords] = useState({ next: '', repeat: '' });
    // Wat er mist pas tonen na de eerste poging, niet al bij het openen
    const [showPasswordErrors, setShowPasswordErrors] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const passwordErrors: Partial<Record<keyof typeof passwords, string>> = {};
    if (passwords.next.length < MIN_PASSWORD_LENGTH) {
        passwordErrors.next = `Minimaal ${MIN_PASSWORD_LENGTH} tekens`;
    }
    if (passwords.repeat !== passwords.next) passwordErrors.repeat = 'De wachtwoorden zijn niet hetzelfde';
    const shownPasswordErrors = showPasswordErrors ? passwordErrors : {};

    // Tweestapsverificatie. Tijdens het aanzetten staat de QR-code in beeld,
    // daarna eenmalig de back-upcodes
    const [twoFactor, setTwoFactor] = useState<{ enabledAt: string | null; backupLeft: number }>({
        enabledAt: null,
        backupLeft: 0,
    });
    const [twoFactorSetup, setTwoFactorSetup] = useState<{ qr: string; secret: string } | null>(null);
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [twoFactorPassword, setTwoFactorPassword] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
    const [isTwoFactorBusy, setIsTwoFactorBusy] = useState(false);
    // Wat er onder de schakelaar open staat: de QR-code, of het wachtwoord voor uitzetten of nieuwe codes
    const [twoFactorMode, setTwoFactorMode] = useState<'setup' | 'disable' | 'renew' | null>(null);

    const loadAccount = () =>
        fetch('/api/account')
            .then(res => (res.ok ? res.json() : null))
            .then(
                (
                    account: {
                        name: string | null;
                        email: string;
                        two_factor_enabled_at: string | null;
                        backup_codes_left: number;
                    } | null
                ) => {
                    if (!account) return;
                    setProfile({ name: account.name || '', email: account.email });
                    setSavedName(account.name || '');
                    setTwoFactor({ enabledAt: account.two_factor_enabled_at, backupLeft: account.backup_codes_left });
                }
            )
            .catch(() => {});

    useEffect(() => {
        loadAccount();
    }, []);

    /** Eén stap bij het aan- of uitzetten; geeft het antwoord terug, of null bij een fout */
    const twoFactorRequest = async (body: Record<string, string>) => {
        setIsTwoFactorBusy(true);
        try {
            const response = await fetch('/api/account/two-factor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                toast.error('Tweestapsverificatie', data.error || 'Er ging iets mis');
                return null;
            }
            return data;
        } catch {
            toast.error('Tweestapsverificatie', 'Er ging iets mis');
            return null;
        } finally {
            setIsTwoFactorBusy(false);
        }
    };

    const startTwoFactor = async () => {
        const data = await twoFactorRequest({ action: 'setup' });
        if (data) {
            setTwoFactorSetup(data);
            setTwoFactorCode('');
            setTwoFactorMode('setup');
        }
    };

    /** De schakelaar: aan begint met de QR-code, uit vraagt eerst je wachtwoord */
    const handleTwoFactorToggle = (checked: boolean) => {
        if (checked) {
            startTwoFactor();
        } else if (twoFactorMode === 'setup') {
            setTwoFactorMode(null);
        } else {
            setTwoFactorMode('disable');
        }
    };

    const confirmTwoFactor = async () => {
        if (!twoFactorCode.trim()) {
            toast.error('Nog niet compleet', 'Vul de code uit je authenticator-app in');
            return;
        }
        const data = await twoFactorRequest({ action: 'enable', code: twoFactorCode });
        if (data) {
            setTwoFactorSetup(null);
            setTwoFactorMode(null);
            setBackupCodes(data.backupCodes);
            toast.success('Gelukt', 'Tweestapsverificatie staat aan');
            loadAccount();
        }
    };

    const disableTwoFactor = async () => {
        if (!twoFactorPassword) {
            toast.error('Nog niet compleet', 'Vul je wachtwoord in');
            return;
        }
        const data = await twoFactorRequest({ action: 'disable', password: twoFactorPassword });
        if (data) {
            setTwoFactorPassword('');
            setTwoFactorMode(null);
            setBackupCodes(null);
            toast.success('Gelukt', 'Tweestapsverificatie staat uit');
            loadAccount();
        }
    };

    const renewBackupCodes = async () => {
        if (!twoFactorPassword) {
            toast.error('Nog niet compleet', 'Vul je wachtwoord in');
            return;
        }
        const data = await twoFactorRequest({ action: 'backup-codes', password: twoFactorPassword });
        if (data) {
            setTwoFactorPassword('');
            setTwoFactorMode(null);
            setBackupCodes(data.backupCodes);
            loadAccount();
        }
    };

    const copyBackupCodes = async () => {
        try {
            await navigator.clipboard.writeText((backupCodes || []).join('\n'));
            toast.success('Gekopieerd', 'Bewaar ze op een veilige plek');
        } catch {
            toast.error('Kopiëren mislukt', 'Selecteer de codes en kopieer ze zelf');
        }
    };

    useEffect(() => {
        fetch('/api/tenant')
            .then(res => (res.ok ? res.json() : null))
            .then((tenant: Tenant | null) => {
                if (!tenant) return;
                setLogo(tenant.logo_url || '');
                // Nog geen eigen sjabloon: dan staat het standaardsjabloon klaar om aan te passen
                setTemplates({
                    quote_template_html: tenant.quote_template_html || DEFAULT_QUOTE_TEMPLATE,
                    invoice_template_html: tenant.invoice_template_html || DEFAULT_INVOICE_TEMPLATE,
                });
                setPaperOrientation(tenant.paper_orientation === 'landscape' ? 'landscape' : 'portrait');
                setEmailSettings({
                    quote_email_subject: tenant.quote_email_subject || '',
                    quote_email_intro_text: tenant.quote_email_intro_text || '',
                    invoice_email_subject: tenant.invoice_email_subject || '',
                    invoice_email_intro_text: tenant.invoice_email_intro_text || '',
                    quote_reminder_days: tenant.quote_reminder_days ? String(tenant.quote_reminder_days) : '',
                });
                setReminderEnabled(!!tenant.quote_reminder_days);
                setNumbering({
                    quote_number_next: tenant.quote_number_next || '',
                    invoice_number_next: tenant.invoice_number_next || '',
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

    // Ongewijzigd het standaardsjabloon? Dan bewaren we niets, zodat verbeteringen
    // aan het standaardsjabloon later vanzelf meekomen
    const handleSaveTemplates = () =>
        save(
            {
                quote_template_html:
                    templates.quote_template_html === DEFAULT_QUOTE_TEMPLATE ? '' : templates.quote_template_html,
                invoice_template_html:
                    templates.invoice_template_html === DEFAULT_INVOICE_TEMPLATE ? '' : templates.invoice_template_html,
                paper_orientation: paperOrientation,
            },
            'Sjabloon opgeslagen'
        );

    const handleSaveEmail = () =>
        save(
            { ...emailSettings, quote_reminder_days: reminderEnabled ? emailSettings.quote_reminder_days : '' },
            'E-mailinstellingen opgeslagen'
        );

    /** De knop Opslaan bij Account: je naam, als die veranderd is, en de nummering */
    const handleSaveAccount = async () => {
        const name = profile.name.trim();
        if (!name) {
            toast.error('Nog niet compleet', 'Vul je naam in');
            return;
        }

        if (name !== savedName) {
            const response = await fetch('/api/account', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                toast.error('Fout', data.error || 'Je naam kon niet worden opgeslagen');
                return;
            }
            setSavedName(name);
            // De zijbalk leest de naam uit de sessie; die halen we opnieuw op
            await updateSession();
        }

        await save(numbering, 'Account opgeslagen');
    };

    /** Eén verzoek aan de wachtwoord-API; geeft true als het gelukt is */
    const passwordRequest = async (body: Record<string, unknown>) => {
        setIsChangingPassword(true);
        try {
            const response = await fetch('/api/account/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                toast.error('Wachtwoord', data.error || 'Probeer het opnieuw');
                return false;
            }
            return true;
        } catch {
            toast.error('Wachtwoord', 'Probeer het opnieuw');
            return false;
        } finally {
            setIsChangingPassword(false);
        }
    };

    const resetPasswordChange = () => {
        setCurrentPassword('');
        setPasswordUnlocked(false);
        setPasswords({ next: '', repeat: '' });
        setShowPasswordErrors(false);
    };

    /** Stap 1: klopt het huidige wachtwoord, dan verschijnen de velden voor het nieuwe */
    const verifyCurrentPassword = async () => {
        if (!currentPassword) {
            toast.error('Nog niet compleet', 'Vul je huidige wachtwoord in');
            return;
        }
        if (await passwordRequest({ current_password: currentPassword, check: true })) setPasswordUnlocked(true);
    };

    /** Stap 2: het nieuwe wachtwoord opslaan; de server controleert het huidige opnieuw */
    const handleChangePassword = async () => {
        setShowPasswordErrors(true);
        if (Object.keys(passwordErrors).length > 0) {
            toast.error('Nog niet compleet', 'Vul de gemarkeerde velden in');
            return;
        }
        if (await passwordRequest({ current_password: currentPassword, new_password: passwords.next })) {
            toast.success('Gelukt', 'Je wachtwoord is gewijzigd');
            resetPasswordChange();
        }
    };

    return (
        <Layout title="Instellingen">
            <div className="header">
                <h1>Instellingen</h1>
                {activeTab === 'account' && (
                    <div className="actions">
                        <button className="button" onClick={handleSaveAccount} disabled={isSaving}>
                            {isSaving ? 'Opslaan...' : 'Opslaan'}
                        </button>
                    </div>
                )}
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
                            href="#privacy"
                            className={`${activeTab === 'privacy' ? 'active' : ''}`}
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveTab('privacy');
                            }}
                        >
                            <ShieldCheck size={18} />
                            <span>Privacy</span>
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
                            href="#plugins"
                            className={`${activeTab === 'plugins' ? 'active' : ''}`}
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveTab('plugins');
                            }}
                        >
                            <Plug size={18} />
                            <span>Plug-ins</span>
                        </Link>
                    </nav>
                    <nav>
                        <span className="section-title">Overige instellingen</span>
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

                            <h3>Jouw gegevens</h3>
                            <div className="row-section">
                                <div className="information">
                                    <label className="title" htmlFor="account_name">Naam</label>
                                    <span className="description">Zo staat je naam in Khance, onder andere linksonder in het menu.</span>
                                </div>
                                <div>
                                    <input
                                        id="account_name"
                                        type="text"
                                        value={profile.name}
                                        autoComplete="name"
                                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                        placeholder="Vul je naam in"
                                    />
                                </div>
                            </div>

                            <div className="row-section">
                                <div className="information">
                                    <label className="title" htmlFor="account_email">E-mailadres</label>
                                    <span className="description">Hiermee log je in. Dit kan niet zelf worden gewijzigd.</span>
                                </div>
                                <div>
                                    <input id="account_email" type="email" value={profile.email} disabled />
                                </div>
                            </div>

                            <h3>Bedrijf</h3>
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

                            <div className="row-section">
                                <div className="information">
                                    <label className="title" htmlFor="quote_number_next">Volgend offertenummer</label>
                                    <span className="description">
                                        Het nummer dat de volgende offerte krijgt. De cijfers achteraan
                                        tellen daarna vanzelf op.
                                    </span>
                                </div>
                                <div>
                                    <input
                                        id="quote_number_next"
                                        type="text"
                                        value={numbering.quote_number_next}
                                        onChange={(e) =>
                                            setNumbering({ ...numbering, quote_number_next: e.target.value })
                                        }
                                        placeholder="Vul het volgende offertenummer in"
                                    />
                                </div>
                            </div>

                            <div className="row-section">
                                <div className="information">
                                    <label className="title" htmlFor="invoice_number_next">Volgend factuurnummer</label>
                                    <span className="description">
                                        Zelfde opzet als bij de offertes, met een eigen reeks.
                                    </span>
                                </div>
                                <div>
                                    <input
                                        id="invoice_number_next"
                                        type="text"
                                        value={numbering.invoice_number_next}
                                        onChange={(e) =>
                                            setNumbering({ ...numbering, invoice_number_next: e.target.value })
                                        }
                                        placeholder="Vul het volgende factuurnummer in"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'sjabloon' && (
                        <>
                            <h2>
                                Sjabloon
                                <button
                                    type="button"
                                    className="help"
                                    title="Uitleg over sjablonen"
                                    aria-label="Uitleg over sjablonen"
                                    onClick={() => setShowTemplateHelp(true)}
                                >
                                    <CircleQuestionMark size={16} />
                                </button>
                            </h2>

                            <div className="row-section">
                                <div className="information">
                                    <span className="title">Papierformaat</span>
                                    <span className="description">
                                        Voor het standaardsjabloon. Een eigen sjabloon bepaalt zelf zijn formaat.
                                    </span>
                                </div>
                                <div>
                                    <Select
                                        value={PAPER_OPTIONS.find(o => o.value === paperOrientation) || null}
                                        onChange={(option) =>
                                            setPaperOrientation(option?.value === 'landscape' ? 'landscape' : 'portrait')
                                        }
                                        options={PAPER_OPTIONS}
                                    />
                                </div>
                            </div>

                            <div className="row-section">
                                <div className="information">
                                    <label className="title" htmlFor="quote_template_html">Offertesjabloon</label>
                                    <span className="description">
                                        {templates.quote_template_html === DEFAULT_TEMPLATES.quote_template_html
                                            ? 'Het standaardsjabloon van Khance. Pas het aan naar je eigen ontwerp.'
                                            : 'De HTML van je eigen offerteontwerp.'}
                                    </span>
                                </div>
                                <div className="form-section">
                                    <textarea
                                        id="quote_template_html"
                                        value={templates.quote_template_html}
                                        onChange={(e) =>
                                            setTemplates({ ...templates, quote_template_html: e.target.value })
                                        }
                                        placeholder="Vul de HTML van je offertesjabloon in"
                                        rows={20}
                                    />
                                    {templates.quote_template_html !== DEFAULT_TEMPLATES.quote_template_html && (
                                        <div className="form-row">
                                            <button
                                                type="button"
                                                className="button cancel"
                                                onClick={() =>
                                                    setTemplates({ ...templates, quote_template_html: DEFAULT_TEMPLATES.quote_template_html })
                                                }
                                            >
                                                Standaard herstellen
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="row-section">
                                <div className="information">
                                    <label className="title" htmlFor="invoice_template_html">Factuursjabloon</label>
                                    <span className="description">
                                        {templates.invoice_template_html === DEFAULT_TEMPLATES.invoice_template_html
                                            ? 'Het standaardsjabloon van Khance. Pas het aan naar je eigen ontwerp.'
                                            : 'De HTML van je eigen factuurontwerp.'}
                                    </span>
                                </div>
                                <div className="form-section">
                                    <textarea
                                        id="invoice_template_html"
                                        value={templates.invoice_template_html}
                                        onChange={(e) =>
                                            setTemplates({ ...templates, invoice_template_html: e.target.value })
                                        }
                                        placeholder="Vul de HTML van je factuursjabloon in"
                                        rows={20}
                                    />
                                    {templates.invoice_template_html !== DEFAULT_TEMPLATES.invoice_template_html && (
                                        <div className="form-row">
                                            <button
                                                type="button"
                                                className="button cancel"
                                                onClick={() =>
                                                    setTemplates({ ...templates, invoice_template_html: DEFAULT_TEMPLATES.invoice_template_html })
                                                }
                                            >
                                                Standaard herstellen
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'privacy' && (
                        <>
                            <h2>Privacy</h2>

                            <h3>Wachtwoord</h3>
                            <div className="row-section">
                                <div className="information">
                                    <span className="title">Wachtwoord wijzigen</span>
                                    <span className="description">Eerst je huidige wachtwoord, daarna je nieuwe.</span>
                                </div>
                                <div className="form-section setting-option">
                                    {!passwordUnlocked ? (
                                        <div className="form-row">
                                            <div className="form-group">
                                                <PasswordInput
                                                    value={currentPassword}
                                                    label="Huidig wachtwoord"
                                                    onChange={setCurrentPassword}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') verifyCurrentPassword();
                                                    }}
                                                    placeholder="Vul je huidige wachtwoord in"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="button"
                                                onClick={verifyCurrentPassword}
                                                disabled={isChangingPassword}
                                            >
                                                Doorgaan
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="edit-holder form-section">
                                            <p className="field-note">Kies een nieuw wachtwoord van minimaal {MIN_PASSWORD_LENGTH} tekens.</p>
                                            <div className="form-row">
                                                <div className="form-group">
                                                    <PasswordInput
                                                        value={passwords.next}
                                                        autoComplete="new-password"
                                                        autoFocus
                                                        label="Nieuw wachtwoord"
                                                        invalid={!!shownPasswordErrors.next}
                                                        onChange={(next) => setPasswords({ ...passwords, next })}
                                                        placeholder="Vul een nieuw wachtwoord in"
                                                    />
                                                    {shownPasswordErrors.next && <p className="field-error">{shownPasswordErrors.next}</p>}
                                                </div>
                                                <div className="form-group">
                                                    <PasswordInput
                                                        value={passwords.repeat}
                                                        autoComplete="new-password"
                                                        label="Nieuw wachtwoord herhalen"
                                                        invalid={!!shownPasswordErrors.repeat}
                                                        onChange={(repeat) => setPasswords({ ...passwords, repeat })}
                                                        placeholder="Vul het wachtwoord nogmaals in"
                                                    />
                                                    {shownPasswordErrors.repeat && <p className="field-error">{shownPasswordErrors.repeat}</p>}
                                                </div>
                                            </div>
                                            <div className="form-row">
                                                <button
                                                    type="button"
                                                    className="button cancel"
                                                    onClick={resetPasswordChange}
                                                    disabled={isChangingPassword}
                                                >
                                                    Annuleren
                                                </button>
                                                <button
                                                    type="button"
                                                    className="button"
                                                    onClick={handleChangePassword}
                                                    disabled={isChangingPassword}
                                                >
                                                    {isChangingPassword ? 'Opslaan...' : 'Opslaan'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h3>Tweestapsverificatie</h3>
                            <div className="row-section">
                                <div className="information">
                                    <span className="title">Authenticator-app</span>
                                    <span className="description">Inloggen met een extra code uit een app.</span>
                                </div>
                                <div className="form-section setting-option">
                                    <Toggle
                                        label="Tweestapsverificatie"
                                        checked={!!twoFactor.enabledAt || twoFactorMode === 'setup'}
                                        onChange={handleTwoFactorToggle}
                                        disabled={isTwoFactorBusy}
                                    />

                                    {twoFactor.enabledAt && !twoFactorMode && (
                                        <p className="field-note">
                                            Nog {twoFactor.backupLeft}{' '}
                                            {twoFactor.backupLeft === 1 ? 'back-upcode' : 'back-upcodes'} over.{' '}
                                            <button type="button" onClick={() => setTwoFactorMode('renew')}>
                                                Nieuwe back-upcodes
                                            </button>
                                        </p>
                                    )}

                                    {twoFactorMode === 'setup' && twoFactorSetup && (
                                        <div className="edit-holder setup">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={twoFactorSetup.qr} alt="QR-code voor je authenticator-app" className="qr" />
                                            <div className="form-section">
                                                <p>
                                                    <strong>1.</strong> Scan de QR-code met je authenticator-app.
                                                </p>
                                                <p className="placeholder">
                                                    Lukt scannen niet? Vul deze sleutel in de app in:{' '}
                                                    <code>{twoFactorSetup.secret}</code>
                                                </p>
                                                <p>
                                                    <strong>2.</strong> Vul de code van 6 cijfers in die de app nu toont.
                                                </p>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    autoComplete="one-time-code"
                                                    value={twoFactorCode}
                                                    aria-label="Code uit de app"
                                                    onChange={(e) => setTwoFactorCode(e.target.value)}
                                                    placeholder="Vul de code in"
                                                />
                                                <div className="form-row">
                                                    <button
                                                        type="button"
                                                        className="button cancel"
                                                        onClick={() => setTwoFactorMode(null)}
                                                        disabled={isTwoFactorBusy}
                                                    >
                                                        Annuleren
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="button"
                                                        onClick={confirmTwoFactor}
                                                        disabled={isTwoFactorBusy}
                                                    >
                                                        Bevestigen
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {(twoFactorMode === 'disable' || twoFactorMode === 'renew') && (
                                        <div className="edit-holder form-section">
                                            <p className="field-note">
                                                {twoFactorMode === 'disable'
                                                    ? 'Vul je wachtwoord in om tweestapsverificatie uit te zetten.'
                                                    : 'Vul je wachtwoord in voor nieuwe back-upcodes. De oude werken daarna niet meer.'}
                                            </p>
                                            <PasswordInput
                                                value={twoFactorPassword}
                                                autoFocus
                                                label="Wachtwoord"
                                                onChange={setTwoFactorPassword}
                                                placeholder="Vul je wachtwoord in"
                                            />
                                            <div className="form-row">
                                                <button
                                                    type="button"
                                                    className="button cancel"
                                                    onClick={() => {
                                                        setTwoFactorMode(null);
                                                        setTwoFactorPassword('');
                                                    }}
                                                    disabled={isTwoFactorBusy}
                                                >
                                                    Annuleren
                                                </button>
                                                {twoFactorMode === 'disable' ? (
                                                    <button
                                                        type="button"
                                                        className="button negative"
                                                        onClick={disableTwoFactor}
                                                        disabled={isTwoFactorBusy}
                                                    >
                                                        Uitzetten
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="button"
                                                        onClick={renewBackupCodes}
                                                        disabled={isTwoFactorBusy}
                                                    >
                                                        Nieuwe back-upcodes
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {backupCodes && (
                                <div className="row-section">
                                    <div className="information">
                                        <span className="title">Je back-upcodes</span>
                                        <span className="description">
                                            Telefoon kwijt? Dan log je in met een van deze codes; elke code werkt één
                                            keer. Bewaar ze op een veilige plek: je ziet ze hierna niet meer.
                                        </span>
                                    </div>
                                    <div className="form-section">
                                        <ul className="backup-codes">
                                            {backupCodes.map((code) => (
                                                <li key={code}>{code}</li>
                                            ))}
                                        </ul>
                                        <div className="form-row">
                                            <button type="button" className="button cancel" onClick={copyBackupCodes}>
                                                Kopiëren
                                            </button>
                                            <button type="button" className="button" onClick={() => setBackupCodes(null)}>
                                                Ik heb ze bewaard
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'plugins' && <PluginsSettings />}

                    {activeTab === 'email' && (
                        <>
                            <h2>E-mail</h2>

                            <p className="field-note">
                                Offertes gaan vanuit de Gmail of Outlook die je bij Plug-ins hebt gekoppeld.
                                Hieronder stel je de tekst van die mail in.
                            </p>

                            <h3>Offertemail</h3>

                            <div className="row-section">
                                <div className="information">
                                    <label className="title" htmlFor="quote_email_subject">Onderwerp</label>
                                    <span className="description">
                                        Gebruik <code>&#123;&#123;offertenummer&#125;&#125;</code>,{' '}
                                        <code>&#123;&#123;klant&#125;&#125;</code> of{' '}
                                        <code>&#123;&#123;bedrijf&#125;&#125;</code>.
                                    </span>
                                </div>
                                <div>
                                    <input
                                        id="quote_email_subject"
                                        type="text"
                                        value={emailSettings.quote_email_subject}
                                        onChange={(e) =>
                                            setEmailSettings({ ...emailSettings, quote_email_subject: e.target.value })
                                        }
                                        placeholder="Vul een onderwerp in"
                                    />
                                </div>
                            </div>

                            <div className="row-section">
                                <div className="information">
                                    <span className="title">Tekst</span>
                                    <span className="description">
                                        Komt onder je logo, boven de knop naar de offerte.
                                    </span>
                                </div>
                                <div>
                                    <RichTextEditor
                                        value={emailSettings.quote_email_intro_text}
                                        onChange={(quote_email_intro_text) =>
                                            setEmailSettings({ ...emailSettings, quote_email_intro_text })
                                        }
                                        placeholder="Vul een tekst in"
                                    />
                                </div>
                            </div>

                            <div className="row-section">
                                <div className="information">
                                    <span className="title">Herinnering</span>
                                    <span className="description">
                                        Nog niet ondertekend? Dan gaat er na een aantal dagen één vriendelijke
                                        herinnering, vanuit je eigen mailbox.
                                    </span>
                                </div>
                                <div className="form-section setting-option">
                                    <Toggle
                                        label="Herinnering versturen"
                                        checked={reminderEnabled}
                                        onChange={(on) => {
                                            setReminderEnabled(on);
                                            if (on && !emailSettings.quote_reminder_days) {
                                                setEmailSettings({ ...emailSettings, quote_reminder_days: '7' });
                                            }
                                        }}
                                    />
                                    {reminderEnabled && (
                                        <div className="edit-holder form-section">
                                            <p className="field-note">
                                                Na hoeveel dagen zonder handtekening gaat de herinnering?
                                            </p>
                                            <div className="form-row">
                                                <div className="form-group">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={60}
                                                        value={emailSettings.quote_reminder_days}
                                                        aria-label="Aantal dagen"
                                                        onChange={(e) =>
                                                            setEmailSettings({ ...emailSettings, quote_reminder_days: e.target.value })
                                                        }
                                                        placeholder="Vul een aantal dagen in"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h3>Factuurmail</h3>

                            <div className="row-section">
                                <div className="information">
                                    <label className="title" htmlFor="invoice_email_subject">Onderwerp</label>
                                    <span className="description">
                                        Gebruik <code>&#123;&#123;factuurnummer&#125;&#125;</code>,{' '}
                                        <code>&#123;&#123;klant&#125;&#125;</code> of{' '}
                                        <code>&#123;&#123;bedrijf&#125;&#125;</code>.
                                    </span>
                                </div>
                                <div>
                                    <input
                                        id="invoice_email_subject"
                                        type="text"
                                        value={emailSettings.invoice_email_subject}
                                        onChange={(e) =>
                                            setEmailSettings({ ...emailSettings, invoice_email_subject: e.target.value })
                                        }
                                        placeholder="Vul een onderwerp in"
                                    />
                                </div>
                            </div>

                            <div className="row-section">
                                <div className="information">
                                    <span className="title">Tekst</span>
                                    <span className="description">
                                        Komt onder je logo in de factuurmail.
                                    </span>
                                </div>
                                <div>
                                    <RichTextEditor
                                        value={emailSettings.invoice_email_intro_text}
                                        onChange={(invoice_email_intro_text) =>
                                            setEmailSettings({ ...emailSettings, invoice_email_intro_text })
                                        }
                                        placeholder="Vul een tekst in"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {showTemplateHelp && (
                        <SidePanel title="Uitleg sjablonen" onClose={() => setShowTemplateHelp(false)}>
                            <p>
                                Plak bij Offertesjabloon en Factuursjabloon de HTML van je eigen ontwerp.
                                Alles wat vast is — de zijbalk, kleuren, logo, paginanummers — schrijf je
                                zelf. De plekken die met het document meegroeien laat je leeg; die vult het
                                systeem.
                            </p>

                            <h3>Plekken die het systeem vult</h3>
                            <p>
                                Zet een leeg element neer met het juiste data-slot; het systeem zet de
                                inhoud erin.
                            </p>
                            <ul>
                                <li>
                                    <code>data-repeat=&quot;blok&quot;</code> — zet dit op je pagina; die
                                    wordt dan één keer herhaald per blok in de offerte
                                </li>
                                <li><code>data-slot=&quot;blok&quot;</code> — de inhoud van dat blok</li>
                                <li><code>data-slot=&quot;bloktitel&quot;</code> — de titel van dat blok</li>
                                <li><code>data-slot=&quot;totaal&quot;</code> — het eindbedrag</li>
                                <li><code>data-slot=&quot;betaling&quot;</code> — alleen op een factuur: de QR-code om te betalen, met IBAN, bedrag en omschrijving</li>
                            </ul>
                            <p>
                                Elke pagina krijgt ook <code>data-blok-titel</code> mee, zodat je één
                                pagina anders kunt opmaken:{' '}
                                <code>.pagina[data-blok-titel=&quot;Algemene voorwaarden&quot;] &#123; ... &#125;</code>
                            </p>

                            <h3>Losse waarden</h3>
                            <p>
                                Deze kun je midden in je tekst zetten, bijvoorbeeld{' '}
                                <code>&#123;&#123;bedrijf_naam&#125;&#125;</code>
                            </p>
                            <ul>
                                <li><code>&#123;&#123;documenttitel&#125;&#125;</code>, <code>&#123;&#123;totaal&#125;&#125;</code>, <code>&#123;&#123;logo&#125;&#125;</code></li>
                                <li><code>&#123;&#123;klant_naam&#125;&#125;</code>, <code>&#123;&#123;klant_adres&#125;&#125;</code>, <code>&#123;&#123;klant_postcode_plaats&#125;&#125;</code></li>
                                <li><code>&#123;&#123;bedrijf_naam&#125;&#125;</code>, <code>&#123;&#123;bedrijf_adres&#125;&#125;</code>, <code>&#123;&#123;bedrijf_postcode_plaats&#125;&#125;</code>, <code>&#123;&#123;bedrijf_email&#125;&#125;</code>, <code>&#123;&#123;bedrijf_telefoon&#125;&#125;</code>, <code>&#123;&#123;bedrijf_kvk&#125;&#125;</code>, <code>&#123;&#123;bedrijf_btw&#125;&#125;</code>, <code>&#123;&#123;bedrijf_iban&#125;&#125;</code></li>
                                <li>de kenmerken van het document: <code>&#123;&#123;offertenummer&#125;&#125;</code>, <code>&#123;&#123;offertedatum&#125;&#125;</code>, <code>&#123;&#123;geldig_tot&#125;&#125;</code></li>
                            </ul>

                            <p>
                                Zonder eigen sjabloon krijgt je document het standaardsjabloon van Khance.
                                Met &quot;Standaard herstellen&quot; ga je daar terug naartoe.
                            </p>
                        </SidePanel>
                    )}
                </div>
            </div>
        </Layout>
    )
}
