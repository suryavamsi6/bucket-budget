import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Copy, ArrowLeftRight, Layers } from 'lucide-react';
import { getBudget, getBudgetSummary, assignBudget, createCategoryGroup, createCategory, copyBudget, moveMoney } from '../api/client.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';

export default function Budget() {
    const { fmt } = useSettings();
    const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [groups, setGroups] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showCatModal, setShowCatModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [newCat, setNewCat] = useState({ group_id: '', name: '', goal_type: '', goal_amount: '' });
    const [moveData, setMoveData] = useState({ from: '', to: '', amount: '' });
    const [toast, setToast] = useState(null);
    const [showTemplateModal, setShowTemplateModal] = useState(false);

    const BUDGET_TEMPLATES = [
        {
            name: '50/30/20 Rule',
            description: 'Split income: 50% needs, 30% wants, 20% savings',
            icon: '⚖️',
            color: 'indigo',
            groups: [
                { name: '🏠 Needs (50%)', categories: ['Rent / Mortgage', 'Utilities', 'Groceries', 'Insurance', 'Transportation', 'Healthcare'] },
                { name: '🎯 Wants (30%)', categories: ['Dining Out', 'Entertainment', 'Shopping', 'Subscriptions', 'Hobbies', 'Travel'] },
                { name: '💰 Savings (20%)', categories: ['Emergency Fund', 'Investments', 'Debt Payoff', 'Retirement'] }
            ]
        },
        {
            name: 'Essentials First',
            description: 'Cover bills first, then allocate the rest',
            icon: '🏗️',
            color: 'emerald',
            groups: [
                { name: '📌 Fixed Bills', categories: ['Rent', 'Electricity', 'Water', 'Internet', 'Phone', 'Insurance'] },
                { name: '🛒 Living', categories: ['Groceries', 'Transport', 'Healthcare', 'Personal Care'] },
                { name: '🎉 Lifestyle', categories: ['Dining', 'Shopping', 'Entertainment', 'Gym'] },
                { name: '🏦 Financial', categories: ['Savings', 'Investments', 'EMI Payments'] }
            ]
        },
        {
            name: 'Zero-Based',
            description: 'Every rupee gets a job — assign until ₹0 remains',
            icon: '🎯',
            color: 'rose',
            groups: [
                { name: '🏠 Housing', categories: ['Rent', 'Utilities', 'Maintenance'] },
                { name: '🍽️ Food', categories: ['Groceries', 'Restaurants', 'Coffee'] },
                { name: '🚗 Transport', categories: ['Fuel', 'Public Transit', 'Car Insurance'] },
                { name: '💼 Work', categories: ['Office Supplies', 'Professional Dev'] },
                { name: '🎮 Fun', categories: ['Entertainment', 'Hobbies', 'Subscriptions'] },
                { name: '💰 Goals', categories: ['Emergency Fund', 'Vacation', 'Big Purchase'] }
            ]
        }
    ];

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [budgetData, summaryData] = await Promise.all([
                getBudget(month),
                getBudgetSummary(month)
            ]);
            setGroups(budgetData);
            setSummary(summaryData);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, [month]);

    useEffect(() => { loadData(); }, [loadData]);

    const changeMonth = (dir) => {
        const d = new Date(month + '-01');
        d.setMonth(d.getMonth() + dir);
        setMonth(d.toISOString().slice(0, 7));
    };

    const monthLabel = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const handleAssign = async (categoryId, value) => {
        const num = parseFloat(value) || 0;
        await assignBudget(month, categoryId, num);
        loadData();
    };

    const handleAddGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        await createCategoryGroup({ name: newGroupName });
        setNewGroupName('');
        setShowGroupModal(false);
        loadData();
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCat.group_id || !newCat.name.trim()) return;
        await createCategory({
            ...newCat,
            group_id: parseInt(newCat.group_id),
            goal_amount: newCat.goal_amount ? parseFloat(newCat.goal_amount) : null,
            goal_type: newCat.goal_type || null
        });
        setNewCat({ group_id: '', name: '', goal_type: '', goal_amount: '' });
        setShowCatModal(false);
        loadData();
    };

    const handleCopyLastMonth = async () => {
        const result = await copyBudget(month);
        setToast(`Copied ${result.copied} of ${result.total} categories from last month`);
        setTimeout(() => setToast(null), 3000);
        loadData();
    };

    const handleMoveMoney = async (e) => {
        e.preventDefault();
        if (!moveData.from || !moveData.to || !moveData.amount) return;
        await moveMoney(parseInt(moveData.from), parseInt(moveData.to), parseFloat(moveData.amount), month);
        setMoveData({ from: '', to: '', amount: '' });
        setShowMoveModal(false);
        setToast('Money moved successfully!');
        setTimeout(() => setToast(null), 3000);
        loadData();
    };

    const allCategories = groups.flatMap(g => g.categories.map(c => ({ ...c, group_name: g.name })));

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                <p className="text-muted-foreground font-medium">Loading budget...</p>
            </div>
        );
    }

    const unassigned = summary?.to_be_budgeted || 0;
    const isUnassignedPositive = unassigned > 0;
    const isUnassignedNegative = unassigned < 0;

    return (
        <div className="space-y-6">
            {toast && (
                <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2">
                        <span className="text-sm font-medium">✓ {toast}</span>
                    </div>
                </div>
            )}

            {/* Budget Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-card border border-border rounded-3xl p-4 md:p-6 shadow-sm">

                <div className="flex items-center gap-4 w-full xl:w-auto justify-center xl:justify-start">
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-muted border-border text-muted-foreground hover:bg-secondary/80 hover:text-foreground" onClick={() => changeMonth(-1)}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-2xl font-bold tracking-tight text-card-foreground min-w-[200px] text-center">{monthLabel}</h2>
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-muted border-border text-muted-foreground hover:bg-secondary/80 hover:text-foreground" onClick={() => changeMonth(1)}>
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
                    <div className={`flex flex-col items-center sm:items-start px-6 py-3 rounded-2xl w-full sm:w-auto ${isUnassignedPositive ? 'bg-emerald-500/10 border border-emerald-500/20' : isUnassignedNegative ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-muted border border-border'}`}>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">To Be Budgeted</span>
                        <span className={`text-2xl font-bold font-mono tracking-tight ${isUnassignedPositive ? 'text-emerald-600' : isUnassignedNegative ? 'text-rose-600' : 'text-foreground/80'}`}>
                            {fmt(unassigned)}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
                        <Button variant="outline" className="bg-card border-border text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={handleCopyLastMonth} title="Copy allocations from previous month">
                            <Copy className="mr-2 h-4 w-4" /> Copy Previous
                        </Button>
                        <Button variant="outline" className="bg-card border-border text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => setShowTemplateModal(true)}>
                            <Layers className="mr-2 h-4 w-4" /> Templates
                        </Button>
                        <Button variant="outline" className="bg-card border-border text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => setShowMoveModal(true)}>
                            <ArrowLeftRight className="mr-2 h-4 w-4" /> Move
                        </Button>
                        <Button variant="outline" className="bg-card border-border text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => setShowGroupModal(true)}>
                            <Plus className="mr-1 h-4 w-4" /> Group
                        </Button>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-900/20" onClick={() => setShowCatModal(true)}>
                            <Plus className="mr-1 h-4 w-4" /> Category
                        </Button>
                    </div>
                </div>
            </div>

            {/* Summary bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-muted/50 border-border">
                    <CardContent className="p-4 flex flex-col">
                        <span className="text-sm font-medium text-muted-foreground mb-1">Income Expected</span>
                        <span className="text-xl font-bold text-emerald-600 font-mono">{fmt(summary?.month_income)}</span>
                    </CardContent>
                </Card>
                <Card className="bg-muted/50 border-border">
                    <CardContent className="p-4 flex flex-col">
                        <span className="text-sm font-medium text-muted-foreground mb-1">Assigned Needed</span>
                        <span className="text-xl font-bold text-card-foreground font-mono">{fmt(summary?.month_assigned)}</span>
                    </CardContent>
                </Card>
                <Card className="bg-muted/50 border-border">
                    <CardContent className="p-4 flex flex-col">
                        <span className="text-sm font-medium text-muted-foreground mb-1">Spent So Far</span>
                        <span className="text-xl font-bold text-rose-600 font-mono">{fmt(summary?.month_expenses)}</span>
                    </CardContent>
                </Card>
            </div>

            {/* Budget Grid */}
            <div className="space-y-6">
                {groups.map(group => (
                    <div key={group.id} className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">

                        {/* Group Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
                            <h3 className="font-semibold text-foreground/80 text-lg w-1/3 min-w-[200px]">{group.name}</h3>
                            <div className="flex w-2/3 justify-end gap-2 md:gap-4">
                                <div className="text-right w-1/3 min-w-[100px] text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden sm:block">Assigned</div>
                                <div className="text-right w-1/3 min-w-[100px] text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden md:block">Activity</div>
                                <div className="text-right w-1/3 min-w-[100px] text-xs font-semibold text-muted-foreground uppercase tracking-widest">Available</div>
                            </div>
                        </div>

                        {/* Categories */}
                        <div className="divide-y divide-border">
                            {group.categories.map(cat => {
                                const available = parseFloat(cat.available) || 0;
                                const goalProgress = cat.goal_progress;
                                const isAvailablePositive = available > 0;
                                const isAvailableNegative = available < 0;
                                const isAvailableZero = available === 0;

                                return (
                                    <div key={cat.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors group">

                                        {/* Category Info */}
                                        <div className="w-full sm:w-1/3 min-w-[200px] mb-3 sm:mb-0 flex items-center justify-between sm:justify-start gap-4">
                                            <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">{cat.name}</span>
                                            {cat.goal_amount !== null && cat.goal_amount !== undefined && (
                                                <div className="flex-shrink-0 w-16 h-1.5 bg-muted rounded-full overflow-hidden" title={`Goal Progress: ${Math.round(goalProgress || 0)}%`}>
                                                    <div
                                                        className={`h-full rounded-full ${goalProgress >= 100 ? 'bg-emerald-500' : goalProgress < 0 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                                        style={{ width: `${Math.min(100, Math.max(0, goalProgress || 0))}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Amounts */}
                                        <div className="flex w-full sm:w-2/3 items-center justify-between sm:justify-end gap-2 md:gap-4">

                                            {/* Mobile Label Wrapper */}
                                            <div className="flex flex-col sm:contents w-1/3 min-w-[90px] md:min-w-[100px]">
                                                <span className="text-[10px] text-muted-foreground uppercase sm:hidden mb-1">Assigned</span>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        className="h-8 md:h-9 bg-muted/50 border-transparent hover:border-muted-foreground/30 focus:bg-card focus:border-indigo-500 text-right font-mono text-sm shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500 transition-all text-foreground/80 w-full"
                                                        defaultValue={cat.assigned || 0}
                                                        onBlur={(e) => handleAssign(cat.id, e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-col sm:contents w-1/3 min-w-[90px] md:min-w-[100px] text-right">
                                                <span className="text-[10px] text-muted-foreground uppercase sm:hidden mb-1">Activity</span>
                                                <span className={`font-mono text-sm py-1.5 md:py-2 px-3 ${parseFloat(cat.activity) < 0 ? 'text-rose-600/80' : 'text-muted-foreground'}`}>
                                                    {fmt(cat.activity)}
                                                </span>
                                            </div>

                                            <div className="flex flex-col sm:contents w-1/3 min-w-[90px] md:min-w-[100px] text-right">
                                                <span className="text-[10px] text-muted-foreground uppercase sm:hidden mb-1">Available</span>
                                                <div className="flex justify-end w-full">
                                                    <span className={`inline-flex items-center justify-end px-3 py-1.5 md:py-2 rounded-xl font-mono text-sm font-bold min-w-[80px] w-full sm:w-auto ${isAvailablePositive ? 'bg-emerald-500/10 text-emerald-600' :
                                                        isAvailableNegative ? 'bg-rose-500/10 text-rose-600' :
                                                            'bg-muted/50 text-muted-foreground font-medium'
                                                        }`}>
                                                        {fmt(available)}
                                                    </span>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {groups.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-3xl bg-muted/50 mt-4">
                    <p className="text-lg font-medium text-muted-foreground mb-2">No budget categories yet</p>
                    <p className="text-muted-foreground mb-6 max-w-sm">Create a group and add categories to start organizing your money.</p>
                    <Button onClick={() => setShowGroupModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="mr-2 h-4 w-4" /> Add your first group
                    </Button>
                </div>
            )}

            {/* Add Group Modal */}
            <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
                <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground/80">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold mb-2 text-card-foreground">Add Category Group</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Groups help you organize related spending categories together.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddGroup} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="groupName" className="text-muted-foreground text-xs uppercase tracking-wider">Group Name</Label>
                            <Input
                                id="groupName"
                                className="bg-card border-border text-card-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500"
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                                placeholder="e.g., Fixed Expenses, Living, Savings"
                                autoFocus
                                required
                            />
                        </div>
                        <DialogFooter className="pt-4 border-t border-border">
                            <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={() => setShowGroupModal(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                Create Group
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Add Category Modal */}
            <Dialog open={showCatModal} onOpenChange={setShowCatModal}>
                <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground/80">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold mb-2 text-card-foreground">Add Category</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Create a specific bucket for your money underneath a group.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddCategory} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="catGroupId" className="text-muted-foreground text-xs uppercase tracking-wider">Group</Label>
                            <select
                                id="catGroupId"
                                className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                value={newCat.group_id}
                                onChange={e => setNewCat({ ...newCat, group_id: e.target.value })}
                                required
                            >
                                <option value="" disabled>Select group...</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="catName" className="text-muted-foreground text-xs uppercase tracking-wider">Category Name</Label>
                            <Input
                                id="catName"
                                className="bg-card border-border text-card-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500"
                                value={newCat.name}
                                onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                                placeholder="e.g., Groceries, Rent, Auto Maintenance"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="goalType" className="text-muted-foreground text-xs uppercase tracking-wider">Goal Type <span className="text-muted-foreground normal-case font-normal">(Optional)</span></Label>
                                <select
                                    id="goalType"
                                    className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                    value={newCat.goal_type}
                                    onChange={e => setNewCat({ ...newCat, goal_type: e.target.value })}
                                >
                                    <option value="">No goal</option>
                                    <option value="monthly_funding">Monthly Funding</option>
                                    <option value="target_balance">Target Balance</option>
                                    <option value="target_by_date">Target by Date</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="goalAmount" className="text-muted-foreground text-xs uppercase tracking-wider">Goal Amount</Label>
                                <Input
                                    id="goalAmount"
                                    type="number"
                                    step="0.01"
                                    className="bg-card border-border text-card-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500 font-mono"
                                    value={newCat.goal_amount}
                                    onChange={e => setNewCat({ ...newCat, goal_amount: e.target.value })}
                                    placeholder="0.00"
                                    disabled={!newCat.goal_type}
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-4 border-t border-border">
                            <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={() => setShowCatModal(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-card-foreground">
                                Create Category
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Move Money Modal */}
            <Dialog open={showMoveModal} onOpenChange={setShowMoveModal}>
                <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground/80">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold mb-2 text-card-foreground">Move Money</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Transfer allocated funds between categories to cover overspending or shift priorities.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleMoveMoney} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="moveFrom" className="text-muted-foreground text-xs uppercase tracking-wider">From Category</Label>
                            <select
                                id="moveFrom"
                                className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                value={moveData.from}
                                onChange={e => setMoveData({ ...moveData, from: e.target.value })}
                                required
                            >
                                <option value="" disabled>Select source...</option>
                                {allCategories.map(c => (
                                    <option key={`from-${c.id}`} value={c.id}>{c.group_name} › {c.name} ({fmt(c.available)})</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-center -my-2 relative z-10">
                            <div className="bg-card border border-border rounded-full p-1.5 text-muted-foreground">
                                <ArrowLeftRight className="h-4 w-4" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="moveTo" className="text-muted-foreground text-xs uppercase tracking-wider">To Category</Label>
                            <select
                                id="moveTo"
                                className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                value={moveData.to}
                                onChange={e => setMoveData({ ...moveData, to: e.target.value })}
                                required
                            >
                                <option value="" disabled>Select destination...</option>
                                {allCategories.map(c => (
                                    <option key={`to-${c.id}`} value={c.id} disabled={c.id.toString() === moveData.from}>{c.group_name} › {c.name} ({fmt(c.available)})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2 pt-2">
                            <Label htmlFor="moveAmount" className="text-muted-foreground text-xs uppercase tracking-wider">Amount to Move</Label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <span className="text-muted-foreground font-mono text-lg">$</span>
                                </div>
                                <Input
                                    id="moveAmount"
                                    type="number"
                                    step="0.01"
                                    className="bg-card border-border text-card-foreground placeholder:text-muted-foreground focus-visible:ring-indigo-500 font-mono text-lg pl-8"
                                    value={moveData.amount}
                                    onChange={e => setMoveData({ ...moveData, amount: e.target.value })}
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-4 border-t border-border">
                            <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={() => setShowMoveModal(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-card-foreground">
                                Move Funds
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Template Dialog */}
            <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
                <DialogContent className="bg-card border-border text-card-foreground sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-lg">Budget Templates</DialogTitle>
                        <DialogDescription className="text-muted-foreground text-sm">Choose a template to quickly set up budget categories.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                        {BUDGET_TEMPLATES.map((tpl, i) => (
                            <button key={i} onClick={async () => {
                                try {
                                    for (const grp of tpl.groups) {
                                        const g = await createCategoryGroup({ name: grp.name });
                                        for (const catName of grp.categories) {
                                            await createCategory({ group_id: g.id, name: catName });
                                        }
                                    }
                                    setShowTemplateModal(false);
                                    setToast(`Template "${tpl.name}" applied!`);
                                    setTimeout(() => setToast(null), 3000);
                                    loadData();
                                } catch (e) { alert(e.message); }
                            }}
                                className="w-full text-left p-4 rounded-2xl border border-border hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="text-xl">{tpl.icon}</span>
                                    <span className="font-semibold text-card-foreground group-hover:text-indigo-400 transition-colors">{tpl.name}</span>
                                </div>
                                <p className="text-xs text-muted-foreground ml-9">{tpl.description}</p>
                                <div className="flex flex-wrap gap-1 mt-2 ml-9">
                                    {tpl.groups.map((g, j) => (
                                        <span key={j} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{g.name}</span>
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
