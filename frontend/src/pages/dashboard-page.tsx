import React from 'react';
import {
  CreditCard,
  Users,
  Network,
  HeartPulse,
  Globe,
  Map,
  BarChart3,
  Cpu,
  HardDrive,
  Router,
  LucideIcon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/components/card';
import { Separator } from '@/shared/ui/components/separator';

// Simple bar chart component using CSS
const BarChart = () => (
    <div className="flex items-end justify-between h-32 gap-2 mt-4">
        {[40, 65, 45, 80, 55, 70, 40, 60, 50, 75, 55, 45, 65, 50].map((h, i) => (
            <div key={i} className="w-full bg-primary/10 rounded-sm relative group cursor-pointer">
                <div 
                    className="absolute bottom-0 w-full bg-primary rounded-sm transition-all duration-500 group-hover:bg-primary-hover group-hover:shadow-[0_0_10px_rgba(226,232,240,0.3)]"
                    style={{ height: `${h}%` }}
                ></div>
            </div>
        ))}
    </div>
);

const StatCard = ({ title, value, change, trend, Icon: IconComponent }: { title: string, value: string, change?: string, trend?: 'up' | 'down', Icon: LucideIcon }) => (
    <Card className="bg-surface-dark border-border-dark rounded p-4 flex flex-col justify-between h-24 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
        <div className="flex justify-between items-start z-10">
            <div className="flex items-center gap-2 text-text-secondary-dark text-xs font-semibold uppercase tracking-wider">
                <IconComponent className="h-3.5 w-3.5" />
                {title}
            </div>
            {change && (
                <span className={`text-[10px] uppercase font-bold tracking-widest font-mono-numbers opacity-80 ${trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {change}
                </span>
            )}
        </div>
        <div className="z-10 flex items-end justify-between">
            <div className="text-2xl font-bold text-gray-900 dark:text-text-primary-dark font-mono-numbers tracking-tight">{value}</div>
        </div>
        
        {/* Decorative BG Icon */}
        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <IconComponent className="h-32 w-32" />
        </div>
    </Card>
);

export const DashboardPage = () => {
    return (
        <div className="space-y-6">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                <StatCard title="Total Revenue" value="$42,091.00" change="+12.5%" trend="up" Icon={CreditCard} />
                <StatCard title="Active Sessions" value="1,204" change="+3.2%" trend="up" Icon={Users} />
                <StatCard title="Total Queries" value="840.2k" change="-0.8%" trend="down" Icon={Network} />
                <StatCard title="Server Health" value="98.2%" change="Optimal" trend="up" Icon={HeartPulse} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Map Section - Placeholder */}
                <Card className="lg:col-span-2 bg-surface-dark border-border-dark rounded p-5 flex flex-col h-[400px] relative shadow-sm">
                    <div className="px-4 py-3 border-b border-border-dark flex justify-between items-center bg-[#15181E]">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Globe className="text-primary" />
                            Live Request Origin
                        </h3>
                        <div className="flex gap-2 items-center">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[10px] font-mono text-emerald-500 font-bold tracking-wider">LIVE</span>
                        </div>
                    </div>
                    
                    {/* Map Placeholder Content */}
                    <div className="flex-1 bg-[#0F1115] relative overflow-hidden flex items-center justify-center group">
                        {/* Grid Background */}
                        <div className="absolute inset-0" style={{ 
                            backgroundImage: 'linear-gradient(#1f2937 1px, transparent 1px), linear-gradient(90deg, #1f2937 1px, transparent 1px)', 
                            backgroundSize: '40px 40px', 
                            opacity: 0.1 
                        }}></div>
                        
                        {/* Placeholder Map Shape/Message */}
                        <div className="text-center opacity-30 group-hover:opacity-50 transition-opacity">
                             <Map className="text-7xl text-text-secondary-dark mb-3 mx-auto" />
                             <p className="text-xs font-mono uppercase tracking-[0.2em] text-text-secondary-dark">Interactive Map Module</p>
                        </div>

                        {/* Animated Fake Map Dots */}
                        <div className="absolute top-1/3 left-1/4">
                             <span className="flex h-3 w-3 relative group-hover:scale-150 transition-transform duration-700">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75 duration-1000"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500/50 border border-blue-400"></span>
                            </span>
                        </div>
                         <div className="absolute top-1/2 left-1/2">
                             <span className="flex h-3 w-3 relative group-hover:scale-150 transition-transform duration-700 delay-100">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-500 opacity-75 duration-1500"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500/50 border border-purple-400"></span>
                            </span>
                        </div>
                         <div className="absolute bottom-1/3 right-1/3">
                             <span className="flex h-3 w-3 relative group-hover:scale-150 transition-transform duration-700 delay-200">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75 duration-1000"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500/50 border border-orange-400"></span>
                            </span>
                        </div>
                         <div className="absolute top-1/4 right-1/4">
                             <span className="flex h-2 w-2 relative group-hover:scale-150 transition-transform duration-700 delay-300">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 duration-2000"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/50 border border-primary"></span>
                            </span>
                        </div>
                    </div>
                </Card>

                {/* Traffic Stats */}
                <Card className="bg-surface-dark border-border-dark rounded p-5 flex flex-col h-[400px] relative overflow-hidden shadow-sm">
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <BarChart3 className="text-text-secondary-dark" />
                            Traffic Volume
                        </h3>
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-primary"></span>
                            <span className="text-[9px] font-mono text-text-secondary-dark">IN</span>
                            <span className="w-2 h-2 rounded-full bg-primary/20 ml-2"></span>
                            <span className="text-[9px] font-mono text-text-secondary-dark">OUT</span>
                        </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-end relative z-10">
                        <div className="flex justify-between items-end mb-2">
                             <div>
                                <div className="text-3xl font-bold text-white font-mono-numbers">2.4 MB/s</div>
                                <div className="text-[10px] text-text-secondary-dark uppercase tracking-wider mt-1 opacity-60">Avg Throughput</div>
                             </div>
                             <span className="text-emerald-400 text-[10px] font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 font-mono">PEAK: 5.1 MB/s</span>
                        </div>
                        <BarChart />
                        <div className="flex justify-between mt-4 pt-4 border-t border-border-dark text-[9px] text-text-secondary-dark font-mono uppercase tracking-widest opacity-60">
                            <span>00:00</span>
                            <span>12:00</span>
                            <span>23:59</span>
                        </div>
                    </div>
                </Card>
            </div>
            
            {/* Bottom Row - Resource Usage */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                 <Card className="bg-surface-dark border-border-dark rounded p-4 flex items-center justify-between group hover:border-primary/50 transition-colors duration-300">
                    <div className="flex-1">
                        <div className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-bold mb-1 opacity-70">CPU Usage</div>
                        <div className="flex items-baseline gap-2">
                            <div className="text-xl font-bold text-white font-mono-numbers">42%</div>
                            <span className="text-[10px] text-emerald-400 font-mono">Normal</span>
                        </div>
                        <div className="w-full h-1 bg-background-dark rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-blue-500 w-[42%] group-hover:bg-blue-400 transition-colors"></div>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded bg-background-dark flex items-center justify-center border border-border-dark ml-4">
                        <Cpu className="text-xl text-text-secondary-dark group-hover:text-blue-400 transition-colors" />
                    </div>
                 </Card>

                 <Card className="bg-surface-dark border-border-dark rounded p-4 flex items-center justify-between group hover:border-primary/50 transition-colors duration-300">
                    <div className="flex-1">
                        <div className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-bold mb-1 opacity-70">Memory</div>
                         <div className="flex items-baseline gap-2">
                            <div className="text-xl font-bold text-white font-mono-numbers">2.1 GB</div>
                            <span className="text-[10px] text-emerald-400 font-mono">Stable</span>
                        </div>
                        <div className="w-full h-1 bg-background-dark rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-purple-500 w-[60%] group-hover:bg-purple-400 transition-colors"></div>
                        </div>
                    </div>
                     <div className="w-10 h-10 rounded bg-background-dark flex items-center justify-center border border-border-dark ml-4">
                        <HardDrive className="text-xl text-text-secondary-dark group-hover:text-purple-400 transition-colors" />
                    </div>
                 </Card>

                 <Card className="bg-surface-dark border-border-dark rounded p-4 flex items-center justify-between group hover:border-primary/50 transition-colors duration-300">
                    <div className="flex-1">
                        <div className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-bold mb-1 opacity-70">Latency</div>
                         <div className="flex items-baseline gap-2">
                            <div className="text-xl font-bold text-white font-mono-numbers">14 ms</div>
                            <span className="text-[10px] text-emerald-400 font-mono">Excellent</span>
                        </div>
                        <div className="w-full h-1 bg-background-dark rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-emerald-500 w-[90%] group-hover:bg-emerald-400 transition-colors"></div>
                        </div>
                    </div>
                     <div className="w-10 h-10 rounded bg-background-dark flex items-center justify-center border border-border-dark ml-4">
                        <Router className="text-xl text-text-secondary-dark group-hover:text-emerald-400 transition-colors" />
                    </div>
                 </Card>
            </div>

            <div className="relative flex justify-between items-center pt-6 pb-2 text-[10px] text-text-secondary-dark mt-8 uppercase tracking-widest opacity-60">
                <Separator className="absolute top-0 left-0 right-0 border-border-dark" />
                <p>© 2025 SAAS MGR</p>
                <p className="font-mono-numbers">V.1.0.0-BETA</p>
            </div>
        </div>
    );
};