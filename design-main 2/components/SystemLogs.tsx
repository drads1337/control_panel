import React from 'react';
import { Icon } from './Icon';

interface LogEntry {
    id: string;
    level: 'info' | 'warning' | 'error';
    action: string;
    user: string;
    ip: string;
    location: string;
    details: string;
    timestamp: string;
    timeAgo: string;
}

const logs: LogEntry[] = [
    { id: '1', level: 'info', action: 'create_folder', user: 'YMPHE66H64', ip: '127.0.0.1', location: 'Unknown', details: 'Created folder: configs in /', timestamp: 'Dec 20, 2025 18:01:37', timeAgo: 'about 5 hours ago' },
    { id: '2', level: 'info', action: 'create_folder', user: 'YMPHE66H64', ip: '127.0.0.1', location: 'Unknown', details: 'Created folder: configs in /', timestamp: 'Dec 20, 2025 18:01:37', timeAgo: 'about 5 hours ago' },
    { id: '3', level: 'info', action: 'create_folder', user: 'YMPHE66H64', ip: '127.0.0.1', location: 'Unknown', details: 'Created folder: configs in /', timestamp: 'Dec 20, 2025 17:51:04', timeAgo: 'about 5 hours ago' },
    { id: '4', level: 'info', action: 'create_folder', user: 'YMPHE66H64', ip: '127.0.0.1', location: 'Unknown', details: 'Created folder: configs in /', timestamp: 'Dec 20, 2025 17:51:04', timeAgo: 'about 5 hours ago' },
    { id: '5', level: 'info', action: 'create_folder', user: 'YMPHE66H64', ip: '127.0.0.1', location: 'Unknown', details: 'Created folder: configs in /', timestamp: 'Dec 20, 2025 17:45:25', timeAgo: 'about 6 hours ago' },
    { id: '6', level: 'info', action: 'create_folder', user: 'YMPHE66H64', ip: '127.0.0.1', location: 'Unknown', details: 'Created folder: configs in /', timestamp: 'Dec 20, 2025 17:45:25', timeAgo: 'about 6 hours ago' },
    { id: '7', level: 'info', action: 'create_folder', user: 'YMPHE66H64', ip: '127.0.0.1', location: 'Unknown', details: 'Created folder: configs in /', timestamp: 'Dec 20, 2025 17:45:21', timeAgo: 'about 6 hours ago' },
];

const StatCard: React.FC<{ icon: string; title: string; value: string; subtext: string; badge: string }> = ({ icon, title, value, subtext, badge }) => (
    <div className="bg-surface-dark border border-border-dark rounded-sm p-4 relative group hover:border-text-secondary-dark/30 transition-all">
        <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2 text-text-secondary-dark text-[10px] uppercase font-bold tracking-widest">
                <Icon name={icon} className="text-sm" />
                {title}
            </div>
            <span className="text-[9px] bg-background-dark border border-border-dark px-1.5 py-0.5 rounded text-text-secondary-dark font-mono">{badge}</span>
        </div>
        <div className="text-2xl font-bold text-text-primary-dark font-mono-numbers mb-1">{value}</div>
        <div className="text-[10px] text-text-secondary-dark opacity-60">{subtext}</div>
    </div>
);

