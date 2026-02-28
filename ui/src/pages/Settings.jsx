import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, DollarSign, Palette, Download, Database, Clock } from 'lucide-react';
import { useSettings, CURRENCIES } from '../hooks/useSettings.jsx';
import { getAgeOfMoney, getExportTransactionsUrl } from '../api/client.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function Settings() {
    const { settings, updateSettings, fmt } = useSettings();
    const [ageOfMoney, setAgeOfMoney] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        getAgeOfMoney().then(setAgeOfMoney).catch(() => { });
    }, []);

    const handleCurrencyChange = async (code) => {
        const cur = CURRENCIES.find(c => c.code === code);
        if (!cur) return;
        setSaving(true);
        await updateSettings({
            currency: cur.code,
            locale: cur.locale,
            currency_symbol: cur.symbol
        });
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleThemeChange = async (theme) => {
        setSaving(true);
        await updateSettings({ theme });
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="max-w-4xl space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-secondary rounded-2xl text-card-foreground">
                    <SettingsIcon className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Settings</h2>
                    <p className="text-muted-foreground">Manage your preferences and data.</p>
                </div>
            </div>

            {saved && (
                <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2">
                        <span className="text-sm font-medium">✓ Settings saved!</span>
                    </div>
                </div>
            )}

            {/* Age of Money Card */}
            <Card className="bg-gradient-to-br from-indigo-900/40 to-violet-900/40 border-indigo-500/30 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-secondary rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                <CardContent className="p-6 relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/50">
                            <Clock className="w-8 h-8 text-card-foreground" />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-1">Age of Money</div>
                            <div className="text-4xl font-bold text-card-foreground mb-1 tracking-tight">
                                {ageOfMoney ? `${ageOfMoney.age}  days` : '—'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                                How long your money sits before being spent. Higher is better!
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Currency Selection */}
                <Card className="bg-card border-border shadow-sm col-span-1 md:col-span-2">
                    <CardHeader className="pb-4 border-b border-border">
                        <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-card-foreground" /> Currency
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="space-y-3 max-w-md">
                            <label className="text-sm font-medium text-muted-foreground">Display Currency</label>
                            <Select
                                value={settings.currency}
                                onValueChange={handleCurrencyChange}
                                disabled={saving}
                            >
                                <SelectTrigger className="w-full bg-background border-border text-foreground/80">
                                    <SelectValue placeholder="Select a currency" />
                                </SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground/80">
                                    {CURRENCIES.map(c => (
                                        <SelectItem key={c.code} value={c.code} className="hover:bg-secondary focus:bg-muted focus:text-foreground">
                                            {c.symbol} — {c.name} ({c.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="bg-muted/50 rounded-3xl p-4 border border-border">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Preview:</span>
                                <span className="font-semibold text-foreground/80 bg-muted/50 px-2 py-1 rounded">{fmt(1234.56)}</span>
                                <span className="text-muted-foreground">|</span>
                                <span className="font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded">{fmt(9999.00)}</span>
                                <span className="text-muted-foreground">|</span>
                                <span className="font-semibold text-rose-600 bg-rose-500/10 px-2 py-1 rounded">{fmt(-450.30)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Theme */}
                <Card className="bg-card border-border shadow-sm col-span-1 md:col-span-2">
                    <CardHeader className="pb-4 border-b border-border">
                        <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                            <Palette className="h-5 w-5 text-card-foreground" /> Appearance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { value: 'dark', label: 'Dark', bg: '#0f172a', fg: '#f8fafc', border: '#1e293b' },
                                { value: 'midnight', label: 'Midnight Blue', bg: '#020617', fg: '#e2e8f0', border: '#0f172a' },
                                { value: 'amoled', label: 'AMOLED Black', bg: '#000000', fg: '#ffffff', border: '#18181b' }
                            ].map(theme => (
                                <button
                                    key={theme.value}
                                    className={`relative group flex flex-col items-center p-4 rounded-3xl transition-all duration-200 ${settings.theme === theme.value
                                        ? 'ring-2 ring-indigo-500 bg-muted/50'
                                        : 'ring-1 ring-border hover:ring-muted-foreground/50 hover:bg-muted/30'
                                        }`}
                                    onClick={() => handleThemeChange(theme.value)}
                                    disabled={saving}
                                >
                                    <div
                                        className="w-full h-24 rounded-2xl mb-3 shadow-inner overflow-hidden border"
                                        style={{ backgroundColor: theme.bg, borderColor: theme.border }}
                                    >
                                        {/* Mock UI elements for theme preview */}
                                        <div className="w-full h-6 border-b opacity-20" style={{ borderColor: theme.fg }} />
                                        <div className="p-2 space-y-2">
                                            <div className="w-1/2 h-2 rounded-full opacity-40" style={{ backgroundColor: theme.fg }} />
                                            <div className="flex gap-2">
                                                <div className="w-4 h-4 rounded-sm bg-indigo-500" />
                                                <div className="w-4 h-4 rounded-sm bg-emerald-500" />
                                                <div className="w-4 h-4 rounded-sm bg-rose-500" />
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{theme.label}</span>
                                    {settings.theme === theme.value && (
                                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Data Management */}
                <Card className="bg-card border-border shadow-sm col-span-1 md:col-span-2">
                    <CardHeader className="pb-4 border-b border-border">
                        <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                            <Database className="h-5 w-5 text-card-foreground" /> Data Management
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="flex flex-wrap gap-4">
                            <Button asChild variant="outline" className="bg-background border-border text-muted-foreground hover:bg-secondary hover:text-foreground">
                                <a href={getExportTransactionsUrl()} download>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export All Transactions (CSV)
                                </a>
                            </Button>
                        </div>

                        <div className="bg-secondary border border-indigo-500/20 rounded-3xl p-4 flex gap-3">
                            <div className="text-card-foreground mt-0.5">💡</div>
                            <div className="text-sm text-muted-foreground leading-relaxed">
                                <span className="font-medium text-foreground/80">Tip:</span> Your SQLite database is stored at <code className="bg-black/30 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-xs">/app/data/budget.db</code> in the Docker container.
                                Mount this as a volume for persistence. Back up this file for full data backup.
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
