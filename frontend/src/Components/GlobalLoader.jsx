import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectIsLoading } from '../Store/Slices/loadingSlice';

/**
 * GlobalLoader: Now only manages the 'is-api-loading' class on document.body.
 * The full-screen UI and backdrop-blur have been removed as per requirement.
 * This class is used in App.css to show button-level loading spinners.
 */
const GlobalLoader = () => {
    const isLoading = useSelector(selectIsLoading);

    useEffect(() => {
        if (isLoading) {
            // Apply class immediately for button-level feedback
            document.body.classList.add('is-api-loading');
        } else {
            document.body.classList.remove('is-api-loading');
        }
        
        // Cleanup on unmount
        return () => {
            document.body.classList.remove('is-api-loading');
        };
    }, [isLoading]);

    // Return nothing to disable full-screen UI, backdrops and blurs
    return null;
};

export default GlobalLoader;
