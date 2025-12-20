import React from 'react';
import { DurationPreset } from '../types';

interface DurationSelectorProps {
    selected: DurationPreset;
    onSelect: (value: DurationPreset) => void;
}

export const DurationSelector: React.FC<DurationSelectorProps> = ({ selected, onSelect }) => {
    const options = Object.values(DurationPreset);

    return (
        <div className="grid grid-cols-6 gap-1.5 text-[10px] font-mono-numbers">
            {options.map((option) => (
                <button
                    key={option}
                    onClick={() => onSelect(option)}
                    className={`
                        py-1.5 rounded transition-all duration-200 border
                        ${selected === option 
                            ? 'bg-primary text-background-dark font-bold border-primary' 
                            : 'bg-background-dark border-border-dark hover:border-primary text-text-secondary-dark'}
                    `}
                >
                    {option}
                </button>
            ))}
        </div>
    );
};