import React, { useState } from 'react';
import { Icon } from './Icon';
import { Card, CardHeader, CardContent, CardFooter } from '@/shared/ui/components/card';
import { Input } from '@/shared/ui/components/input';
import { Button } from '@/shared/ui/components/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/shared/ui/components/table';

// --- Types ---

interface Project {
    id: string;
    name: string;
    subId: string;
    status: string;
    icon: string;
}

interface FileItem {
    id: string; // Added ID for keys
    name: string;
    type: 'folder' | 'file';
    size: string;
    modified: string;
    icon: string;
    iconColor: string;
}

// --- Mock Data ---

const MOCK_PROJECTS: Project[] = [
    { id: '1', name: 'Project Phoenix', subId: '#88291', status: '2H AGO', icon: 'rocket_launch' },
    { id: '2', name: 'Nebula Core', subId: '#99210', status: 'OFFLINE', icon: 'extension' },
    { id: '3', name: 'Void Script', subId: '#11029', status: 'ARCHIVED', icon: 'code' },
];

const MOCK_FILES: FileItem[] = [
    { id: 'f1', name: 'configs/', type: 'folder', size: '--', modified: '20 Dec 23:40', icon: 'folder', iconColor: 'text-yellow-500/80' },
    { id: 'f2', name: 'bin/', type: 'folder', size: '--', modified: '20 Dec 23:40', icon: 'folder', iconColor: 'text-yellow-500/80' },
    { id: 'f3', name: 'manifest.json', type: 'file', size: '2.4 KB', modified: '19 Dec 14:20', icon: 'description', iconColor: 'text-blue-400/80' },
    { id: 'f4', name: 'license_key.dat', type: 'file', size: '128 B', modified: '18 Dec 09:15', icon: 'lock', iconColor: 'text-purple-400/80' },
    { id: 'f5', name: 'README.md', type: 'file', size: '4.1 KB', modified: '15 Dec 11:00', icon: 'info', iconColor: 'text-gray-400/80' },
];

// --- Sub-Components ---

const ProjectItem: React.FC<{ 
    project: Project; 
    isActive: boolean; 
    onClick: (id: string) => void 
}> = ({ project, isActive, onClick }) => (
    <div 
        onClick={() => onClick(project.id)}
        className={`
            px-2 py-2 rounded-sm transition-all cursor-pointer group flex items-center gap-2.5 mb-0.5
            ${isActive 
                ? 'bg-surface-dark border border-border-dark text-text-primary-dark shadow-sm' 
                : 'border border-transparent hover:bg-white/5 text-text-secondary-dark'}
        `}
    >
        <Icon 
            name={project.icon} 
            className={`h-4 w-4 transition-opacity ${isActive ? 'text-primary' : 'opacity-70 group-hover:opacity-100'}`} 
            filled={isActive} 
        />
        <div className="flex-1 min-w-0 flex flex-col">
            <span className={`text-[11px] font-medium truncate leading-tight ${isActive ? 'text-text-primary-dark' : 'text-text-secondary-dark'}`}>
                {project.name}
            </span>
            <div className="flex items-center gap-1.5 opacity-60">
                <span className="text-[9px] font-mono">{project.subId}</span>
            </div>
        </div>
        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]"></div>}
    </div>
);

const FileRow: React.FC<{ file: FileItem }> = ({ file }) => (
    <TableRow className="hover:bg-white/5 border-b border-transparent hover:border-border-dark/30 cursor-pointer group transition-colors">
        <TableCell className="px-4 py-1.5">
            <div className="flex items-center gap-2.5">
                <Icon name={file.icon} className={`h-4 w-4 ${file.iconColor}`} filled={file.type === 'folder'} />
                <span className={`${file.type === 'folder' ? 'text-text-primary-dark font-medium' : 'text-text-secondary-dark group-hover:text-text-primary-dark'} transition-colors`}>
                    {file.name}
                </span>
            </div>
        </TableCell>
        <TableCell className="px-4 py-1.5 text-right text-text-secondary-dark opacity-60 font-mono text-[10px]">
            {file.size}
        </TableCell>
        <TableCell className="px-4 py-1.5 text-right text-text-secondary-dark opacity-60 font-mono text-[10px]">
            {file.modified}
        </TableCell>
    </TableRow>
);

// --- Main Component ---

