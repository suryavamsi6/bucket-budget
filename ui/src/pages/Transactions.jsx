import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Upload, CheckCircle, AlertCircle, ArrowUpDown, Search, Paperclip, FileText, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { getTransactions, getAccounts, getCategoryGroups, createTransaction, updateTransaction, deleteTransaction, importCSV, getPayeeSuggestions, uploadAttachment, deleteAttachment } from '../api/client.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';

function PayeeInput({ value, onChange }) {
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    const inputRef = useRef(null);
    const wrapperRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleInput = async (val) => {
        onChange(val);
        if (val.length >= 2) {
            const results = await getPayeeSuggestions(val);
            setSuggestions(results);
            setShowSuggestions(true);
            setHighlighted(-1);
        } else {
            setShowSuggestions(false);
        }
    };

    const selectSuggestion = (payee) => {
        onChange(payee);
        setShowSuggestions(false);
    };

    const handleKeyDown = (e) => {
        if (!showSuggestions || !suggestions.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted(prev => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && highlighted >= 0) {
            e.preventDefault();
            selectSuggestion(suggestions[highlighted]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    return (
        <div ref={wrapperRef} className="relative w-full">
            <Input
                ref={inputRef}
                className="bg-card border-border text-card-foreground focus-visible:ring-indigo-500 w-full"
                value={value}
                onChange={e => handleInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
                placeholder="Who did you pay?"
                autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-auto">
                    {suggestions.map((s, i) => (
                        <div
                            key={s}
                            className={`px-3 py-2 cursor-pointer text-sm font-medium ${i === highlighted ? 'bg-indigo-600/20 text-card-foreground' : 'text-foreground/80 hover:bg-secondary/80 hover:text-foreground'}`}
                            onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                        >
                            {s}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function Transactions() {
    const { fmt } = useSettings();
    const [transactions, setTransactions] = useState([]);
    const [total, setTotal] = useState(0);
    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [filters, setFilters] = useState({ account_id: '', from: '', to: '', search: '', limit: 30, offset: 0 });
    const [showModal, setShowModal] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ account_id: '', category_id: '', date: '', payee: '', amount: '', memo: '', cleared: false, attachments: [] });
    const [isUploading, setIsUploading] = useState(false);
    const [importAccountId, setImportAccountId] = useState('');
    const fileInputRef = useRef(null);

    const loadData = async () => {
        const params = {};
        Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
        const [txnRes, accRes, catRes] = await Promise.all([
            getTransactions(params),
            getAccounts(),
            getCategoryGroups()
        ]);
        setTransactions(txnRes.data);
        setTotal(txnRes.total);
        setAccounts(accRes);
        const allCats = catRes.flatMap(g => g.categories.map(c => ({ ...c, group_name: g.name })));
        setCategories(allCats);
    };

    useEffect(() => { loadData(); }, [filters.account_id, filters.from, filters.to, filters.offset]);

    const filteredTransactions = filters.search
        ? transactions.filter(t =>
            (t.payee || '').toLowerCase().includes(filters.search.toLowerCase()) ||
            (t.memo || '').toLowerCase().includes(filters.search.toLowerCase()) ||
            (t.category_name || '').toLowerCase().includes(filters.search.toLowerCase())
        )
        : transactions;

    const openCreate = () => {
        setEditing(null);
        setForm({
            account_id: accounts[0]?.id || '',
            category_id: '',
            date: new Date().toISOString().split('T')[0],
            payee: '', amount: '', memo: '', cleared: false, attachments: []
        });
        setShowModal(true);
    };

    const openEdit = (txn) => {
        setEditing(txn);
        setForm({
            account_id: txn.account_id,
            category_id: txn.category_id || '',
            date: txn.date,
            payee: txn.payee || '',
            amount: txn.amount,
            memo: txn.memo || '',
            cleared: !!txn.cleared,
            attachments: txn.attachments || []
        });
        setShowModal(true);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !editing) return;

        try {
            setIsUploading(true);
            const uploaded = await uploadAttachment(editing.id, file);
            setForm(prev => ({ ...prev, attachments: [...prev.attachments, ...uploaded] }));
            loadData(); // refresh background table
        } catch (err) {
            console.error('Failed to upload', err);
            alert('Upload failed. Note: You must save the transaction before attaching files.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileDelete = async (attachmentId) => {
        if (!confirm('Delete this attachment permanently?')) return;
        try {
            await deleteAttachment(attachmentId);
            setForm(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== attachmentId) }));
            loadData();
        } catch (err) {
            console.error('Failed to delete', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const data = {
            ...form,
            account_id: parseInt(form.account_id),
            category_id: form.category_id ? parseInt(form.category_id) : null,
            amount: parseFloat(form.amount)
        };
        if (editing) {
            await updateTransaction(editing.id, data);
        } else {
            await createTransaction(data);
        }
        setShowModal(false);
        loadData();
    };

    const handleDelete = async (id) => {
        if (confirm('Delete this transaction?')) {
            await deleteTransaction(id);
            loadData();
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file || !importAccountId) return;
        await importCSV(file, importAccountId);
        setShowImport(false);
        setImportAccountId('');
        loadData();
    };

    const toggleCleared = async (txn) => {
        await updateTransaction(txn.id, { cleared: !txn.cleared });
        loadData();
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            className="bg-card border-border text-card-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500 pl-9 w-full"
                            placeholder="Search payees, memos..."
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>

                    <select
                        className="flex h-10 w-full sm:w-[180px] rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        value={filters.account_id}
                        onChange={e => setFilters({ ...filters, account_id: e.target.value, offset: 0 })}
                    >
                        <option value="">All Accounts</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>

                    <div className="flex items-center gap-2 bg-card border border-border rounded-xl p-1 w-full sm:w-auto">
                        <Input
                            type="date"
                            className="bg-transparent border-none text-card-foreground focus-visible:ring-0 h-8 text-sm w-full sm:w-auto [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                            value={filters.from}
                            onChange={e => setFilters({ ...filters, from: e.target.value, offset: 0 })}
                        />
                        <span className="text-muted-foreground text-sm font-medium">to</span>
                        <Input
                            type="date"
                            className="bg-transparent border-none text-card-foreground focus-visible:ring-0 h-8 text-sm w-full sm:w-auto [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                            value={filters.to}
                            onChange={e => setFilters({ ...filters, to: e.target.value, offset: 0 })}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                    <Button variant="outline" className="bg-transparent border-border text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => setShowImport(true)}>
                        <Upload className="mr-2 h-4 w-4" /> Import CSV
                    </Button>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-900/20" onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" /> New
                    </Button>
                </div>
            </div>

            {/* Transaction Table */}
            <Card className="bg-card border-border overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="border-border hover:bg-muted/50">
                                    <TableHead className="w-[40px] px-2"></TableHead>
                                    <TableHead className="text-muted-foreground font-medium whitespace-nowrap min-w-[100px]">Date</TableHead>
                                    <TableHead className="text-muted-foreground font-medium min-w-[160px]">Payee</TableHead>
                                    <TableHead className="text-muted-foreground font-medium min-w-[140px]">Category</TableHead>
                                    <TableHead className="text-muted-foreground font-medium min-w-[140px]">Account</TableHead>
                                    <TableHead className="text-muted-foreground font-medium min-w-[160px]">Memo</TableHead>
                                    <TableHead className="text-right text-muted-foreground font-medium min-w-[100px]">Amount</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTransactions.map(txn => (
                                    <TableRow key={txn.id} className="border-border hover:bg-muted/50 transition-colors group">
                                        <TableCell className="px-2 py-3">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-6 w-6 rounded-full hover:bg-secondary/80 ${txn.cleared ? 'text-emerald-500' : 'text-muted-foreground'}`}
                                                onClick={() => toggleCleared(txn)}
                                                title={txn.cleared ? 'Cleared' : 'Uncleared'}
                                            >
                                                {txn.cleared ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground font-medium py-3 whitespace-nowrap">{txn.date}</TableCell>
                                        <TableCell className="text-foreground/80 font-semibold py-3">
                                            <div className="flex items-center gap-2">
                                                {txn.payee || '—'}
                                                {txn.attachments?.length > 0 && (
                                                    <div className="flex items-center text-muted-foreground/60" title={`${txn.attachments.length} attachment(s)`}>
                                                        <Paperclip className="h-3.5 w-3.5" />
                                                        <span className="text-[10px] ml-0.5 font-medium">{txn.attachments.length}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm py-3">
                                            <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                                                {txn.category_name || 'Uncategorized'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm py-3">{txn.account_name}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm py-3 max-w-[200px] truncate" title={txn.memo}>{txn.memo}</TableCell>
                                        <TableCell className={`text-right font-mono font-medium py-3 ${parseFloat(txn.amount) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {fmt(txn.amount)}
                                        </TableCell>
                                        <TableCell className="py-3 pr-4">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-400" onClick={() => openEdit(txn)} title="Edit">
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-600" onClick={() => handleDelete(txn.id)} title="Delete">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Pagination */}
            {total > filters.limit && (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                        Showing <span className="font-medium text-muted-foreground">{filters.offset + 1}</span> to <span className="font-medium text-muted-foreground">{Math.min(filters.offset + filters.limit, total)}</span> of <span className="font-medium text-muted-foreground">{total}</span> results
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-card border-border text-muted-foreground hover:bg-secondary"
                            disabled={filters.offset === 0}
                            onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-card border-border text-muted-foreground hover:bg-secondary"
                            disabled={filters.offset + filters.limit >= total}
                            onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            {filteredTransactions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-3xl bg-muted/30">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <ArrowUpDown className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium text-muted-foreground mb-1">No transactions found</p>
                    <p className="text-sm text-muted-foreground">
                        {filters.search ? 'Try adjusting your search or filters.' : 'Add your first transaction to see it here.'}
                    </p>
                    {!filters.search && (
                        <Button className="mt-6 bg-indigo-600 hover:bg-indigo-700" onClick={openCreate}>
                            <Plus className="mr-2 h-4 w-4" /> Add Transaction
                        </Button>
                    )}
                </div>
            )}

            {/* Add/Edit Transaction Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="sm:max-w-[550px] bg-background border-border text-foreground/80">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold mb-2 text-card-foreground">
                            {editing ? 'Edit Transaction' : 'New Transaction'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="account_id" className="text-muted-foreground text-xs uppercase tracking-wider">Account</Label>
                                <select
                                    id="account_id"
                                    className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                    value={form.account_id}
                                    onChange={e => setForm({ ...form, account_id: e.target.value })}
                                    required
                                >
                                    <option value="" disabled>Select Account</option>
                                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date" className="text-muted-foreground text-xs uppercase tracking-wider">Date</Label>
                                <Input
                                    id="date"
                                    type="date"
                                    className="bg-card border-border text-card-foreground focus-visible:ring-indigo-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2 sm:col-span-1">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Payee</Label>
                                <PayeeInput value={form.payee} onChange={val => setForm({ ...form, payee: val })} />
                            </div>
                            <div className="space-y-2 sm:col-span-1">
                                <Label htmlFor="amount" className="text-muted-foreground text-xs uppercase tracking-wider">Amount</Label>
                                <div className="relative">
                                    <Input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        className="bg-card border-border text-card-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500 font-mono text-lg pr-12"
                                        value={form.amount}
                                        onChange={e => setForm({ ...form, amount: e.target.value })}
                                        placeholder="-50.00"
                                        required
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                        <span className="text-muted-foreground text-sm">+/-</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground">Negative for expenses, positive for income.</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="category_id" className="text-muted-foreground text-xs uppercase tracking-wider">Category</Label>
                            <select
                                id="category_id"
                                className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                value={form.category_id}
                                onChange={e => setForm({ ...form, category_id: e.target.value })}
                            >
                                <option value="">Uncategorized / Ready to Assign</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.group_name} › {c.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="memo" className="text-muted-foreground text-xs uppercase tracking-wider">Memo</Label>
                            <Input
                                id="memo"
                                className="bg-card border-border text-card-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500"
                                value={form.memo}
                                onChange={e => setForm({ ...form, memo: e.target.value })}
                                placeholder="Optional note about this transaction"
                            />
                        </div>

                        <div className="flex items-center space-x-2 pt-2 pb-2">
                            <input
                                type="checkbox"
                                id="cleared"
                                className="h-4 w-4 rounded border-border bg-card text-primary focus:ring-primary focus:ring-offset-background"
                                checked={form.cleared}
                                onChange={e => setForm({ ...form, cleared: e.target.checked })}
                            />
                            <Label htmlFor="cleared" className="text-sm font-medium leading-none cursor-pointer text-muted-foreground">
                                Cleared <span className="text-muted-foreground font-normal">(Has posted to your actual bank account)</span>
                            </Label>
                        </div>

                        {/* Attachments Section */}
                        {editing && (
                            <div className="border-t border-border pt-4 mt-4">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wider mb-3 block">Receipts & Attachments</Label>

                                <div className="space-y-3">
                                    {form.attachments?.map(att => (
                                        <div key={att.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                                    {att.mime_type.startsWith('image/') ? (
                                                        <ImageIcon className="h-4 w-4 text-primary" />
                                                    ) : (
                                                        <FileText className="h-4 w-4 text-primary" />
                                                    )}
                                                </div>
                                                <div className="truncate">
                                                    <a
                                                        href={`/api/transactions/attachments/${att.id}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-sm font-medium hover:underline truncate block"
                                                    >
                                                        {att.file_name}
                                                    </a>
                                                    <p className="text-[10px] text-muted-foreground">{(att.size_bytes / 1024).toFixed(1)} KB</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 shrink-0"
                                                onClick={() => handleFileDelete(att.id)}
                                                type="button"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}

                                    <div className="relative border-2 border-dashed border-border rounded-xl p-4 text-center hover:bg-muted/30 transition-colors">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                            onChange={handleFileUpload}
                                            disabled={isUploading}
                                        />
                                        {isUploading ? (
                                            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                                        ) : (
                                            <Paperclip className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                                        )}
                                        <p className="text-sm font-medium text-foreground/80">Click or drag a file to attach</p>
                                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, PDF up to 10MB</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {!editing && (
                            <div className="text-xs text-muted-foreground italic text-center pt-2">
                                Save this transaction first to attach receipts.
                            </div>
                        )}

                        <DialogFooter className="pt-4 border-t border-border flex flex-col sm:flex-row justify-between gap-4 sm:gap-2">
                            {editing ? (
                                <Button type="button" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300 w-full sm:w-auto" onClick={() => { setShowModal(false); handleDelete(editing.id); }}>
                                    Delete
                                </Button>
                            ) : <div />}
                            <div className="flex gap-2 w-full sm:w-auto justify-end">
                                <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-secondary flex-1 sm:flex-none" onClick={() => setShowModal(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white flex-1 sm:flex-none">
                                    {editing ? 'Save Changes' : 'Add Transaction'}
                                </Button>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Import CSV Modal */}
            <Dialog open={showImport} onOpenChange={setShowImport}>
                <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground/80">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold mb-2 text-card-foreground">Import CSV</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Upload a spreadsheet exported from your bank to quickly add transactions.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="importAccountId" className="text-muted-foreground text-xs uppercase tracking-wider">Target Account</Label>
                            <select
                                id="importAccountId"
                                className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                value={importAccountId}
                                onChange={e => setImportAccountId(e.target.value)}
                            >
                                <option value="" disabled>Select account...</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>

                        <div className={`border-2 border-dashed rounded-2xl p-6 text-center ${!importAccountId ? 'border-border bg-muted/50 opacity-50' : 'border-indigo-500/30 bg-indigo-500/5 hover:bg-secondary cursor-pointer'} transition-colors relative`}>
                            <Input
                                type="file"
                                accept=".csv"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                onChange={handleImport}
                                disabled={!importAccountId}
                            />
                            <Upload className={`h-8 w-8 mx-auto mb-3 ${importAccountId ? 'text-card-foreground' : 'text-muted-foreground'}`} />
                            <p className="text-sm font-medium text-foreground/80 mb-1">
                                {importAccountId ? 'Click or drag CSV file here' : 'Select an account first'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Expected columns: Date, Payee/Description, Amount (or Inflow/Outflow), Memo/Notes
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="border-t border-border pt-4">
                        <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-secondary w-full" onClick={() => setShowImport(false)}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
