import React from 'react';
import { Icon } from './Icon';
import { StatsData } from '../types';

interface StatsCardProps {
    data: StatsData;
}

export const StatsCard: React.FC<StatsCardProps> = ({ data }) => {
    return (
        <div className="bg-surface-dark border border-border-dark rounded p-4 flex flex-col justify-between h-24 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
            {/* Header */}
            <div className="flex justify-between items-start z-10">
                <div className="flex items-center gap-2 text-text-secondary-dark text-xs font-semibold uppercase tracking-wider font-display">
                    <Icon name={data.icon} className="text-sm" />
                    {data.label}
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-widest font-mono-numbers ${data.active ? 'text-primary opacity-80' : 'text-text-secondary-dark opacity-60'}`}>
                    {data.subLabel}
                </span>
            </div>

            {/* Content */}
            <div className="z-10 flex items-end justify-between">
                <div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-text-primary-dark font-mono-numbers tracking-tight">
                        {data.value}
                    </div>
                </div>
                <div className="text-[10px] text-text-secondary-dark mb-1 font-mono-numbers text-right leading-tight">
                    <span className={data.active ? 'text-primary' : ''}>{data.subValue}</span> {data.subValueLabel.split(' ').map((line, i) => (
                        <React.Fragment key={i}>
                            {i > 0 && <br />}
                            {line}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Background Icon Watermark */}
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <Icon name={data.icon} className="text-8xl" />
            </div>
        </div>
    );
};