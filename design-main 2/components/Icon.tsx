import React from 'react';

interface IconProps {
    name: string;
    className?: string;
    filled?: boolean;
}

export const Icon: React.FC<IconProps> = ({ name, className = "", filled = false }) => {
    return (
        <span 
            className={`material-symbols-outlined select-none ${className}`}
            style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
        >
            {name}
        </span>
    );
};