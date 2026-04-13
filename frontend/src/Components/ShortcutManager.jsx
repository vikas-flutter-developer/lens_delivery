import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAllShortcuts } from '../controllers/Shortcut.controller';
import { toast } from 'react-hot-toast';

const ShortcutManager = () => {
    const [shortcuts, setShortcuts] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();

    const fetchShortcuts = async () => {
        try {
            const data = await getAllShortcuts();
            // Crucial: Only keep enabled shortcuts for the manager
            setShortcuts(data.filter(s => s.status === 'Enabled'));
        } catch (error) {
            console.error("Failed to load shortcuts:", error);
        }
    };

    useEffect(() => {
        fetchShortcuts();
        
        // Listen for internal updates from the ShortcutKeys page
        window.addEventListener('shortcut-updated', fetchShortcuts);
        
        // Refresh on navigation in case other pages changed something
        if (location.pathname === '/utilities/shortcutkeys') {
            fetchShortcuts();
        }

        return () => window.removeEventListener('shortcut-updated', fetchShortcuts);
    }, [location.pathname]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger shortcuts if user is typing in common input fields
            const activeTag = document.activeElement.tagName;
            const isInput = ['INPUT', 'TEXTAREA'].includes(activeTag) || document.activeElement.isContentEditable;
            
            // Allow shortcuts even in inputs if Ctrl or Alt is pressed (usually safe)
            if (isInput && !e.ctrlKey && !e.altKey) return;

            const pressedKeys = [];
            
            // Browsers/OS can handle modifiers differently when they result in special characters (like ś).
            // getModifierState is often more reliable than the boolean properties.
            const isCtrl = e.ctrlKey || e.getModifierState('Control');
            const isAlt = e.altKey || e.getModifierState('Alt') || e.getModifierState('AltGraph');
            const isShift = e.shiftKey || e.getModifierState('Shift');

            if (isCtrl) pressedKeys.push('Ctrl');
            if (isAlt) pressedKeys.push('Alt');
            if (isShift) pressedKeys.push('Shift');
            
            // Handle the main key using code for alphanumeric keys to avoid AltGraph character mapping issues
            let mainKey = '';
            if (e.code && e.code.startsWith('Key')) {
                mainKey = e.code.substring(3).toUpperCase();
            } else if (e.code && e.code.startsWith('Digit')) {
                mainKey = e.code.substring(5);
            } else {
                mainKey = e.key;
                if (mainKey === ' ') mainKey = 'Space';
                if (mainKey.length === 1) mainKey = mainKey.toUpperCase();
            }
            
            // Avoid modifiers themselves being treated as the main action key
            if (['Control', 'Alt', 'Shift', 'AltGraph', 'Meta'].includes(e.key)) return;

            const combo = [...pressedKeys, mainKey].join('+');
            // Log with extra detail to help diagnose if it still fails
            console.log("Shortcut Pressed:", combo, {
                rawKey: e.key,
                code: e.code,
                ctrl: isCtrl,
                alt: isAlt,
                shift: isShift
            });

            const match = shortcuts.find(s => {
                // Exact case-insensitive match for the combo
                return s.shortcutKey.toLowerCase() === combo.toLowerCase();
            });

            if (match) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log(`Navigating to: ${match.url} (${match.pageName})`);
                navigate(match.url);
                
                toast.success(`Navigating to ${match.pageName}`, {
                    id: 'shortcut-nav',
                    duration: 1500,
                    icon: '🚀',
                    style: {
                        borderRadius: '10px',
                        background: '#1e293b',
                        color: '#fff',
                    },
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown, true); // Use capture phase for reliability
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [shortcuts, navigate]);

    return null; // This component doesn't render anything
};

export default ShortcutManager;
