import React from 'react';
import { Icon } from './Icon';
import { NavTab } from '../types';

interface SidebarProps {
    activeTab: NavTab;
    onTabChange: (tab: NavTab) => void;
}

const NavItem: React.FC<{ 
    icon: string; 
    label: string; 
    active?: boolean; 
    onClick?: () => void;
}> = ({ icon, label, active = false, onClick }) => (
    <button 
        onClick={onClick}
        className={`
            w-full flex items-center gap-3 px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 group text-left
            ${active 
                ? 'bg-white/5 border border-border-dark text-primary dark:text-text-primary-dark shadow-glow' 
                : 'text-gray-600 dark:text-text-secondary-dark hover:bg-white/5 hover:text-primary border border-transparent'}
        `}
    >
        <Icon name={icon} className={`text-[18px] transition-colors ${active ? '' : 'group-hover:text-primary'}`} />
        {label}
    </button>
);

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
    
    // Helper to determine if we are in the "Management" section
    const isManagementActive = [
        NavTab.LicenseKeys,
        NavTab.FileManager,
        NavTab.Products,
        NavTab.Agents
    ].includes(activeTab);

    return (
        <aside className="w-60 bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark flex flex-col justify-between flex-shrink-0 z-20 h-full">
            <div>
                {/* Organization Header */}
                <div className="p-3 border-b border-border-light dark:border-border-dark flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-sm bg-primary flex items-center justify-center text-background-dark font-bold text-xs font-display">
                            YM
                        </div>
                        <div className="flex flex-col leading-tight">
                            <span className="text-xs font-semibold dark:text-text-primary-dark tracking-wide font-display">YMPHE66H64</span>
                            <span className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-mono">Enterprise</span>
                        </div>
                    </div>
                    <Icon name="unfold_more" className="text-text-secondary-dark text-xs" />
                </div>

                {/* Navigation */}
                <nav className="mt-3 px-2 space-y-0.5 font-display">
                    <p className="px-3 text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest mb-2 mt-2 opacity-60">Platform</p>
                    
                    <NavItem icon="dashboard" label="Dashboard" />
                    
                    <NavItem 
                        icon="vpn_key" 
                        label="Management" 
                        active={isManagementActive} 
                        onClick={() => onTabChange(NavTab.LicenseKeys)}
                    />
                    
                    <NavItem icon="people" label="Users" />
                    <NavItem icon="terminal" label="Remote Control" />
                    <NavItem icon="security" label="Security" />
                    <NavItem icon="webhook" label="Webhooks" />
                    
                    <NavItem 
                        icon="description" 
                        label="Logs" 
                        active={activeTab === NavTab.SystemLogs}
                        onClick={() => onTabChange(NavTab.SystemLogs)}
                    />
                </nav>
            </div>

            {/* User Profile */}
            <div className="p-3 border-t border-border-light dark:border-border-dark flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-border-dark flex items-center justify-center text-text-secondary-dark font-bold text-xs font-display">
                        Y
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-xs font-semibold dark:text-text-primary-dark font-display">YMPHE66H64</span>
                        <span className="text-[10px] text-text-secondary-dark">Admin</span>
                    </div>
                </div>
                <Icon name="unfold_more" className="text-text-secondary-dark text-xs" />
            </div>
        </aside>
    );
};