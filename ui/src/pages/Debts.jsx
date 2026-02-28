import { useState, useEffect } from 'react';
import { Landmark, Plus, Trash2, Edit2, TrendingDown, Snowflake, Flame, ArrowDown, ArrowUp, Info } from 'lucide-react';
import { getDebts, createDebt, updateDebt, deleteDebt, getDebtStrategies } from '../api/client.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const DEBT_TYPES = [
    { value: 'credit_card', label: 'Credit Card', icon: '💳' },
    { value: 'student_loan', label: 'Student Loan', icon: '🎓' },
    { value: 'mortgage', label: 'Mortgage', icon: '🏠' },
    { value: 'car_loan', label: 'Car Loan', icon: '🚗' },
    { value: 'personal_loan', label: 'Personal Loan', icon: '🤝' },
    { value: 'other', label: 'Other', icon: '📋' }
];

export default function Debts() {
    const { fmt } = useSettings();
    const [debts, setDebts] = useState([]);
    const [strategies, setStrategies] = useState(null);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [activeStrategy, setActiveStrategy] = useState('avalanche');

    const defaultForm = { name: '', type: 'credit_card', balance: '', interest_rate: '', minimum_payment: '', extra_payment: '0' };
    const [form, setForm] = useState(defaultForm);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [d, s] = await Promise.all([getDebts(), getDebtStrategies()]);
            setDebts(d);
            setStrategies(s);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const openNew = () => { setEditItem(null); setForm(defaultForm); setOpenDialog(true); };
    const openEdit = (d) => {
        setEditItem(d);
        setForm({
            name: d.name, type: d.type, balance: String(d.balance),
            interest_rate: String(d.interest_rate), minimum_payment: String(d.minimum_payment),
            extra_payment: String(d.extra_payment || 0)
        });
        setOpenDialog(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...form, balance: parseFloat(form.balance), interest_rate: parseFloat(form.interest_rate),
                minimum_payment: parseFloat(form.minimum_payment), extra_payment: parseFloat(form.extra_payment) || 0
            };
            if (editItem) await updateDebt(editItem.id, payload);
            else await createDebt(payload);
            setOpenDialog(false);
            loadData();
        } catch (e) { alert(e.message); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this debt?')) return;
        await deleteDebt(id);
        loadData();
    };

    const totalBalance = debts.reduce((s, d) => s + parseFloat(d.balance), 0);
    const totalMinPayment = debts.reduce((s, d) => s + parseFloat(d.minimum_payment), 0);
    const avgRate = debts.length > 0 ? debts.reduce((s, d) => s + parseFloat(d.interest_rate), 0) / debts.length : 0;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/10 rounded-2xl text-rose-600"><Landmark className="h-6 w-6" /></div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Debt Payoff Planner</h2>
                        <p className="text-muted-foreground">Track and strategize your debt payoff.</p>
                    </div>
                </div>
                <Button onClick={openNew} className="bg-rose-600 hover:bg-rose-700 text-white w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" /> Add Debt
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="bg-gradient-to-br from-rose-500/90 via-red-600/90 to-orange-500/90 border-none shadow-lg text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/5 opacity-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-white/5 to-transparent mix-blend-overlay"></div>
                    <CardHeader className="pb-2 relative z-10">
                        <CardDescription className="text-rose-100 font-medium tracking-wide text-xs uppercase">Total Debt</CardDescription>
                        <CardTitle className="text-4xl font-bold text-white">{fmt(totalBalance)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium tracking-wide text-xs uppercase">Monthly Minimum</CardDescription>
                        <CardTitle className="text-3xl font-bold text-card-foreground">{fmt(totalMinPayment)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium tracking-wide text-xs uppercase">Avg Interest Rate</CardDescription>
                        <CardTitle className="text-3xl font-bold text-card-foreground">{avgRate.toFixed(1)}%</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Strategy Comparison */}
            {strategies?.summary && debts.length > 0 && (
                <Card className="bg-card border-border mb-6">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base text-card-foreground">Payoff Strategy Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setActiveStrategy('avalanche')}
                                className={`p-4 rounded-2xl border transition-all text-left ${activeStrategy === 'avalanche' ? 'border-rose-500 bg-rose-500/10' : 'border-border hover:border-muted-foreground/30'}`}>
                                <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                                    <Flame className="w-4 h-4 text-rose-500" /> Avalanche
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-full ml-auto">SAVES MORE</span>
                                </div>
                                <div className="text-2xl font-bold text-card-foreground">{strategies.summary.avalanche_months} months</div>
                                <div className="text-xs text-muted-foreground mt-1">Interest paid: {fmt(strategies.summary.avalanche_interest)}</div>
                            </button>
                            <button onClick={() => setActiveStrategy('snowball')}
                                className={`p-4 rounded-2xl border transition-all text-left ${activeStrategy === 'snowball' ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-muted-foreground/30'}`}>
                                <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                                    <Snowflake className="w-4 h-4 text-blue-500" /> Snowball
                                    <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded-full ml-auto">QUICK WINS</span>
                                </div>
                                <div className="text-2xl font-bold text-card-foreground">{strategies.summary.snowball_months} months</div>
                                <div className="text-xs text-muted-foreground mt-1">Interest paid: {fmt(strategies.summary.snowball_interest)}</div>
                            </button>
                        </div>

                        {strategies.summary.savings > 0 && (
                            <div className="mt-3 bg-emerald-500/10 text-emerald-500 text-xs font-medium p-2 rounded-xl text-center">
                                💡 Avalanche saves you {fmt(strategies.summary.savings)} in interest
                            </div>
                        )}

                        {/* Payoff Order */}
                        <div className="mt-4 pt-4 border-t border-border">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                                {activeStrategy === 'avalanche' ? '🔥 Avalanche' : '❄️ Snowball'} Payoff Order
                            </h4>
                            <div className="space-y-2">
                                {(activeStrategy === 'avalanche' ? strategies.avalanche : strategies.snowball).map((item, i) => (
                                    <div key={item.id} className="flex items-center gap-3 text-sm">
                                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                                        <span className="text-foreground/80 flex-1">{item.name}</span>
                                        <span className="text-muted-foreground text-xs">{item.month} months</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {loading ? (
                <div className="text-center py-20 text-muted-foreground">Loading debts...</div>
            ) : debts.length === 0 ? (
                <div className="text-center py-20 bg-muted/50 rounded-3xl border border-dashed border-border">
                    <TrendingDown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground">No debts tracked</h3>
                    <p className="text-muted-foreground mt-1 max-w-sm mx-auto">Add your debts to see payoff timelines and compare snowball vs avalanche strategies.</p>
                    <Button onClick={openNew} className="mt-6 bg-rose-600 hover:bg-rose-700 text-white">
                        <Plus className="mr-2 h-4 w-4" /> Add your first debt
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {debts.map(debt => {
                        const typeInfo = DEBT_TYPES.find(t => t.value === debt.type) || DEBT_TYPES[5];
                        return (
                            <Card key={debt.id} className="bg-card border-border hover:border-muted-foreground/30 transition-colors">
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{typeInfo.icon}</span>
                                            <div>
                                                <h3 className="font-bold text-card-foreground">{debt.name}</h3>
                                                <span className="text-xs text-muted-foreground">{typeInfo.label} · {debt.interest_rate}% APR</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-rose-500">{fmt(debt.balance)}</div>
                                            <div className="text-xs text-muted-foreground">Min: {fmt(debt.minimum_payment)}/mo</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 mt-4 pt-3 border-t border-border text-sm">
                                        <div>
                                            <div className="text-muted-foreground text-xs mb-1">Payoff In</div>
                                            <div className="font-medium text-foreground/80">{debt.months_to_payoff > 0 ? `${debt.months_to_payoff} months` : '—'}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground text-xs mb-1">Total Interest</div>
                                            <div className="font-medium text-rose-500">{fmt(debt.total_interest)}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground text-xs mb-1">Debt Free By</div>
                                            <div className="font-medium text-foreground/80">{debt.payoff_date ? new Date(debt.payoff_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</div>
                                        </div>
                                    </div>
                                    <div className="flex bg-muted/50 rounded-2xl p-1 mt-3 gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(debt)} className="flex-1 text-muted-foreground hover:text-foreground text-xs h-8">
                                            <Edit2 className="w-3 h-3 mr-1" /> Edit
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(debt.id)} className="flex-1 text-muted-foreground hover:text-rose-500 text-xs h-8">
                                            <Trash2 className="w-3 h-3 mr-1" /> Delete
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogContent className="bg-card border-border text-card-foreground sm:max-w-md">
                    <DialogHeader><DialogTitle>{editItem ? 'Edit Debt' : 'Add New Debt'}</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input className="bg-background border-border" placeholder="Chase Visa" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={form.type} onValueChange={val => setForm({ ...form, type: val })}>
                                    <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground/80">
                                        {DEBT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Balance</Label>
                                <Input type="number" step="0.01" min="0" className="bg-background border-border" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Interest Rate (%)</Label>
                                <Input type="number" step="0.01" min="0" max="100" className="bg-background border-border" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: e.target.value })} required />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Minimum Payment</Label>
                                <Input type="number" step="0.01" min="0" className="bg-background border-border" value={form.minimum_payment} onChange={e => setForm({ ...form, minimum_payment: e.target.value })} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Extra Payment</Label>
                                <Input type="number" step="0.01" min="0" className="bg-background border-border" value={form.extra_payment} onChange={e => setForm({ ...form, extra_payment: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter className="pt-4 border-t border-border">
                            <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => setOpenDialog(false)}>Cancel</Button>
                            <Button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white">{editItem ? 'Save Changes' : 'Add Debt'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
