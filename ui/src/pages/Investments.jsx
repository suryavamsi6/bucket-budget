import { useState, useEffect } from 'react';
import { TrendingUp, Plus, Activity, Trash2, Edit2, TrendingDown, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, CalendarPlus, BarChart3 } from 'lucide-react';
import {
    getInvestments, createInvestment, updateInvestment, deleteInvestment,
    getInvestmentTransactions, addInvestmentTransaction, deleteInvestmentTransaction
} from '../api/client.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function Investments() {
    const { fmt, settings } = useSettings();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const [openAdd, setOpenAdd] = useState(false);
    const [editItem, setEditItem] = useState(null);

    // Transaction history state
    const [expandedId, setExpandedId] = useState(null);
    const [txnData, setTxnData] = useState({});
    const [txnLoading, setTxnLoading] = useState({});

    // Add transaction dialog
    const [openTxn, setOpenTxn] = useState(false);
    const [txnTarget, setTxnTarget] = useState(null);
    const [txnForm, setTxnForm] = useState({
        type: 'buy', quantity: '', price: '', date: new Date().toISOString().split('T')[0], notes: ''
    });

    const defaultForm = {
        ticker: '',
        name: '',
        asset_class: 'Stock',
        quantity: '',
        average_price: '',
        current_price: '',
        sip_enabled: false,
        sip_amount: '',
        sip_frequency: 'monthly',
        sip_day: '1'
    };
    const [formData, setFormData] = useState(defaultForm);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getInvestments();
            setItems(data);
        } catch (e) {
            console.error('Failed to load investments', e);
        }
        setLoading(false);
    };

    const loadTxns = async (investmentId) => {
        setTxnLoading(prev => ({ ...prev, [investmentId]: true }));
        try {
            const txns = await getInvestmentTransactions(investmentId);
            setTxnData(prev => ({ ...prev, [investmentId]: txns }));
        } catch (e) {
            console.error('Failed to load transactions', e);
        }
        setTxnLoading(prev => ({ ...prev, [investmentId]: false }));
    };

    const toggleExpand = (id) => {
        if (expandedId === id) {
            setExpandedId(null);
        } else {
            setExpandedId(id);
            if (!txnData[id]) loadTxns(id);
        }
    };

    const openEdit = (item) => {
        setEditItem(item);
        setFormData({
            ...item,
            quantity: String(item.quantity),
            average_price: String(item.average_price),
            current_price: String(item.current_price),
            sip_enabled: item.sip_enabled ? true : false,
            sip_amount: String(item.sip_amount || ''),
            sip_frequency: item.sip_frequency || 'monthly',
            sip_day: String(item.sip_day || '1')
        });
        setOpenAdd(true);
    };

    const openNew = () => {
        setEditItem(null);
        setFormData(defaultForm);
        setOpenAdd(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                quantity: parseFloat(formData.quantity),
                average_price: parseFloat(formData.average_price),
                current_price: parseFloat(formData.current_price || formData.average_price),
                sip_enabled: formData.sip_enabled,
                sip_amount: parseFloat(formData.sip_amount) || 0,
                sip_frequency: formData.sip_frequency,
                sip_day: parseInt(formData.sip_day) || 1
            };

            if (editItem) {
                await updateInvestment(editItem.id, payload);
            } else {
                await createInvestment(payload);
            }
            setOpenAdd(false);
            setEditItem(null);
            loadData();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this investment record?')) return;
        try {
            await deleteInvestment(id);
            loadData();
        } catch (e) {
            alert(e.message);
        }
    };

    // Transaction handlers
    const openAddTxn = (item) => {
        setTxnTarget(item);
        setTxnForm({
            type: 'buy', quantity: '', price: String(item.current_price || ''), date: new Date().toISOString().split('T')[0], notes: ''
        });
        setOpenTxn(true);
    };

    const handleSaveTxn = async (e) => {
        e.preventDefault();
        if (!txnTarget) return;
        try {
            await addInvestmentTransaction(txnTarget.id, {
                type: txnForm.type,
                quantity: parseFloat(txnForm.quantity),
                price: parseFloat(txnForm.price),
                date: txnForm.date,
                notes: txnForm.notes
            });
            setOpenTxn(false);
            // Refresh both the investment list and transaction list
            loadData();
            loadTxns(txnTarget.id);
        } catch (e) {
            alert(e.message);
        }
    };

    const handleDeleteTxn = async (investmentId, txnId) => {
        if (!confirm('Delete this transaction? This will recalculate holdings.')) return;
        try {
            await deleteInvestmentTransaction(investmentId, txnId);
            loadData();
            loadTxns(investmentId);
        } catch (e) {
            alert(e.message);
        }
    };

    // Calculate totals
    const totalValue = items.reduce((acc, curr) => acc + (parseFloat(curr.quantity) * parseFloat(curr.current_price)), 0);
    const totalCost = items.reduce((acc, curr) => acc + (parseFloat(curr.quantity) * parseFloat(curr.average_price)), 0);
    const totalGain = totalValue - totalCost;
    const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-2xl text-emerald-600">
                        <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Investments</h2>
                        <p className="text-muted-foreground">Track your portfolio performance and assets.</p>
                    </div>
                </div>
                <div>
                    <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" /> Add Asset
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="bg-gradient-to-br from-indigo-500/90 via-purple-600/90 to-blue-600/90 border-none shadow-lg shadow-indigo-500/20 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/5 opacity-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-white/5 to-transparent mix-blend-overlay"></div>
                    <div className="absolute -top-6 -right-6 p-4 opacity-10 pointer-events-none transform rotate-12">
                        <span className="text-[128px] font-bold leading-none select-none">{settings.currency_symbol || '$'}</span>
                    </div>
                    <CardHeader className="pb-2 relative z-10">
                        <CardDescription className="text-indigo-100 font-medium tracking-wide text-xs uppercase">Total Portfolio Value</CardDescription>
                        <CardTitle className="text-4xl font-bold text-white tracking-tight drop-shadow-sm">{fmt(totalValue)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    <CardHeader className="pb-2 relative z-10">
                        <CardDescription className="text-muted-foreground font-medium tracking-wide text-xs uppercase">Total Cost Basis</CardDescription>
                        <CardTitle className="text-3xl font-bold tracking-tight text-card-foreground">{fmt(totalCost)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    <CardHeader className="pb-2 relative z-10">
                        <CardDescription className="text-muted-foreground font-medium tracking-wide text-xs uppercase">Total Unrealized Gain</CardDescription>
                        <CardTitle className={`text-3xl font-bold tracking-tight flex items-center gap-2 ${totalGain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {totalGain >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                            {fmt(Math.abs(totalGain))}
                        </CardTitle>
                        <div className={`text-sm font-semibold mt-1 bg-opacity-10 px-2 py-0.5 rounded-full inline-flex w-fit ${totalGain >= 0 ? 'bg-emerald-500 text-emerald-500' : 'bg-rose-500 text-rose-500'}`}>
                            {totalGain >= 0 ? '+' : ''}{totalGainPercent.toFixed(2)}%
                        </div>
                    </CardHeader>
                </Card>
            </div>

            {loading ? (
                <div className="text-center py-20 text-muted-foreground">Loading portfolio...</div>
            ) : items.length === 0 ? (
                <div className="text-center py-20 bg-muted/50 rounded-3xl border border-dashed border-border">
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground">No assets tracked</h3>
                    <p className="text-muted-foreground mt-1 max-w-sm mx-auto">Add stocks, crypto, or other assets to start tracking your net worth accurately.</p>
                    <Button onClick={openNew} className="mt-6 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Plus className="mr-2 h-4 w-4" /> Add your first asset
                    </Button>
                </div>
            ) : (
                <div className="space-y-4">
                    {items.map(item => {
                        const qty = parseFloat(item.quantity);
                        const avg = parseFloat(item.average_price);
                        const cur = parseFloat(item.current_price);

                        const value = qty * cur;
                        const cost = qty * avg;
                        const gain = value - cost;
                        const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
                        const isPositive = gain >= 0;
                        const isExpanded = expandedId === item.id;
                        const txns = txnData[item.id] || [];
                        const isTxnLoading = txnLoading[item.id];

                        return (
                            <Card key={item.id} className="bg-card border-border overflow-hidden hover:border-muted-foreground/30 transition-colors">
                                <CardHeader className="pb-3 flex flex-row items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-xl text-card-foreground font-bold tracking-tight flex items-center gap-2">
                                            {item.ticker}
                                            {item.sip_enabled ? (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 uppercase tracking-wider">SIP</span>
                                            ) : null}
                                        </CardTitle>
                                        <CardDescription className="text-muted-foreground line-clamp-1" title={item.name}>
                                            {item.name}
                                        </CardDescription>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-card-foreground">{fmt(value)}</div>
                                        <div className={`text-sm font-medium flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                            {Math.abs(gainPct).toFixed(2)}%
                                            {item.xirr !== null && item.xirr !== undefined && (
                                                <span className="text-muted-foreground text-xs ml-1" title="XIRR (annualized return)">
                                                    · XIRR {item.xirr > 0 ? '+' : ''}{item.xirr}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm py-4 border-t border-border">
                                        <div>
                                            <div className="text-muted-foreground mb-1">Quantity</div>
                                            <div className="text-foreground/80 font-medium">{qty.toLocaleString(undefined, { maximumFractionDigits: 8 })}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground mb-1">Avg Cost</div>
                                            <div className="text-foreground/80 font-medium">{fmt(avg)}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground mb-1">Current Price</div>
                                            <div className="text-foreground/80 font-medium">{fmt(cur)}</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground mb-1">P&L</div>
                                            <div className={`font-medium font-mono ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {isPositive ? '+' : ''}{fmt(gain)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* SIP Info */}
                                    {item.sip_enabled && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 border-t border-border">
                                            <CalendarPlus className="w-3.5 h-3.5 text-indigo-400" />
                                            <span>SIP: <span className="text-foreground/80 font-medium">{fmt(item.sip_amount)}</span> {item.sip_frequency} on day {item.sip_day}</span>
                                        </div>
                                    )}

                                    <div className="flex bg-muted/50 rounded-2xl p-1 mt-2 gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => openAddTxn(item)} className="flex-1 text-muted-foreground hover:text-foreground hover:bg-secondary text-xs h-8">
                                            <Plus className="w-3 h-3 mr-1" /> Record Purchase
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => toggleExpand(item.id)} className="flex-1 text-muted-foreground hover:text-foreground hover:bg-secondary text-xs h-8">
                                            <BarChart3 className="w-3 h-3 mr-1" /> History {item.transaction_count > 0 && `(${item.transaction_count})`}
                                            {isExpanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(item)} className="flex-1 text-muted-foreground hover:text-foreground hover:bg-secondary text-xs h-8">
                                            <Edit2 className="w-3 h-3 mr-1" /> Edit
                                        </Button>
                                    </div>

                                    {/* Transaction History */}
                                    {isExpanded && (
                                        <div className="mt-3 border-t border-border pt-3">
                                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Transaction History</h4>
                                            {isTxnLoading ? (
                                                <div className="text-xs text-muted-foreground py-4 text-center">Loading...</div>
                                            ) : txns.length === 0 ? (
                                                <div className="text-xs text-muted-foreground py-4 text-center">
                                                    No transactions recorded yet. Use "Record Purchase" to add buy/sell entries.
                                                </div>
                                            ) : (
                                                <div className="space-y-1 max-h-[240px] overflow-y-auto">
                                                    {txns.map(t => (
                                                        <div key={t.id} className="flex items-center justify-between text-xs py-2 px-3 rounded-xl hover:bg-muted/30 group transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`font-semibold uppercase px-1.5 py-0.5 rounded text-[10px] ${t.type === 'sell' ? 'bg-rose-500/10 text-rose-500' : t.type === 'sip' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                                    {t.type}
                                                                </span>
                                                                <span className="text-muted-foreground">{new Date(t.date).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-foreground/80 font-mono">
                                                                    {parseFloat(t.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })} × {fmt(t.price)}
                                                                </span>
                                                                <span className="font-semibold text-foreground/80 font-mono min-w-[80px] text-right">
                                                                    {fmt(parseFloat(t.quantity) * parseFloat(t.price))}
                                                                </span>
                                                                <Button
                                                                    variant="ghost" size="sm"
                                                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 transition-opacity"
                                                                    onClick={() => handleDeleteTxn(item.id, t.id)}
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Add/Edit Asset Dialog */}
            <Dialog open={openAdd} onOpenChange={setOpenAdd}>
                <DialogContent className="bg-card border-border text-card-foreground sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editItem ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Ticker / Symbol</Label>
                                <Input
                                    className="bg-background border-border uppercase"
                                    placeholder="AAPL"
                                    value={formData.ticker}
                                    onChange={e => setFormData({ ...formData, ticker: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Asset Class</Label>
                                <Select value={formData.asset_class} onValueChange={(val) => setFormData({ ...formData, asset_class: val })}>
                                    <SelectTrigger className="bg-background border-border">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground/80">
                                        <SelectItem value="Stock">Stock</SelectItem>
                                        <SelectItem value="Crypto">Crypto</SelectItem>
                                        <SelectItem value="ETF">ETF</SelectItem>
                                        <SelectItem value="Mutual Fund">Mutual Fund</SelectItem>
                                        <SelectItem value="Bond">Bond</SelectItem>
                                        <SelectItem value="Real Estate">Real Estate</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Asset Name</Label>
                            <Input
                                className="bg-background border-border"
                                placeholder="Apple Inc."
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Quantity</Label>
                                <Input
                                    type="number" step="any" min="0"
                                    className="bg-background border-border"
                                    value={formData.quantity}
                                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Avg Cost</Label>
                                <Input
                                    type="number" step="any" min="0"
                                    className="bg-background border-border"
                                    value={formData.average_price}
                                    onChange={e => setFormData({ ...formData, average_price: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Current Price</Label>
                                <Input
                                    type="number" step="any" min="0"
                                    className="bg-background border-border"
                                    value={formData.current_price}
                                    onChange={e => setFormData({ ...formData, current_price: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        {/* SIP Configuration */}
                        <div className="bg-muted/50 p-4 rounded-3xl border border-border space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="text-sm font-medium">SIP (Systematic Investment)</Label>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">Track recurring investments in this asset</p>
                                </div>
                                <Select value={formData.sip_enabled ? 'true' : 'false'} onValueChange={(val) => setFormData({ ...formData, sip_enabled: val === 'true' })}>
                                    <SelectTrigger className="bg-card border-border w-[90px] h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground/80">
                                        <SelectItem value="true">Yes</SelectItem>
                                        <SelectItem value="false">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.sip_enabled && (
                                <div className="grid grid-cols-3 gap-3 pt-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Amount</Label>
                                        <Input
                                            type="number" step="0.01" min="0"
                                            className="bg-card border-border h-8 text-sm"
                                            value={formData.sip_amount}
                                            onChange={e => setFormData({ ...formData, sip_amount: e.target.value })}
                                            placeholder="5000"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Frequency</Label>
                                        <Select value={formData.sip_frequency} onValueChange={(val) => setFormData({ ...formData, sip_frequency: val })}>
                                            <SelectTrigger className="bg-card border-border h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card border-border text-foreground/80">
                                                <SelectItem value="weekly">Weekly</SelectItem>
                                                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                                                <SelectItem value="monthly">Monthly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Day of Month</Label>
                                        <Input
                                            type="number" min="1" max="28"
                                            className="bg-card border-border h-8 text-sm"
                                            value={formData.sip_day}
                                            onChange={e => setFormData({ ...formData, sip_day: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="pt-4 border-t border-border flex justify-between w-full">
                            {editItem ? (
                                <div className="flex justify-between w-full">
                                    <Button type="button" variant="destructive" onClick={() => { handleDelete(editItem.id); setOpenAdd(false); }}>
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </Button>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setOpenAdd(false)}>Cancel</Button>
                                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Save Changes</Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setOpenAdd(false)}>Cancel</Button>
                                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Add Asset</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Record Transaction Dialog */}
            <Dialog open={openTxn} onOpenChange={setOpenTxn}>
                <DialogContent className="bg-card border-border text-card-foreground sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Record Transaction
                            {txnTarget && <span className="text-sm font-mono text-muted-foreground">({txnTarget.ticker})</span>}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveTxn} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={txnForm.type} onValueChange={(val) => setTxnForm({ ...txnForm, type: val })}>
                                    <SelectTrigger className="bg-background border-border">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground/80">
                                        <SelectItem value="buy">Buy</SelectItem>
                                        <SelectItem value="sell">Sell</SelectItem>
                                        <SelectItem value="sip">SIP</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input
                                    type="date" required
                                    className="bg-background border-border"
                                    value={txnForm.date}
                                    onChange={e => setTxnForm({ ...txnForm, date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Quantity</Label>
                                <Input
                                    type="number" step="any" min="0" required
                                    className="bg-background border-border"
                                    value={txnForm.quantity}
                                    onChange={e => setTxnForm({ ...txnForm, quantity: e.target.value })}
                                    placeholder="10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Price per Unit</Label>
                                <Input
                                    type="number" step="any" min="0" required
                                    className="bg-background border-border"
                                    value={txnForm.price}
                                    onChange={e => setTxnForm({ ...txnForm, price: e.target.value })}
                                    placeholder="150.00"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Notes <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                            <Input
                                className="bg-background border-border"
                                value={txnForm.notes}
                                onChange={e => setTxnForm({ ...txnForm, notes: e.target.value })}
                                placeholder="Monthly SIP, Dip buy..."
                            />
                        </div>
                        <div className="bg-muted/50 rounded-xl p-3 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                                <span>Total Amount</span>
                                <span className="font-semibold text-foreground/80 font-mono">
                                    {txnForm.quantity && txnForm.price ? fmt(parseFloat(txnForm.quantity) * parseFloat(txnForm.price)) : '—'}
                                </span>
                            </div>
                        </div>
                        <DialogFooter className="pt-4 border-t border-border">
                            <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setOpenTxn(false)}>Cancel</Button>
                            <Button type="submit" className={`text-white ${txnForm.type === 'sell' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                {txnForm.type === 'sell' ? 'Record Sale' : 'Record Purchase'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
