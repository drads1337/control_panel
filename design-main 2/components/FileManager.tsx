import React from 'react';
import { Icon } from './Icon';

interface Project {
    id: string;
    name: string;
    subId: string;
    status: string;
    icon: string;
    active?: boolean;
}

interface FileItem {
    name: string;
    type: 'folder' | 'file';
    size: string;
    modified: string;
    icon: string;
    iconColor: string;
}

const projects: Project[] = [
    { id: '1', name: 'Project Phoenix', subId: '#88291', status: '2H AGO', icon: 'rocket_launch', active: true },
    { id: '2', name: 'Nebula Core', subId: '#99210', status: 'OFFLINE', icon: 'extension' },
    { id: '3', name: 'Void Script', subId: '#11029', status: 'ARCHIVED', icon: 'code' },
];

const files: FileItem[] = [
    { name: 'configs/', type: 'folder', size: '--', modified: '20 Dec 23:40', icon: 'folder', iconColor: 'text-yellow-500/80' },
    { name: 'bin/', type: 'folder', size: '--', modified: '20 Dec 23:40', icon: 'folder', iconColor: 'text-yellow-500/80' },
    { name: 'manifest.json', type: 'file', size: '2.4 KB', modified: '19 Dec 14:20', icon: 'description', iconColor: 'text-blue-400/80' },
    { name: 'license_key.dat', type: 'file', size: '128 B', modified: '18 Dec 09:15', icon: 'lock', iconColor: 'text-purple-400/80' },
    { name: 'README.md', type: 'file', size: '4.1 KB', modified: '15 Dec 11:00', icon: 'info', iconColor: 'text-gray-400/80' },
];

export const FileManager: React.FC = () => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[480px]">
            {/* Left Column: Projects List */}
            <div className="lg:col-span-3 flex flex-col h-full bg-background-dark border border-border-dark rounded overflow-hidden">
                {/* Header */}
                <div className="px-3 py-2 flex items-center justify-between border-b border-border-dark">
                    <div className="flex items-center gap-2">
                        <h3 className="text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Projects</h3>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary-dark">
                        <Icon name="add" className="text-sm cursor-pointer hover:text-text-primary-dark transition-colors" />
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="px-2 py-1.5 border-b border-border-dark/50 bg-surface-dark/20">
                    <div className="relative group">
                        <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                            <Icon name="search" className="text-text-secondary-dark text-xs group-focus-within:text-primary transition-colors" />
                        </span>
                        <input 
                            className="w-full bg-transparent border-none p-0 pl-6 py-1 text-[10px] text-text-primary-dark placeholder-text-secondary-dark/40 focus:ring-0 font-mono" 
                            placeholder="FILTER..." 
                            type="text" 
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                    {projects.map((project) => (
                        <div 
                            key={project.id}
                            className={`
                                px-2 py-2 rounded-sm transition-all cursor-pointer group flex items-center gap-2.5
                                ${project.active 
                                    ? 'bg-surface-dark border border-border-dark text-text-primary-dark' 
                                    : 'border border-transparent hover:bg-white/5 text-text-secondary-dark'}
                            `}
                        >
                            <Icon name={project.icon} className={`text-sm ${project.active ? 'text-primary' : 'opacity-70'}`} filled={project.active} />
                            <div className="flex-1 min-w-0 flex flex-col">
                                <span className={`text-[11px] font-medium truncate leading-tight ${project.active ? 'text-text-primary-dark' : 'text-text-secondary-dark'}`}>
                                    {project.name}
                                </span>
                                <div className="flex items-center gap-1.5 opacity-60">
                                    <span className="text-[9px] font-mono">{project.subId}</span>
                                </div>
                            </div>
                            {project.active && <div className="w-1 h-1 rounded-full bg-primary"></div>}
                        </div>
                    ))}
                </div>
                
                {/* Bottom Status */}
                <div className="px-3 py-1.5 border-t border-border-dark flex justify-between items-center text-[9px] font-mono text-text-secondary-dark uppercase opacity-60">
                    <span>Online</span>
                    <span>12ms</span>
                </div>
            </div>

            {/* Right Column: File Explorer */}
            <div className="lg:col-span-9 flex flex-col h-full bg-surface-dark/10 border border-border-dark rounded overflow-hidden">
                {/* Toolbar */}
                <div className="px-4 py-2 flex items-center justify-between border-b border-border-dark">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-secondary-dark">
                        <span className="hover:text-text-primary-dark cursor-pointer transition-colors">ROOT</span>
                        <span className="opacity-40">/</span>
                        <span className="hover:text-text-primary-dark cursor-pointer transition-colors">PRODUCTS</span>
                        <span className="opacity-40">/</span>
                        <span className="text-primary font-bold">PHOENIX</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="text-text-secondary-dark hover:text-text-primary-dark transition-colors">
                            <Icon name="refresh" className="text-sm" />
                        </button>
                        <button className="bg-white/5 hover:bg-white/10 border border-border-dark text-text-primary-dark px-2.5 py-1 rounded-sm text-[10px] font-bold flex items-center gap-1.5 transition-all">
                            <Icon name="upload" className="text-xs" />
                            UPLOAD
                        </button>
                    </div>
                </div>

                {/* File Table Header */}
                <div className="grid grid-cols-12 px-4 py-2 border-b border-border-dark bg-surface-dark/30 text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest">
                    <div className="col-span-6">Name</div>
                    <div className="col-span-3 text-right">Size</div>
                    <div className="col-span-3 text-right">Date</div>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto font-mono text-[11px]">
                    {files.map((file, idx) => (
                        <div key={idx} className="grid grid-cols-12 px-4 py-1.5 hover:bg-white/5 items-center group cursor-pointer transition-colors border-b border-transparent hover:border-border-dark/30">
                            <div className="col-span-6 flex items-center gap-2.5">
                                <Icon name={file.icon} className={`text-base ${file.iconColor}`} filled={file.type === 'folder'} />
                                <span className={`${file.type === 'folder' ? 'text-text-primary-dark font-medium' : 'text-text-secondary-dark group-hover:text-text-primary-dark'}`}>
                                    {file.name}
                                </span>
                            </div>
                            <div className="col-span-3 text-right text-text-secondary-dark opacity-60">
                                {file.size}
                            </div>
                            <div className="col-span-3 text-right text-text-secondary-dark opacity-60">
                                {file.modified}
                            </div>
                        </div>
                    ))}
                    {[...Array(8)].map((_, i) => (
                         <div key={`empty-${i}`} className="grid grid-cols-12 px-4 py-1.5 opacity-5 pointer-events-none">
                             <div className="col-span-12 h-4 border-b border-dashed border-border-dark"></div>
                         </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-3 py-1.5 border-t border-border-dark flex justify-between items-center bg-surface-dark/30">
                    <div className="text-[9px] font-mono text-text-secondary-dark uppercase tracking-wider">
                        5 Items selected
                    </div>
                    <div className="flex items-center gap-2 opacity-60">
                        <Icon name="grid_view" className="text-text-secondary-dark text-xs hover:text-primary cursor-pointer" />
                    </div>
                </div>
            </div>
        </div>
    );
};