import { useState, useEffect } from 'react';
import { RefreshCw, Plus, CreditCard, Play, Clock, ExternalLink, Calendar, Trash2, Edit2, Link2 } from 'lucide-react';
import {
    getSubscriptions, createSubscription, updateSubscription,
    deleteSubscription, processSubscriptions, getAccounts, getCategoryGroups
} from '../api/client.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function Subscriptions() {
    const { fmt } = useSettings();
    const [items, setItems] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    const [openAdd, setOpenAdd] = useState(false);
    const [editItem, setEditItem] = useState(null);

    const defaultForm = {
        account_id: '',
        category_id: '',
        type: 'expense',
        amount: '',
        payee: '',
        memo: '',
        frequency: 'monthly',
        next_date: new Date().toISOString().split('T')[0],
        is_subscription: 'true',
        subscription_url: '',
        status: 'active'
    };
    const [formData, setFormData] = useState(defaultForm);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [subData, accData, catGroupsData] = await Promise.all([
                getSubscriptions(), getAccounts(), getCategoryGroups()
            ]);
            setItems(subData);
            setAccounts(accData);
            setCategories(catGroupsData.reduce((acc, group) => {
                return acc.concat(group.categories);
            }, []));
        } catch (e) {
            console.error('Failed to load subscriptions', e);
        }
        setLoading(false);
    };

    const handleProcess = async () => {
        setProcessing(true);
        try {
            const res = await processSubscriptions();
            alert(`Processed ${res.processed} due transactions successfully!`);
            loadData();
        } catch (e) {
            alert('Error processing transactions: ' + e.message);
        }
        setProcessing(false);
    };

    const openEdit = (item) => {
        setEditItem(item);
        setFormData({
            ...item,
            account_id: String(item.account_id),
            category_id: item.category_id ? String(item.category_id) : 'none',
            is_subscription: String(item.is_subscription), // stored as 1/0 or boolean usually, let's treat as string for select
            next_date: item.next_date.split('T')[0],
            amount: Math.abs(item.amount)
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
                account_id: parseInt(formData.account_id),
                category_id: formData.category_id && formData.category_id !== 'none' ? parseInt(formData.category_id) : null,
                amount: parseFloat(formData.amount),
                is_subscription: formData.is_subscription === 'true' || formData.is_subscription === true
            };

            if (editItem) {
                await updateSubscription(editItem.id, payload);
            } else {
                await createSubscription(payload);
            }
            setOpenAdd(false);
            setEditItem(null);
            loadData();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this recurring transaction?')) return;
        try {
            await deleteSubscription(id);
            loadData();
        } catch (e) {
            alert(e.message);
        }
    };

    const monthlyTotal = items.reduce((acc, curr) => {
        if (curr.status !== 'active' || curr.type !== 'expense') return acc;
        let monthlyEquiv = 0;
        if (curr.frequency === 'monthly') monthlyEquiv = parseFloat(curr.amount);
        if (curr.frequency === 'yearly') monthlyEquiv = parseFloat(curr.amount) / 12;
        if (curr.frequency === 'weekly') monthlyEquiv = parseFloat(curr.amount) * 4.33;
        if (curr.frequency === 'daily') monthlyEquiv = parseFloat(curr.amount) * 30.4;
        if (curr.frequency === 'biweekly') monthlyEquiv = parseFloat(curr.amount) * 2.16;
        return acc + monthlyEquiv;
    }, 0);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary rounded-2xl text-card-foreground">
                        <RefreshCw className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Subscriptions & Recurring</h2>
                        <p className="text-muted-foreground">Automate your regular expenses and income.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="secondary"
                        className="bg-muted text-card-foreground hover:bg-secondary/80"
                        onClick={handleProcess}
                        disabled={processing}
                    >
                        <Play className={`mr-2 h-4 w-4 ${processing ? 'animate-pulse' : ''}`} />
                        {processing ? 'Processing...' : 'Process Due'}
                    </Button>
                    <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Plus className="mr-2 h-4 w-4" /> Add New
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardDescription>Active Subscriptions</CardDescription>
                        <CardTitle className="text-3xl text-card-foreground">
                            {items.filter(i => i.is_subscription && i.status === 'active').length}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardDescription>Total Recurring Items</CardDescription>
                        <CardTitle className="text-3xl text-card-foreground">{items.filter(i => i.status === 'active').length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-gradient-to-br from-indigo-900/40 to-violet-900/40 border-indigo-500/30">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-indigo-400">Monthly Expense Est.</CardDescription>
                        <CardTitle className="text-3xl font-bold text-card-foreground tracking-tight">{fmt(-monthlyTotal)}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {loading ? (
                <div className="text-center py-20 text-muted-foreground">Loading recurring transactions...</div>
            ) : items.length === 0 ? (
                <div className="text-center py-20 bg-muted/50 rounded-3xl border border-dashed border-border">
                    <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground">No recurring transactions</h3>
                    <p className="text-muted-foreground mt-1 max-w-sm mx-auto">Set up your subscriptions, bills, and paychecks to automate your budget.</p>
                    <Button onClick={openNew} className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Plus className="mr-2 h-4 w-4" /> Add your first item
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map(item => {
                        const isIncome = item.type === 'income';
                        const isSub = item.is_subscription;
                        const isDue = new Date(item.next_date) <= new Date();

                        return (
                            <Card key={item.id} className={`bg-card border-border overflow-hidden relative ${item.status === 'paused' ? 'opacity-60' : ''}`}>
                                {isDue && item.status === 'active' && (
                                    <div className="absolute top-0 right-0 left-0 h-1 bg-rose-500" />
                                )}
                                <CardHeader className="pb-3 flex flex-row items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg text-card-foreground font-medium flex items-center gap-2">
                                            {isSub ? <CreditCard className="w-4 h-4 text-card-foreground" /> : <RefreshCw className="w-4 h-4 text-muted-foreground" />}
                                            {item.payee || 'Recurring Transfer'}
                                        </CardTitle>
                                        <CardDescription className="text-muted-foreground flex items-center gap-1">
                                            {item.category_name || item.account_name}
                                        </CardDescription>
                                    </div>
                                    <div className={`text-lg font-bold ${isIncome ? 'text-emerald-600' : 'text-foreground/80'}`}>
                                        {fmt(isIncome ? item.amount : -item.amount)}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between text-sm py-2 border-t border-border">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="w-4 h-4" />
                                            <span className="capitalize">{item.frequency}</span>
                                        </div>
                                        <div className={`flex items-center gap-2 font-medium ${isDue && item.status === 'active' ? 'text-rose-600' : 'text-muted-foreground'}`}>
                                            <Clock className="w-4 h-4" />
                                            {new Date(item.next_date).toLocaleDateString()}
                                            {isDue && item.status === 'active' && ' (Due)'}
                                        </div>
                                    </div>
                                    <div className="flex bg-muted/50 rounded-2xl p-1 mt-4 gap-1">
                                        {item.subscription_url && (
                                            <Button variant="ghost" size="sm" asChild className="flex-1 text-muted-foreground hover:text-foreground hover:bg-secondary text-xs h-8">
                                                <a href={item.subscription_url} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="w-3 h-3 justify-center" />
                                                </a>
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(item)} className="flex-1 text-muted-foreground hover:text-foreground hover:bg-secondary text-xs h-8">
                                            <Edit2 className="w-3 h-3 mr-2" /> Edit
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            <Dialog open={openAdd} onOpenChange={setOpenAdd}>
                <DialogContent className="bg-card border-border text-card-foreground sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editItem ? 'Edit Recurring Item' : 'Add Recurring Item'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val })}>
                                    <SelectTrigger className="bg-background border-border">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground/80">
                                        <SelectItem value="expense">Expense</SelectItem>
                                        <SelectItem value="income">Income</SelectItem>
                                        <SelectItem value="transfer">Transfer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Frequency</Label>
                                <Select value={formData.frequency} onValueChange={(val) => setFormData({ ...formData, frequency: val })}>
                                    <SelectTrigger className="bg-background border-border">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground/80">
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="yearly">Yearly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                                <Label>Payee</Label>
                                <Input
                                    className="bg-background border-border"
                                    value={formData.payee}
                                    onChange={e => setFormData({ ...formData, payee: e.target.value })}
                                    required={formData.type !== 'transfer'}
                                />
                            </div>
                            <div className="space-y-2 col-span-2 sm:col-span-1">
                                <Label>Amount</Label>
                                <Input
                                    type="number" step="0.01" min="0" required
                                    className="bg-background border-border"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Account</Label>
                                <Select required value={formData.account_id} onValueChange={(val) => setFormData({ ...formData, account_id: val })}>
                                    <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select account" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground/80">
                                        {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>{formData.type === 'transfer' ? 'Transfer To' : 'Category'}</Label>
                                {formData.type === 'transfer' ? (
                                    <Select required value={formData.transfer_account_id} onValueChange={(val) => setFormData({ ...formData, transfer_account_id: val })}>
                                        <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Dest info" /></SelectTrigger>
                                        <SelectContent className="bg-card border-border text-foreground/80">
                                            {accounts.filter(a => String(a.id) !== formData.account_id).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Select value={formData.category_id} onValueChange={(val) => setFormData({ ...formData, category_id: val })}>
                                        <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select Category" /></SelectTrigger>
                                        <SelectContent className="bg-card border-border text-foreground/80">
                                            <SelectItem value="none">-- No Category --</SelectItem>
                                            {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 relative">
                                <Label>Next Date</Label>
                                <div className="absolute top-[28px] left-3 pointer-events-none text-muted-foreground z-10">
                                    <Calendar className="w-4 h-4" />
                                </div>
                                <Input
                                    type="date" required
                                    className="bg-background border-border pl-10"
                                    value={formData.next_date}
                                    onChange={e => setFormData({ ...formData, next_date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                                    <SelectTrigger className="bg-background border-border">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground/80">
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="paused">Paused</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="bg-muted/50 p-4 rounded-3xl border border-border space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Is this a Subscription?</Label>
                                <Select value={formData.is_subscription} onValueChange={(val) => setFormData({ ...formData, is_subscription: val })}>
                                    <SelectTrigger className="bg-card border-border w-[120px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground/80">
                                        <SelectItem value="true">Yes</SelectItem>
                                        <SelectItem value="false">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {(formData.is_subscription === 'true' || formData.is_subscription === true) && (
                                <div className="space-y-2">
                                    <Label>Website / Link (Optional)</Label>
                                    <div className="relative">
                                        <Link2 className="absolute top-2.5 left-3 w-4 h-4 text-muted-foreground" />
                                        <Input
                                            placeholder="https://netflix.com"
                                            className="bg-card border-border pl-10"
                                            value={formData.subscription_url}
                                            onChange={e => setFormData({ ...formData, subscription_url: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Memo (Optional)</Label>
                            <Input
                                className="bg-background border-border"
                                value={formData.memo}
                                onChange={e => setFormData({ ...formData, memo: e.target.value })}
                            />
                        </div>

                        <DialogFooter className="pt-4 border-t border-border flex justify-between w-full">
                            {editItem ? (
                                <div className="flex justify-between w-full">
                                    <Button type="button" variant="destructive" onClick={() => { handleDelete(editItem.id); setOpenAdd(false); }}>
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </Button>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setOpenAdd(false)}>Cancel</Button>
                                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Save Changes</Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setOpenAdd(false)}>Cancel</Button>
                                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Add Item</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
