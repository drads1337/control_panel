import React from 'react';
import { Icon } from './Icon';
import { Select } from './Select';

interface ProductItem {
    id: string;
    name: string;
    description?: string;
    status: 'ACTIVE' | 'MAINTENANCE';
    version: string;
    internalId: string;
    downloads: number;
    users: number;
}

const products: ProductItem[] = [
    {
        id: '1',
        name: 'Project Phoenix',
        description: 'Core System',
        status: 'ACTIVE',
        version: 'v1.0.0',
        internalId: '9678615',
        downloads: 1204,
        users: 840
    },
    {
        id: '2',
        name: 'Nebula Engine',
        description: 'v.2.4.1-RC',
        status: 'MAINTENANCE',
        version: 'v2.4.1',
        internalId: '9796709',
        downloads: 45,
        users: 12
    }
];

export const ProductsManager: React.FC = () => {
    return (
        <div className="flex flex-col h-full">
            {/* Header Area */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-text-primary-dark tracking-wide font-display">Products</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <p className="text-[10px] text-text-secondary-dark font-mono uppercase tracking-wider">2 configured</p>
                    </div>
                </div>
                <button className="bg-primary hover:bg-primary-hover text-background-dark px-3 py-1.5 rounded-sm text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-glow">
                    <Icon name="add" className="text-sm" />
                    NEW PRODUCT
                </button>
            </div>

            {/* Filter Toolbar */}
            <div className="grid grid-cols-12 gap-3 mb-4 bg-surface-dark/30 p-2 rounded border border-border-dark/50">
                <div className="col-span-9 relative group">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Icon name="search" className="text-text-secondary-dark text-sm group-focus-within:text-primary transition-colors" />
                    </span>
                    <input 
                        className="w-full bg-background-dark border border-border-dark rounded-sm pl-8 pr-3 py-1.5 text-[11px] text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark/50 transition-all outline-none font-mono" 
                        placeholder="SEARCH_DB..." 
                        type="text" 
                    />
                </div>
                <div className="col-span-3">
                     <Select 
                        className="w-full rounded-sm pl-2 pr-6 py-1.5 text-[10px] font-bold uppercase tracking-wider" 
                        icon="unfold_more"
                    >
                        <option>All Status</option>
                        <option>Active</option>
                        <option>Maintenance</option>
                    </Select>
                </div>
            </div>

            {/* Product List */}
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {products.map((product) => (
                    <div key={product.id} className="bg-surface-dark border border-border-dark rounded-sm p-3 flex items-center justify-between group hover:border-text-secondary-dark/30 transition-all">
                        
                        {/* Left Section: Info */}
                        <div className="flex items-center gap-4 min-w-0">
                            {/* Selection */}
                            <div className="flex items-center justify-center">
                                <div className="w-3.5 h-3.5 rounded-full border border-border-dark cursor-pointer hover:border-primary transition-colors"></div>
                            </div>
                            
                            {/* Icon Box */}
                            <div className="w-9 h-9 rounded bg-background-dark border border-border-dark flex items-center justify-center text-text-secondary-dark group-hover:text-primary transition-colors shadow-sm">
                                <Icon name="deployed_code" className="text-lg" />
                            </div>

                            {/* Main Details */}
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-text-primary-dark truncate font-display">{product.name}</span>
                                    <span className={`text-[9px] font-bold px-1 py-px rounded-[2px] border tracking-wider uppercase ${
                                        product.status === 'ACTIVE' 
                                            ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' 
                                            : 'bg-orange-500/5 text-orange-400 border-orange-500/20'
                                    }`}>
                                        {product.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-text-secondary-dark font-mono leading-none mt-0.5">
                                    <span className="opacity-60">VER <span className="text-text-primary-dark opacity-100">{product.version}</span></span>
                                    <span className="w-px h-2 bg-border-dark"></span>
                                    <span className="opacity-60">ID: <span className="text-text-primary-dark opacity-100">{product.internalId}</span></span>
                                    <span className="w-px h-2 bg-border-dark"></span>
                                    <span className="px-1.5 py-px rounded bg-white/5 border border-border-dark text-[9px] opacity-70">LICENSE</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Section: Stats & Actions */}
                        <div className="flex items-center gap-6">
                            {/* Stats */}
                            <div className="hidden xl:flex items-center gap-4 text-[10px] font-mono text-text-secondary-dark border-r border-border-dark pr-6 mr-2">
                                <div className="flex flex-col items-end leading-tight">
                                    <span className="text-text-primary-dark font-bold">{product.downloads}</span>
                                    <span className="text-[9px] opacity-50 uppercase">Downloads</span>
                                </div>
                                <div className="flex flex-col items-end leading-tight">
                                    <span className="text-text-primary-dark font-bold">{product.users}</span>
                                    <span className="text-[9px] opacity-50 uppercase">Users</span>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center gap-2">
                                <Select 
                                    className="w-24 rounded-sm pl-2 pr-6 py-1 text-[10px] font-medium"
                                    defaultValue={product.status === 'ACTIVE' ? 'Active' : 'Maintenance'}
                                >
                                    <option>Active</option>
                                    <option>Maintenance</option>
                                    <option>Disabled</option>
                                </Select>
                                
                                <button className="w-6 h-6 flex items-center justify-center rounded-sm hover:bg-white/5 text-text-secondary-dark hover:text-text-primary-dark transition-colors border border-transparent hover:border-border-dark">
                                    <Icon name="edit" className="text-xs" />
                                </button>
                                <button className="w-6 h-6 flex items-center justify-center rounded-sm hover:bg-white/5 text-text-secondary-dark hover:text-text-primary-dark transition-colors border border-transparent hover:border-border-dark">
                                    <Icon name="more_horiz" className="text-sm" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Pagination */}
            <div className="flex items-center justify-between pt-3 border-t border-border-dark mt-auto">
                <span className="text-[9px] font-mono text-text-secondary-dark uppercase tracking-widest opacity-50">Row 1-2 of 2</span>
                <div className="flex gap-1">
                    <button className="w-6 h-6 flex items-center justify-center rounded-sm border border-border-dark bg-background-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-text-secondary-dark/50 disabled:opacity-30 transition-all">
                        <Icon name="chevron_left" className="text-xs" />
                    </button>
                    <button className="w-6 h-6 flex items-center justify-center rounded-sm border border-border-dark bg-background-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-text-secondary-dark/50 disabled:opacity-30 transition-all">
                        <Icon name="chevron_right" className="text-xs" />
                    </button>
                </div>
            </div>
        </div>
    );
};