import React, { useState } from 'react';
import { Icon } from './Icon';
import { DurationSelector } from './DurationSelector';
import { Select } from './Select';
import { DurationPreset, TargetType } from '../types';

export const CreateKeyForm: React.FC = () => {
    const [target, setTarget] = useState<TargetType>(TargetType.Product);
    const [duration, setDuration] = useState<DurationPreset>(DurationPreset.M1);
    const [maxDevices, setMaxDevices] = useState<number>(1);
    const [customHours, setCustomHours] = useState<string>('');

    return (
        <div className="bg-surface-dark border border-border-dark rounded p-5 relative shadow-sm h-full">
            <div className="mb-5 border-b border-border-dark pb-3 flex justify-between items-start">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-text-primary-dark uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                        Create License Key
                    </h3>
                    <p className="text-xs text-text-secondary-dark mt-1">Generate new access credentials.</p>
                </div>
                <Icon name="add_circle" className="text-border-dark" />
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    {/* Target Selector */}
                    <div>
                        <label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Target</label>
                        <div className="grid grid-cols-2 bg-background-dark p-0.5 rounded border border-border-dark">
                            <button 
                                onClick={() => setTarget(TargetType.Product)}
                                className={`flex items-center justify-center gap-1.5 py-1 text-xs font-semibold rounded-sm transition-all ${target === TargetType.Product ? 'bg-primary text-background-dark shadow-sm' : 'text-text-secondary-dark hover:text-text-primary-dark'}`}
                            >
                                <Icon name="inventory_2" className="text-sm" />
                                Product
                            </button>
                            <button 
                                onClick={() => setTarget(TargetType.Agent)}
                                className={`flex items-center justify-center gap-1.5 py-1 text-xs font-semibold rounded-sm transition-all ${target === TargetType.Agent ? 'bg-primary text-background-dark shadow-sm' : 'text-text-secondary-dark hover:text-text-primary-dark'}`}
                            >
                                <Icon name="bolt" className="text-sm" />
                                Agent
                            </button>
                        </div>
                    </div>

                    {/* Product Select */}
                    <div>
                        <label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Product Select</label>
                        <Select className="w-full rounded px-3 py-1.5 text-xs h-[30px]">
                            <option>Select a product</option>
                            <option>Product A</option>
                            <option>Product B</option>
                        </Select>
                    </div>
                </div>

                {/* Duration Preset */}
                <div>
                    <label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Duration Preset</label>
                    <DurationSelector selected={duration} onSelect={setDuration} />
                </div>

                {/* Custom Inputs */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Custom Hours</label>
                        <input 
                            value={customHours}
                            onChange={(e) => setCustomHours(e.target.value)}
                            className="w-full bg-background-dark border border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark font-mono-numbers h-[32px] outline-none transition-all" 
                            placeholder="e.g., 48" 
                            type="text"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Max Devices</label>
                        <input 
                            value={maxDevices}
                            onChange={(e) => setMaxDevices(parseInt(e.target.value) || 0)}
                            className="w-full bg-background-dark border border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary font-mono-numbers h-[32px] outline-none transition-all" 
                            type="number" 
                        />
                    </div>
                </div>
            </div>

            <div className="mt-6 flex justify-end pt-4 border-t border-border-dark">
                <button className="bg-primary hover:bg-primary-hover text-background-dark px-5 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all shadow-glow hover:shadow-lg">
                    <Icon name="bolt" className="text-sm" filled />
                    EXECUTE: GENERATE KEY
                </button>
            </div>
        </div>
    );
};


export const CreateCustomKeyForm: React.FC = () => {
    const [target, setTarget] = useState<TargetType>(TargetType.Product);
    const [duration, setDuration] = useState<DurationPreset>(DurationPreset.M1);
    
    return (
        <div className="bg-surface-dark border border-border-dark rounded p-5 relative shadow-sm h-full opacity-90">
             <div className="mb-5 border-b border-border-dark pb-3 flex justify-between items-start">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-text-primary-dark uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-inactive-dark"></span>
                        Create Custom Key
                    </h3>
                    <p className="text-xs text-text-secondary-dark mt-1">Specific naming conventions.</p>
                </div>
                <Icon name="edit_note" className="text-border-dark" />
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Target</label>
                        <div className="grid grid-cols-2 bg-background-dark p-0.5 rounded border border-border-dark">
                            <button 
                                onClick={() => setTarget(TargetType.Product)}
                                className={`flex items-center justify-center gap-1.5 py-1 text-xs font-semibold rounded-sm transition-all ${target === TargetType.Product ? 'bg-primary text-background-dark shadow-sm' : 'text-text-secondary-dark hover:text-text-primary-dark'}`}
                            >
                                <Icon name="inventory_2" className="text-sm" />
                                Product
                            </button>
                            <button 
                                onClick={() => setTarget(TargetType.Agent)}
                                className={`flex items-center justify-center gap-1.5 py-1 text-xs font-semibold rounded-sm transition-all ${target === TargetType.Agent ? 'bg-primary text-background-dark shadow-sm' : 'text-text-secondary-dark hover:text-text-primary-dark'}`}
                            >
                                <Icon name="bolt" className="text-sm" />
                                Agent
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Key Name</label>
                        <input 
                            className="w-full bg-background-dark border border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark h-[30px] outline-none font-mono" 
                            placeholder="KEY_NAME_001" 
                            type="text"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Duration Preset</label>
                    <DurationSelector selected={duration} onSelect={setDuration} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Custom Hours</label>
                        <input 
                            className="w-full bg-background-dark border border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark font-mono-numbers h-[32px] outline-none" 
                            placeholder="e.g., 48" 
                            type="text"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold uppercase text-text-secondary-dark mb-1.5 tracking-wider">Max Devices</label>
                        <input 
                            className="w-full bg-background-dark border border-border-dark rounded px-3 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary font-mono-numbers h-[32px] outline-none" 
                            type="number" 
                            defaultValue={1}
                        />
                    </div>
                </div>
            </div>

            {/* Inactive button state as per design */}
            <div className="mt-6 flex justify-end pt-4 border-t border-border-dark opacity-50 cursor-not-allowed grayscale">
                <button disabled className="bg-primary text-background-dark px-5 py-1.5 rounded text-xs font-bold flex items-center gap-2">
                    <Icon name="add" className="text-sm" />
                    EXECUTE: CUSTOM KEY
                </button>
            </div>
        </div>
    );
};