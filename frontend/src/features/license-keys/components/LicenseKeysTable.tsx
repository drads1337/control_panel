import React from 'react';
import { Key, Search, Filter, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';

interface LicenseKey {
    id: string;
    key: string;
    product: string;
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
    created: string;
    expires: string;
    usage: string;
}

const keys: LicenseKey[] = [
    { id: '1', key: 'PROD-A-8X92-MM92', product: 'Project Phoenix', status: 'ACTIVE', created: '2 mins ago', expires: '48 hours', usage: '0/1' },
    { id: '2', key: 'PROD-B-7721-KL01', product: 'Nebula Engine', status: 'ACTIVE', created: '1 hour ago', expires: '30 days', usage: '1/5' },
    { id: '3', key: 'AGENT-X-9921-PP00', product: 'Agent Smith', status: 'REVOKED', created: '2 days ago', expires: '-', usage: '1/1' },
    { id: '4', key: 'KEY_CUSTOM_001', product: 'Project Phoenix', status: 'EXPIRED', created: '1 week ago', expires: 'Exp. yesterday', usage: '1/1' },
    { id: '5', key: 'PROD-A-1122-3344', product: 'Project Phoenix', status: 'ACTIVE', created: '2 weeks ago', expires: '1 year', usage: '12/50' },
];

export const LicenseKeysTable: React.FC = () => {
    return (
        <div className="bg-surface-dark border border-border-dark rounded-sm flex flex-col shadow-sm">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border-dark flex justify-between items-center">
                 <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Key className="text-primary h-4 w-4" />
                        Generated Keys
                    </h3>
                    <p className="text-xs text-text-secondary-dark mt-0.5">Recent license generation history.</p>
                </div>
                <div className="flex gap-2">
                     <div className="relative group">
                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                            <Search className="text-text-secondary-dark text-xs group-focus-within:text-primary transition-colors h-3 w-3" />
                        </span>
                        <input 
                            className="bg-background-dark border border-border-dark rounded-sm pl-7 pr-3 py-1.5 text-[10px] text-text-primary-dark focus:border-primary outline-none font-mono w-48 focus:ring-1 focus:ring-primary transition-all placeholder-text-secondary-dark/50" 
                            placeholder="Find key..." 
                            type="text" 
                        />
                    </div>
                    <button className="px-2 py-1 bg-background-dark border border-border-dark rounded-sm text-text-secondary-dark hover:text-white hover:border-text-secondary-dark/50 transition-all">
                        <Filter className="text-sm h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-background-dark/50 border-b border-border-dark text-[10px] uppercase tracking-widest text-text-secondary-dark font-mono">
                            <th className="px-5 py-3 font-semibold">License Key</th>
                            <th className="px-5 py-3 font-semibold">Product</th>
                            <th className="px-5 py-3 font-semibold">Status</th>
                            <th className="px-5 py-3 font-semibold">Created</th>
                            <th className="px-5 py-3 font-semibold text-right">Usage</th>
                            <th className="px-5 py-3 font-semibold text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="text-[11px]">
                        {keys.map((k) => (
                            <tr key={k.id} className="border-b border-border-dark/50 hover:bg-white/5 transition-colors group">
                                <td className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        <Key className="text-xs text-text-secondary-dark opacity-50 h-3 w-3" />
                                        <span className="font-mono text-text-primary-dark font-medium select-all">{k.key}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-3 font-medium text-text-secondary-dark">{k.product}</td>
                                <td className="px-5 py-3">
                                    <span className={`px-1.5 py-0.5 rounded-[2px] border text-[9px] font-bold uppercase tracking-wider ${
                                        k.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        k.status === 'REVOKED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                        'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                    }`}>
                                        {k.status}
                                    </span>
                                </td>
                                <td className="px-5 py-3 text-text-secondary-dark">
                                    <div className="flex flex-col">
                                        <span className="text-text-primary-dark">{k.created}</span>
                                        <span className="text-[9px] opacity-60">Expires: {k.expires}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-3 text-right font-mono text-text-secondary-dark">{k.usage}</td>
                                <td className="px-5 py-3 text-right">
                                    <button className="text-text-secondary-dark hover:text-white transition-colors opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded">
                                        <MoreVertical className="text-base h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             {/* Footer Pagination */}
            <div className="px-5 py-3 border-t border-border-dark flex justify-between items-center bg-background-dark/30">
                <span className="text-[10px] font-mono text-text-secondary-dark uppercase tracking-widest opacity-50">Showing 5 of 208</span>
                <div className="flex gap-1">
                    <button className="w-6 h-6 flex items-center justify-center rounded-sm border border-border-dark bg-background-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-text-secondary-dark/50 disabled:opacity-30 transition-all">
                        <ChevronLeft className="text-xs h-3 w-3" />
                    </button>
                    <button className="w-6 h-6 flex items-center justify-center rounded-sm border border-border-dark bg-background-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-text-secondary-dark/50 disabled:opacity-30 transition-all">
                        <ChevronRight className="text-xs h-3 w-3" />
                    </button>
                </div>
            </div>
        </div>
    );
};

