import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Icon } from './components/Icon';
import { StatsCard } from './components/StatsCard';
import { CreateKeyForm, CreateCustomKeyForm } from './components/Forms';
import { FileManager } from './components/FileManager';
import { ProductsManager } from './components/ProductsManager';
import { SystemLogs } from './components/SystemLogs';
import { StatsData, NavTab } from './types';

const statsData: StatsData[] = [
    { id: '1', label: 'License Keys', subLabel: 'Active', value: '208', subValue: '207', subValueLabel: 'ACTIVE KEYS', icon: 'vpn_key', active: true },
    { id: '2', label: 'Products', subLabel: 'DB', value: '2', subValue: '', subValueLabel: 'GLOBAL ITEMS', icon: 'inventory_2' },
    { id: '3', label: 'Files', subLabel: 'SYS', value: '0', subValue: '', subValueLabel: 'SYSTEM FILES', icon: 'folder' },
    { id: '4', label: 'Agents', subLabel: 'NET', value: '0', subValue: '', subValueLabel: 'ONLINE NODES', icon: 'bolt' },
];

const tabIcons: Record<NavTab, string> = {
    [NavTab.LicenseKeys]: 'vpn_key',
    [NavTab.FileManager]: 'folder_open',
    [NavTab.Products]: 'inventory_2',
    [NavTab.Agents]: 'bolt',
    [NavTab.SystemLogs]: 'description',
};

export default function App() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<NavTab>(NavTab.LicenseKeys);

    // Dynamic header content based on active tab
    const getHeaderContent = () => {
        if (activeTab === NavTab.SystemLogs) {
            return {
                title: 'System Logs',
                subtitle: 'Monitor and analyze system activity and user actions.'
            };
        }
        return {
            title: 'System Overview',
            subtitle: 'Briefing: Licenses, products, files, and agents status.'
        };
    };

    const headerContent = getHeaderContent();

    return (
        <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-gray-800 dark:text-text-primary-dark font-body">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-10 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            
            {/* Sidebar */}
            <div className={`fixed lg:static inset-y-0 left-0 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-200 z-20 ease-in-out`}>
                <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            <main className="flex-1 overflow-y-auto relative scroll-smooth flex flex-col">
                {/* Header */}
                <header className="sticky top-0 z-10 bg-background-light dark:bg-background-dark/95 backdrop-blur-sm border-b border-border-light dark:border-border-dark h-14 flex items-center justify-between px-6 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <button 
                            className="lg:hidden text-inactive-dark hover:text-text-primary-dark"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Icon name="menu" />
                        </button>
                        <div className="flex items-center gap-2">
                            <Icon name="space_dashboard" className="text-text-secondary-dark text-lg" />
                            <h1 className="text-lg font-semibold text-gray-800 dark:text-text-primary-dark tracking-wide font-display">Management</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative hidden sm:block group">
                            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                <Icon name="search" className="text-text-secondary-dark text-base group-focus-within:text-primary transition-colors" />
                            </span>
                            <input 
                                className="pl-9 pr-10 py-1 bg-surface-dark border border-border-dark rounded text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary w-64 placeholder-text-secondary-dark transition-all outline-none" 
                                placeholder="Search system..." 
                                type="text" 
                            />
                            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                                <span className="text-[10px] text-text-secondary-dark border border-border-dark rounded px-1.5 py-0.5 font-mono-numbers">⌘K</span>
                            </div>
                        </div>
                        <button className="text-text-secondary-dark hover:text-text-primary-dark transition-colors">
                            <Icon name="laptop" className="text-lg" />
                        </button>
                    </div>
                </header>

                <div className="p-6 max-w-7xl mx-auto w-full space-y-5 pb-20 flex-1 flex flex-col">
                    {/* Page Title & Status */}
                    <div className="flex items-end justify-between border-b border-border-dark pb-2 mb-4 flex-shrink-0">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-text-primary-dark mb-0.5 tracking-tight font-display">
                                {headerContent.title}
                            </h2>
                            <p className="text-text-secondary-dark text-xs font-medium">
                                {headerContent.subtitle}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-mono-numbers text-text-secondary-dark bg-surface-dark px-2 py-1 rounded border border-border-dark">UPDATED: JUST NOW</span>
                        </div>
                    </div>

                    {/* Stats Grid - Hide on Logs tab to reduce clutter */}
                    {activeTab !== NavTab.SystemLogs && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 flex-shrink-0">
                            {statsData.map(data => (
                                <StatsCard key={data.id} data={data} />
                            ))}
                        </div>
                    )}

                    {/* Tab Navigation */}
                    <div className="bg-surface-dark border border-border-dark rounded p-1 flex items-center overflow-x-auto shadow-sm no-scrollbar flex-shrink-0">
                        {Object.values(NavTab).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`
                                    flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-all uppercase tracking-wide whitespace-nowrap
                                    ${activeTab === tab 
                                        ? 'bg-white/10 text-text-primary-dark border border-border-dark' 
                                        : 'text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/5 border border-transparent'}
                                `}
                            >
                                <Icon name={tabIcons[tab]} className="text-sm" />
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Content Area Switch */}
                    <div className="flex-1 min-h-0">
                        {activeTab === NavTab.LicenseKeys && (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 h-full">
                                <CreateKeyForm />
                                <CreateCustomKeyForm />
                            </div>
                        )}
                        
                        {activeTab === NavTab.FileManager && (
                            <FileManager />
                        )}

                        {activeTab === NavTab.Products && (
                            <ProductsManager />
                        )}

                        {activeTab === NavTab.Agents && (
                            <div className="h-64 flex items-center justify-center border border-dashed border-border-dark rounded bg-surface-dark/30">
                                <div className="text-center text-text-secondary-dark">
                                    <Icon name="bolt" className="text-4xl mb-2 opacity-50" />
                                    <p className="text-xs uppercase tracking-widest font-bold">Agents Module Unavailable</p>
                                </div>
                            </div>
                        )}

                        {activeTab === NavTab.SystemLogs && (
                            <SystemLogs />
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center pt-6 pb-2 text-[10px] text-text-secondary-dark border-t border-border-dark mt-auto uppercase tracking-widest opacity-60 flex-shrink-0">
                        <p>© 2025 SAAS MGR</p>
                        <p className="font-mono-numbers">V.1.0.0-BETA</p>
                    </div>
                </div>
            </main>
        </div>
    );
}