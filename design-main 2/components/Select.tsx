import React from 'react';
import { Icon } from './Icon';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    icon?: string;
    containerClassName?: string;
}

export const Select: React.FC<SelectProps> = ({ 
    icon = "expand_more", 
    className = "", 
    containerClassName = "",
    children,
    ...props 
}) => {
    return (
        <div className={`relative ${containerClassName}`}>
            <select 
                className={`
                    appearance-none outline-none cursor-pointer 
                    bg-background-dark border border-border-dark 
                    text-text-primary-dark placeholder-text-secondary-dark
                    focus:ring-1 focus:ring-primary focus:border-primary
                    hover:border-text-secondary-dark transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${className}
                `}
                {...props}
            >
                {children}
            </select>
            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-text-secondary-dark flex items-center justify-center">
                <Icon name={icon} className="text-xs" />
            </span>
        </div>
    );
};