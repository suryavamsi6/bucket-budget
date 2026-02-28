import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Wallet, CreditCard, PiggyBank, Landmark, Banknote, CheckSquare } from 'lucide-react';
import { getAccounts, createAccount, updateAccount, deleteAccount, reconcileAccount } from '../api/client.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const TYPE_ICONS = {
    checking: Landmark,
    savings: PiggyBank,
    credit_card: CreditCard,
    cash: Banknote,
    investment: Wallet,
};

const TYPE_COLORS = {
    checking: 'text-blue-400 bg-blue-400/10',
    savings: 'text-emerald-600 bg-emerald-400/10',
    credit_card: 'text-orange-400 bg-orange-400/10',
    cash: 'text-yellow-400 bg-yellow-400/10',
    investment: 'text-purple-400 bg-purple-400/10',
};

export default function Accounts() {
    const { fmt } = useSettings();
    const [accounts, setAccounts] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showReconcile, setShowReconcile] = useState(null);
    const [reconcileBalance, setReconcileBalance] = useState('');
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: '', type: 'checking', balance: '', on_budget: true });
    const [toast, setToast] = useState(null);

    const loadAccounts = async () => {
        const data = await getAccounts();
        setAccounts(data);
    };

    useEffect(() => { loadAccounts(); }, []);

    const openCreate = () => {
        setEditing(null);
        setForm({ name: '', type: 'checking', balance: '', on_budget: true });
        setShowModal(true);
    };

    const openEdit = (acc) => {
        setEditing(acc);
        setForm({ name: acc.name, type: acc.type, balance: acc.balance, on_budget: acc.on_budget });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (editing) {
            await updateAccount(editing.id, { name: form.name, type: form.type, on_budget: form.on_budget });
        } else {
            await createAccount({ ...form, balance: parseFloat(form.balance) || 0 });
        }
        setShowModal(false);
        loadAccounts();
    };

    const handleDelete = async (id) => {
        if (confirm('Delete this account and all its transactions?')) {
            await deleteAccount(id);
            loadAccounts();
        }
    };

    const handleReconcile = async () => {
        if (!showReconcile || reconcileBalance === '') return;
        const result = await reconcileAccount(showReconcile.id, parseFloat(reconcileBalance));
        setShowReconcile(null);
        setReconcileBalance('');
        setToast(`Account reconciled! ${result.adjustment !== 0 ? `Adjustment: ${fmt(result.adjustment)}` : 'No adjustment needed.'}`);
        setTimeout(() => setToast(null), 4000);
        loadAccounts();
    };

    const totalBalance = accounts.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
    const onBudget = accounts.filter(a => a.on_budget && !a.closed);
    const offBudget = accounts.filter(a => !a.on_budget && !a.closed);

    return (
        <div className="space-y-6">
            {toast && (
                <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2">
                        <CheckSquare className="h-4 w-4" />
                        <span className="text-sm font-medium">{toast}</span>
                    </div>
                </div>
            )}

            <div className="flex items-end justify-between">
                <div>
                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Balance</h2>
                    <div className={`text-3xl font-bold tracking-tight ${totalBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {fmt(totalBalance)}
                    </div>
                </div>
                <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="mr-2 h-4 w-4" /> Add Account
                </Button>
            </div>

            {/* On Budget Accounts */}
            {onBudget.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">On Budget</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {onBudget.map(acc => {
                            const Icon = TYPE_ICONS[acc.type] || Wallet;
                            const colorClass = TYPE_COLORS[acc.type] || 'text-muted-foreground bg-muted';
                            return (
                                <Card key={acc.id} className="bg-card border-border hover:border-muted-foreground/30 transition-colors group">
                                    <CardContent className="p-5 flex items-center gap-4">
                                        <div className={`h-12 w-12 rounded-3xl flex items-center justify-center shrink-0 ${colorClass}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-foreground/80 truncate">{acc.name}</p>
                                            <p className="text-xs text-muted-foreground capitalize">{acc.type.replace('_', ' ')}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0 border-l border-border pl-4">
                                            <div className={`font-mono text-lg font-bold ${parseFloat(acc.balance) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {fmt(acc.balance)}
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setShowReconcile(acc); setReconcileBalance(acc.balance); }} title="Reconcile">
                                                    <CheckSquare className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-400" onClick={() => openEdit(acc)} title="Edit">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-600" onClick={() => handleDelete(acc.id)} title="Delete">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Off Budget Accounts */}
            {offBudget.length > 0 && (
                <div className="space-y-4 pt-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Off Budget</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {offBudget.map(acc => {
                            const Icon = TYPE_ICONS[acc.type] || Wallet;
                            const colorClass = TYPE_COLORS[acc.type] || 'text-muted-foreground bg-muted';
                            return (
                                <Card key={acc.id} className="bg-muted/50 border-border hover:bg-card transition-colors group opacity-80 hover:opacity-100">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${colorClass}`}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-muted-foreground truncate">{acc.name}</p>
                                            <p className="text-xs text-muted-foreground capitalize">{acc.type.replace('_', ' ')}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0 border-l border-border pl-4">
                                            <div className="font-mono text-base font-semibold text-muted-foreground">
                                                {fmt(acc.balance)}
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => { setShowReconcile(acc); setReconcileBalance(acc.balance); }} title="Reconcile">
                                                    <CheckSquare className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-blue-400" onClick={() => openEdit(acc)} title="Edit">
                                                    <Edit className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-rose-600" onClick={() => handleDelete(acc.id)} title="Delete">
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {accounts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-3xl bg-muted/50">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Wallet className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground/80 mb-2">No accounts yet</h3>
                    <p className="text-muted-foreground max-w-sm mb-6">Add your first checking or savings account to start tracking your budget and transactions.</p>
                    <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="mr-2 h-4 w-4" /> Add Account
                    </Button>
                </div>
            )}

            {/* Create/Edit Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground/80">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold mb-4 text-card-foreground">
                            {editing ? 'Edit Account' : 'Add Account'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-muted-foreground text-xs uppercase tracking-wider">Account Name</Label>
                            <Input
                                id="name"
                                className="bg-card border-border text-card-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g., Main Checking"
                                autoFocus
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="type" className="text-muted-foreground text-xs uppercase tracking-wider">Type</Label>
                                <select
                                    id="type"
                                    className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                    value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value })}
                                >
                                    <option value="checking">Checking</option>
                                    <option value="savings">Savings</option>
                                    <option value="credit_card">Credit Card</option>
                                    <option value="cash">Cash</option>
                                    <option value="investment">Investment</option>
                                </select>
                            </div>

                            {!editing && (
                                <div className="space-y-2">
                                    <Label htmlFor="balance" className="text-muted-foreground text-xs uppercase tracking-wider">Starting Balance</Label>
                                    <Input
                                        id="balance"
                                        type="number"
                                        step="0.01"
                                        className="bg-card border-border text-card-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500 font-mono"
                                        value={form.balance}
                                        onChange={e => setForm({ ...form, balance: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="on_budget"
                                className="h-4 w-4 rounded border-border bg-card text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950"
                                checked={form.on_budget}
                                onChange={e => setForm({ ...form, on_budget: e.target.checked })}
                            />
                            <Label htmlFor="on_budget" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground">
                                Include in Budget
                            </Label>
                        </div>

                        <DialogFooter className="pt-4 border-t border-border">
                            <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={() => setShowModal(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                {editing ? 'Save Changes' : 'Create Account'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Reconcile Modal */}
            <Dialog open={!!showReconcile} onOpenChange={() => setShowReconcile(null)}>
                <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground/80">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold mb-2 text-card-foreground">
                            Reconcile: {showReconcile?.name}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-sm">
                            Enter your bank's statement balance. All cleared transactions will be marked as reconciled.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="reconcileBalance" className="text-muted-foreground text-xs uppercase tracking-wider">Statement Balance</Label>
                            <Input
                                id="reconcileBalance"
                                type="number"
                                step="0.01"
                                className="bg-card border-border text-card-foreground focus-visible:ring-indigo-500 font-mono text-lg"
                                value={reconcileBalance}
                                onChange={e => setReconcileBalance(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-muted-foreground">Current Balance:</span>
                                <span className="font-mono text-foreground/80 font-semibold">{fmt(showReconcile?.balance)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-border">
                                <span className="text-sm font-medium text-muted-foreground">Difference:</span>
                                <span className={`font-mono font-bold ${Math.abs(parseFloat(reconcileBalance) - parseFloat(showReconcile?.balance || 0)) < 0.01 ? 'text-emerald-600' : 'text-yellow-400'}`}>
                                    {fmt((parseFloat(reconcileBalance) || 0) - parseFloat(showReconcile?.balance || 0))}
                                </span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-2 border-t border-border">
                        <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={() => setShowReconcile(null)}>
                            Cancel
                        </Button>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleReconcile}>
                            Finish Reconciliation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
