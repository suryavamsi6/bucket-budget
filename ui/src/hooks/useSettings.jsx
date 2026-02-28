import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSettings, updateSettings as apiUpdateSettings } from '../api/client.js';

const CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
    { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
    { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
    { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
    { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH' },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
    { code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
    { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', locale: 'es-MX' },
    { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE' },
    { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', locale: 'nb-NO' },
    { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ' },
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
    { code: 'TRY', symbol: '₺', name: 'Turkish Lira', locale: 'tr-TR' },
    { code: 'PLN', symbol: 'zł', name: 'Polish Złoty', locale: 'pl-PL' },
    { code: 'THB', symbol: '฿', name: 'Thai Baht', locale: 'th-TH' },
];

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
    const defaults = {
        currency: 'USD',
        locale: 'en-US',
        theme: 'dark',
        currency_symbol: '$'
    };

    const [settings, setSettings] = useState(defaults);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        getSettings()
            .then(s => { setSettings(prev => ({ ...defaults, ...prev, ...s })); setLoaded(true); })
            .catch(() => setLoaded(true));
    }, []);

    const updateSettings = useCallback(async (updates) => {
        const newSettings = await apiUpdateSettings(updates);
        setSettings(newSettings);

        // Apply theme
        if (updates.theme) {
            document.documentElement.setAttribute('data-theme', updates.theme);
        }
        return newSettings;
    }, []);

    const fmt = useCallback((n) => {
        const num = parseFloat(n) || 0;
        try {
            return new Intl.NumberFormat(settings.locale, {
                style: 'currency',
                currency: settings.currency
            }).format(num);
        } catch {
            return `${settings.currency_symbol}${num.toFixed(2)}`;
        }
    }, [settings.currency, settings.locale, settings.currency_symbol]);

    const fmtCompact = useCallback((n) => {
        const num = parseFloat(n) || 0;
        try {
            return new Intl.NumberFormat(settings.locale, {
                style: 'currency',
                currency: settings.currency,
                maximumFractionDigits: 0
            }).format(num);
        } catch {
            return `${settings.currency_symbol}${Math.round(num)}`;
        }
    }, [settings.currency, settings.locale, settings.currency_symbol]);

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, fmt, fmtCompact, loaded, CURRENCIES }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
    return ctx;
}

export { CURRENCIES };
