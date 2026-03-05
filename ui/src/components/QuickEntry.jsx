import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Wand2, ArrowRightLeft } from 'lucide-react';
import { Button } from './ui/button';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from './ui/dialog';
import {
    getAccounts, getCategoryGroups, createTransaction,
    suggestCategory, getPayeeSuggestions
} from '../api/client';
import { useSettings } from '../hooks/useSettings';
import { cn } from '../lib/utils';

export default function QuickEntry({ open, onOpenChange }) {
    const { formatMoney } = useSettings();
    const [accounts, setAccounts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        payee: '',
        memo: '',
        amount: '',
        account_id: '',
        category_id: '',
        type: 'expense',
        transfer_account_id: '',
        cleared: false
    });
    const [suggestions, setSuggestions] = useState([]);
    const [payeeSuggestions, setPayeeSuggestions] = useState([]);
    const [showPayeeSuggestions, setShowPayeeSuggestions] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const payeeRef = useRef(null);
    const amountRef = useRef(null);

    useEffect(() => {
        if (open) {
            Promise.all([getAccounts(), getCategoryGroups()]).then(([accs, grps]) => {
                setAccounts(accs);
                setGroups(grps);
                if (accs.length > 0 && !form.account_id) {
                    setForm(f => ({ ...f, account_id: accs[0].id }));
                }
            });
            // Reset
            setForm(f => ({
                ...f,
                payee: '', memo: '', amount: '', category_id: '',
                type: 'expense', transfer_account_id: '', cleared: false,
                date: new Date().toISOString().split('T')[0]
            }));
            setSuggestions([]);
            setSaved(false);
            setTimeout(() => payeeRef.current?.focus(), 100);
        }
    }, [open]);

    // Payee autocomplete
    const handlePayeeChange = useCallback(async (value) => {
        setForm(f => ({ ...f, payee: value }));
        if (value.length >= 2) {
            try {
                const results = await getPayeeSuggestions(value);
                setPayeeSuggestions(results);
                setShowPayeeSuggestions(results.length > 0);
            } catch { setPayeeSuggestions([]); }
        } else {
            setShowPayeeSuggestions(false);
        }
    }, []);

    // Category suggestions when payee is filled
    const handlePayeeBlur = useCallback(async () => {
        setTimeout(() => setShowPayeeSuggestions(false), 200);
        if (form.payee.length >= 2 && !form.category_id) {
            try {
                const result = await suggestCategory({
                    payee: form.payee,
                    amount: form.amount || '0',
                    date: form.date
                });
                if (result.suggestions?.length > 0) {
                    setSuggestions(result.suggestions);
                    // Auto-select top suggestion if confidence > 0.7
                    if (result.suggestions[0].confidence > 0.7) {
                        setForm(f => ({ ...f, category_id: result.suggestions[0].category_id }));
                    }
                }
            } catch { /* ignore */ }
        }
    }, [form.payee, form.amount, form.date, form.category_id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.account_id || !form.amount) return;

        setSaving(true);
        try {
            const amount = form.type === 'expense'
                ? -Math.abs(parseFloat(form.amount))
                : Math.abs(parseFloat(form.amount));

            await createTransaction({
                date: form.date,
                payee: form.payee,
                memo: form.memo,
                amount,
                account_id: parseInt(form.account_id),
                category_id: form.category_id ? parseInt(form.category_id) : null,
                transfer_account_id: form.type === 'transfer' && form.transfer_account_id
                    ? parseInt(form.transfer_account_id)
                    : null,
                cleared: form.cleared
            });

            setSaved(true);
            setTimeout(() => {
                onOpenChange(false);
                setSaved(false);
            }, 600);
        } catch (err) {
            console.error('Quick entry failed:', err);
        } finally {
            setSaving(false);
        }
    };

    const allCategories = groups.flatMap(g =>
        (g.categories || []).map(c => ({ ...c, groupName: g.name }))
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Quick Add Transaction
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-3">
                    {/* Type toggle */}
                    <div className="flex gap-1 p-1 bg-muted rounded-xl">
                        {['expense', 'income', 'transfer'].map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, type: t }))}
                                className={cn(
                                    'flex-1 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors',
                                    form.type === t
                                        ? 'bg-background shadow text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Date + Amount row */}
                    <div className="flex gap-2">
                        <input
                            type="date"
                            value={form.date}
                            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                            className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm"
                        />
                        <input
                            ref={amountRef}
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={form.amount}
                            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                            className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm text-right font-mono"
                            required
                        />
                    </div>

                    {/* Payee with autocomplete */}
                    <div className="relative">
                        <input
                            ref={payeeRef}
                            type="text"
                            placeholder="Payee"
                            value={form.payee}
                            onChange={e => handlePayeeChange(e.target.value)}
                            onBlur={handlePayeeBlur}
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                            autoComplete="off"
                        />
                        {showPayeeSuggestions && (
                            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-xl shadow-lg max-h-32 overflow-y-auto">
                                {payeeSuggestions.map((p, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent"
                                        onMouseDown={() => {
                                            setForm(f => ({ ...f, payee: p.payee || p }));
                                            setShowPayeeSuggestions(false);
                                        }}
                                    >
                                        {p.payee || p}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Category suggestions */}
                    {suggestions.length > 0 && !form.category_id && (
                        <div className="flex gap-1 flex-wrap">
                            <Wand2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                            {suggestions.slice(0, 3).map((s, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, category_id: s.category_id }))}
                                    className="text-xs px-2 py-0.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                >
                                    {s.category_name} ({Math.round(s.confidence * 100)}%)
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Account */}
                    <select
                        value={form.account_id}
                        onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        required
                    >
                        <option value="">Select Account</option>
                        {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>

                    {/* Category or Transfer account */}
                    {form.type === 'transfer' ? (
                        <select
                            value={form.transfer_account_id}
                            onChange={e => setForm(f => ({ ...f, transfer_account_id: e.target.value }))}
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        >
                            <option value="">Transfer to...</option>
                            {accounts.filter(a => String(a.id) !== String(form.account_id)).map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    ) : (
                        <select
                            value={form.category_id}
                            onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                        >
                            <option value="">No Category</option>
                            {groups.map(g => (
                                <optgroup key={g.id} label={g.name}>
                                    {(g.categories || []).map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    )}

                    {/* Memo */}
                    <input
                        type="text"
                        placeholder="Memo (optional)"
                        value={form.memo}
                        onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                        className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                    />

                    {/* Cleared toggle */}
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={form.cleared}
                            onChange={e => setForm(f => ({ ...f, cleared: e.target.checked }))}
                            className="rounded"
                        />
                        Mark as cleared
                    </label>

                    {/* Submit */}
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={saving || !form.amount || !form.account_id}
                    >
                        {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Add Transaction'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
