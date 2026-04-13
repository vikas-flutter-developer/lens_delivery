import React from 'react';
import { useSelector } from 'react-redux';
import { selectIsLoading } from '../Store/Slices/loadingSlice';

const LoadingButton = ({ 
    children, 
    onClick, 
    disabled, 
    loadingText = "Processing...", 
    className = "", 
    icon: Icon,
    ...props 
}) => {
    const isGlobalLoading = useSelector(selectIsLoading);
    const isLoading = isGlobalLoading && !props.silent; // Allow silent buttons if needed

    return (
        <button
            onClick={onClick}
            disabled={disabled || isLoading}
            className={`flex items-center justify-center gap-2 transition-all duration-200 ${className} ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
            {...props}
        >
            {isLoading ? (
                <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    <span>{loadingText || children}</span>
                </>
            ) : (
                <>
                    {Icon && <Icon size={18} />}
                    {children}
                </>
            )}
        </button>
    );
};

export default LoadingButton;
