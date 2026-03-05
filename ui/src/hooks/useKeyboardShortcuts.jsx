import { useEffect, useCallback, useRef } from 'react';

/**
 * Global keyboard shortcuts for YNAB-style navigation and actions.
 * 
 * Usage:
 *   useKeyboardShortcuts({
 *     'ctrl+n': () => openQuickEntry(),
 *     'ctrl+shift+t': () => navigate('/transactions'),
 *   });
 *
 * Modifier keys: ctrl, shift, alt, meta
 * Special keys: escape, enter, tab, space, up, down, left, right, delete, backspace
 */
export function useKeyboardShortcuts(shortcuts, deps = []) {
    const shortcutsRef = useRef(shortcuts);
    shortcutsRef.current = shortcuts;

    useEffect(() => {
        const handler = (e) => {
            // Don't fire shortcuts when typing in inputs
            const tag = e.target.tagName.toLowerCase();
            const isEditable = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

            const parts = [];
            if (e.ctrlKey || e.metaKey) parts.push('ctrl');
            if (e.shiftKey) parts.push('shift');
            if (e.altKey) parts.push('alt');

            const key = e.key.toLowerCase();
            // Normalize some key names
            const keyName = {
                ' ': 'space',
                'arrowup': 'up',
                'arrowdown': 'down',
                'arrowleft': 'left',
                'arrowright': 'right',
            }[key] || key;

            // Don't add modifier keys themselves
            if (!['control', 'shift', 'alt', 'meta'].includes(keyName)) {
                parts.push(keyName);
            }

            const combo = parts.join('+');

            // Check all registered shortcuts
            for (const [shortcut, callback] of Object.entries(shortcutsRef.current)) {
                const normalizedShortcut = shortcut.toLowerCase().split('+').sort().join('+');
                const normalizedCombo = parts.sort().join('+');

                if (normalizedShortcut === normalizedCombo) {
                    // Allow Escape even in inputs; block others in editables
                    if (isEditable && keyName !== 'escape') continue;

                    e.preventDefault();
                    e.stopPropagation();
                    callback(e);
                    return;
                }
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, deps);
}

/**
 * Shortcut definitions with human-readable labels (for a help dialog)
 */
export const SHORTCUT_MAP = {
    'ctrl+n': { label: 'Quick Add Transaction', section: 'Actions' },
    'ctrl+shift+t': { label: 'Go to Transactions', section: 'Navigation' },
    'ctrl+shift+b': { label: 'Go to Budget', section: 'Navigation' },
    'ctrl+shift+a': { label: 'Go to Accounts', section: 'Navigation' },
    'ctrl+shift+r': { label: 'Go to Reports', section: 'Navigation' },
    'ctrl+shift+s': { label: 'Go to Settings', section: 'Navigation' },
    'escape': { label: 'Close Dialog / Cancel', section: 'General' },
    'ctrl+/': { label: 'Show Keyboard Shortcuts', section: 'General' },
    'ctrl+shift+d': { label: 'Go to Dashboard', section: 'Navigation' },
};

export default useKeyboardShortcuts;