export const FileManager: React.FC = () => {
    const [activeProjectId, setActiveProjectId] = useState<string>('1');
    const [searchQuery, setSearchQuery] = useState('');

    const activeProject = MOCK_PROJECTS.find(p => p.id === activeProjectId);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[480px] font-sans">
            {/* Left Column: Projects List */}
            <Card className="lg:col-span-3 flex flex-col h-full bg-background-dark border-border-dark rounded-md overflow-hidden p-0 shadow-lg">
                <CardHeader className="px-3 py-2 flex flex-row items-center justify-between border-b border-border-dark shrink-0">
                    <h3 className="text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Projects</h3>
                    <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-5 w-5 text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/10 transition-colors"
                    >
                        <Icon name="add" className="h-4 w-4" />
                    </Button>
                </CardHeader>

                {/* Filter Bar */}
                <div className="px-2 py-1 border-b border-border-dark/50 bg-surface-dark/20 shrink-0">
                    <div className="relative group">
                        <span className="absolute inset-y-0 left-0 pl-1 flex items-center pointer-events-none">
                            <Icon name="search" className="h-3.5 w-3.5 text-text-secondary-dark group-focus-within:text-primary transition-colors" />
                        </span>
                        <Input 
                            className="w-full bg-transparent border-none p-0 pl-5 h-6 text-[10px] text-text-primary-dark placeholder:text-text-secondary-dark/40 focus-visible:ring-0 font-mono" 
                            placeholder="FILTER..." 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <CardContent className="flex-1 overflow-y-auto p-1.5 custom-scrollbar">
                    {MOCK_PROJECTS.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((project) => (
                        <ProjectItem 
                            key={project.id} 
                            project={project} 
                            isActive={project.id === activeProjectId}
                            onClick={setActiveProjectId}
                        />
                    ))}
                </CardContent>
                
                <CardFooter className="px-3 py-1.5 border-t border-border-dark flex justify-between items-center text-[9px] font-mono text-text-secondary-dark uppercase opacity-60 shrink-0 bg-surface-dark/10">
                    <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-pulse"></span>
                        Online
                    </span>
                    <span>12ms</span>
                </CardFooter>
            </Card>

            {/* Right Column: File Explorer */}
            <Card className="lg:col-span-9 flex flex-col h-full bg-surface-dark/10 border-border-dark rounded-md overflow-hidden p-0 shadow-lg">
                {/* Toolbar */}
                <CardHeader className="px-3 py-1.5 flex flex-row items-center justify-between border-b border-border-dark bg-surface-dark/5 shrink-0">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-secondary-dark">
                        <span className="hover:text-text-primary-dark cursor-pointer transition-colors">ROOT</span>
                        <span className="opacity-40">/</span>
                        <span className="hover:text-text-primary-dark cursor-pointer transition-colors">PRODUCTS</span>
                        <span className="opacity-40">/</span>
                        <span className="text-primary font-bold uppercase">{activeProject?.name.split(' ')[1] || 'UNKNOWN'}</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-6 w-6 text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/5 transition-colors"
                        >
                            <Icon name="refresh" className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                            variant="outline"
                            size="sm"
                            className="bg-white/5 hover:bg-white/10 border-border-dark text-text-primary-dark px-2 h-6 rounded text-[9px] font-bold tracking-wide transition-colors"
                        >
                            <Icon name="upload" className="h-3.5 w-3.5 mr-1.5" />
                            UPLOAD
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-hidden flex flex-col p-0 bg-background-dark/50">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <Table>
                            <TableHeader className="sticky top-0 bg-surface-dark/90 backdrop-blur-sm z-10 shadow-sm">
                                <TableRow className="border-b border-border-dark hover:bg-transparent">
                                    <TableHead className="px-4 py-2 h-auto text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest w-[50%]">Name</TableHead>
                                    <TableHead className="px-4 py-2 h-auto text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest text-right">Size</TableHead>
                                    <TableHead className="px-4 py-2 h-auto text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest text-right">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="font-mono text-[11px]">
                                {MOCK_FILES.map((file) => (
                                    <FileRow key={file.id} file={file} />
                                ))}
                                {/* Empty State Fillers for aesthetics */}
                                {[...Array(5)].map((_, i) => (
                                    <TableRow key={`empty-${i}`} className="opacity-5 pointer-events-none hover:bg-transparent">
                                        <TableCell colSpan={3} className="px-4 py-1.5">
                                            <div className="h-4 border-b border-dashed border-border-dark/50"></div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>

                <CardFooter className="px-3 py-1.5 border-t border-border-dark flex justify-between items-center bg-surface-dark/30 shrink-0">
                    <div className="text-[9px] font-mono text-text-secondary-dark uppercase tracking-wider">
                        {MOCK_FILES.length} Items
                    </div>
                    <div className="flex items-center gap-2 opacity-60">
                        <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                            <Icon name="grid_view" className="h-3.5 w-3.5 text-text-secondary-dark hover:text-primary transition-colors" />
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};