import { useState } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { CircleUserRound, Languages, Bell, UserRoundPlus, ShoppingCart, Mail, Bot } from 'lucide-react';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('account');
    return (
        <Layout>
            <div className="header">
                <h1>Instellingen</h1>
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
                            href="#webshop"
                            className={`${activeTab === 'webshop' ? 'active' : ''}`}
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveTab('webshop');
                            }}
                        >
                            <ShoppingCart size={18} />
                            <span>Webshop</span>
                        </Link>
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
                        <Link
                            href="#openai"
                            className={`${activeTab === 'openai' ? 'active' : ''}`}
                            onClick={(e) => {
                                e.preventDefault();
                                setActiveTab('openai');
                            }}
                        >
                            <Bot size={18} />
                            <span>OpenAI</span>
                        </Link>

                    </nav>
                </div>
                <div className="block">
                    {activeTab === 'account' && (
                        <h2>Account</h2>

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

                    {activeTab === 'webshop' && (
                        <h2>Webshop</h2>

                    )}


                    {activeTab === 'email' && (
                        <h2>E-mail</h2>

                    )}


                    {activeTab === 'openai' && (
                        <h2>OpenAI</h2>

                    )}
                </div>
            </div>
        </Layout>
    )
}