export const SystemLogs: React.FC = () => {
    return (
        <div className="flex flex-col h-full space-y-4">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon="description" title="Total Records" value="428" subtext="428 total events" badge="All time" />
                <StatCard icon="today" title="Today" value="24" subtext="Events recorded today" badge="Today" />
                <StatCard icon="date_range" title="This Week" value="46" subtext="11% of total" badge="Last 7 days" />
                <StatCard icon="calendar_month" title="This Month" value="428" subtext="100% of total" badge="Last 30 days" />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 bg-surface-dark border border-border-dark rounded-sm p-2">
                <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Icon name="search" className="text-text-secondary-dark text-sm" />
                    </span>
                    <input 
                        className="w-full bg-background-dark border border-border-dark rounded-sm pl-8 pr-3 py-1.5 text-[11px] text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark/50 transition-all outline-none font-mono" 
                        placeholder="Search logs..." 
                        type="text" 
                    />
                </div>
                <div className="flex gap-2">
                     <button className="flex items-center gap-1.5 px-3 py-1.5 bg-background-dark border border-border-dark rounded-sm text-[10px] font-bold text-text-secondary-dark hover:text-text-primary-dark hover:border-text-secondary-dark/50 transition-all uppercase tracking-wider">
                        <Icon name="filter_list" className="text-sm" />
                        Filter
                    </button>
                    <button className="p-1.5 bg-background-dark border border-border-dark rounded-sm text-text-secondary-dark hover:text-text-primary-dark hover:border-text-secondary-dark/50 transition-all">
                        <Icon name="refresh" className="text-sm" />
                    </button>
                    <button className="p-1.5 bg-background-dark border border-border-dark rounded-sm text-text-secondary-dark hover:text-text-primary-dark hover:border-text-secondary-dark/50 transition-all">
                        <Icon name="download" className="text-sm" />
                    </button>
                </div>
            </div>

            {/* Logs Table */}
            <div className="flex-1 bg-surface-dark border border-border-dark rounded-sm overflow-hidden flex flex-col">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-border-dark bg-background-dark/50 text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest">
                    <div className="col-span-1">Level</div>
                    <div className="col-span-2">Time</div>
                    <div className="col-span-2">Action</div>
                    <div className="col-span-2">User</div>
                    <div className="col-span-1">IP</div>
                    <div className="col-span-1">Location</div>
                    <div className="col-span-3">Details</div>
                </div>

                {/* Table Body */}
                <div className="overflow-y-auto flex-1">
                    {logs.map((log) => (
                        <div key={log.id} className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-border-dark/50 items-center hover:bg-white/5 transition-colors group">
                            <div className="col-span-1 flex items-center gap-2">
                                <Icon name="info" className="text-text-secondary-dark text-base opacity-50 group-hover:opacity-100" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-1.5 rounded-sm border border-blue-400/20 w-fit">Info</span>
                                    <span className="text-[9px] text-text-secondary-dark mt-0.5">Create Folder</span>
                                </div>
                            </div>
                            <div className="col-span-2 flex flex-col justify-center">
                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-primary-dark">
                                    <Icon name="schedule" className="text-xs text-text-secondary-dark" />
                                    {log.timeAgo}
                                </div>
                                <span className="text-[9px] font-mono text-text-secondary-dark opacity-60 pl-4">{log.timestamp}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-[10px] font-mono bg-background-dark border border-border-dark px-2 py-1 rounded text-text-secondary-dark group-hover:text-text-primary-dark transition-colors inline-block">
                                    {log.action}
                                </span>
                            </div>
                            <div className="col-span-2 flex items-center gap-2">
                                <Icon name="person" className="text-xs text-text-secondary-dark" />
                                <span className="text-[11px] font-bold text-text-primary-dark font-mono tracking-tight">{log.user}</span>
                            </div>
                            <div className="col-span-1 flex items-center gap-2">
                                <Icon name="language" className="text-xs text-text-secondary-dark" />
                                <span className="text-[11px] font-mono text-text-secondary-dark">{log.ip}</span>
                            </div>
                            <div className="col-span-1 flex items-center gap-2">
                                <Icon name="location_on" className="text-xs text-text-secondary-dark" />
                                <span className="text-[11px] text-text-secondary-dark">{log.location}</span>
                            </div>
                            <div className="col-span-3">
                                <span className="text-[11px] text-text-secondary-dark group-hover:text-text-primary-dark transition-colors">{log.details}</span>
                            </div>
                        </div>
                    ))}
                    {/* Empty state fillers for visuals */}
                    {[...Array(3)].map((_, i) => (
                        <div key={`filler-${i}`} className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-border-dark/30 opacity-20 pointer-events-none">
                            <div className="col-span-12 h-4 border-b border-dashed border-border-dark"></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};