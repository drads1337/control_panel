import React from 'react';
import { Key, Package, Folder, Zap } from 'lucide-react';

const StatsOverview = () => {
  return (
    <div>
      <div className="flex justify-end mb-2">
         <span className="text-[10px] font-mono text-zinc-600 border border-zinc-800 rounded px-2 py-0.5 bg-surface uppercase">Updated: Just Now</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="LICENSE KEYS" 
          value="208" 
          subValue="287 ACTIVE KEYS" 
          status="ACTIVE" 
          icon={<Key className="w-12 h-12 opacity-5" />}
          cornerLabel="ACTIVE"
        />
        <StatCard 
          title="PRODUCTS" 
          value="2" 
          subValue="GLOBAL ITEMS" 
          status="DB" 
          icon={<Package className="w-12 h-12 opacity-5" />}
          cornerLabel="DB"
        />
        <StatCard 
          title="FILES" 
          value="0" 
          subValue="SYSTEM FILES" 
          status="SYS" 
          icon={<Folder className="w-12 h-12 opacity-5" />}
          cornerLabel="SYS"
        />
        <StatCard 
          title="AGENTS" 
          value="0" 
          subValue="ONLINE NODES" 
          status="NET" 
          icon={<Zap className="w-12 h-12 opacity-5" />}
          cornerLabel="NET"
        />
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  subValue: string;
  status: string;
  icon: React.ReactNode;
  cornerLabel: string;
}

const StatCard = ({ title, value, subValue, status, icon, cornerLabel }: StatCardProps) => {
  return (
    <div className="bg-surface border border-border rounded-lg p-5 relative overflow-hidden group hover:border-zinc-700 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
            {title === "LICENSE KEYS" && <Key size={14} className="text-zinc-500" />}
            {title === "PRODUCTS" && <Package size={14} className="text-zinc-500" />}
            {title === "FILES" && <Folder size={14} className="text-zinc-500" />}
            {title === "AGENTS" && <Zap size={14} className="text-zinc-500" />}
            <h3 className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">{title}</h3>
        </div>
        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{cornerLabel}</span>
      </div>
      
      <div className="mt-2 flex items-baseline justify-between relative z-10">
        <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
        <div className="text-right">
             <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">{subValue.split(' ')[0]}</div>
             <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{subValue.split(' ').slice(1).join(' ')}</div>
        </div>
      </div>

      {/* Background Icon Watermark */}
      <div className="absolute right-[-10px] bottom-[-10px] transform rotate-[-15deg] pointer-events-none">
        {icon}
      </div>
    </div>
  );
};

export default StatsOverview;