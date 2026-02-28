import { useState, useEffect } from 'react';
import { Target, Plus, Trash2, Edit2, TrendingUp, Calendar, Flame, Gift, PiggyBank, Sparkles } from 'lucide-react';
import { getGoals, createGoal, updateGoal, deleteGoal, contributeToGoal } from '../api/client.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const GOAL_ICONS = ['🎯', '🏠', '✈️', '🚗', '💍', '🎓', '🏥', '💰', '📱', '🎮', '🏋️', '🎵', '🐾', '👶', '🎄'];
const GOAL_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];

export default function Goals() {
    const { fmt } = useSettings();
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [openContribute, setOpenContribute] = useState(null);
    const [contributeAmount, setContributeAmount] = useState('');

    const defaultForm = { name: '', icon: '🎯', target_amount: '', saved_amount: '0', target_date: '', color: '#6366f1', status: 'active' };
    const [form, setForm] = useState(defaultForm);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try { setGoals(await getGoals()); } catch (e) { console.error(e); }
        setLoading(false);
    };

    const openNew = () => { setEditItem(null); setForm(defaultForm); setOpenDialog(true); };
    const openEdit = (g) => { setEditItem(g); setForm({ ...g, target_amount: String(g.target_amount), saved_amount: String(g.saved_amount) }); setOpenDialog(true); };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...form, target_amount: parseFloat(form.target_amount), saved_amount: parseFloat(form.saved_amount) || 0 };
            if (editItem) await updateGoal(editItem.id, payload);
            else await createGoal(payload);
            setOpenDialog(false);
            loadData();
        } catch (e) { alert(e.message); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this goal?')) return;
        await deleteGoal(id);
        loadData();
    };

    const handleContribute = async () => {
        if (!openContribute || !contributeAmount) return;
        try {
            await contributeToGoal(openContribute.id, parseFloat(contributeAmount));
            setOpenContribute(null);
            setContributeAmount('');
            loadData();
        } catch (e) { alert(e.message); }
    };

    const totalTarget = goals.reduce((s, g) => s + parseFloat(g.target_amount), 0);
    const totalSaved = goals.reduce((s, g) => s + parseFloat(g.saved_amount), 0);
    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-2xl text-indigo-600"><Target className="h-6 w-6" /></div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Savings Goals</h2>
                        <p className="text-muted-foreground">Track progress toward your financial targets.</p>
                    </div>
                </div>
                <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" /> New Goal
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="bg-gradient-to-br from-indigo-500/90 via-purple-600/90 to-pink-500/90 border-none shadow-lg text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/5 opacity-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-white/5 to-transparent mix-blend-overlay"></div>
                    <CardHeader className="pb-2 relative z-10">
                        <CardDescription className="text-indigo-100 font-medium tracking-wide text-xs uppercase">Total Progress</CardDescription>
                        <CardTitle className="text-4xl font-bold text-white">{fmt(totalSaved)}</CardTitle>
                        <p className="text-sm text-indigo-100 mt-1">of {fmt(totalTarget)} target</p>
                    </CardHeader>
                </Card>
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium tracking-wide text-xs uppercase">Active Goals</CardDescription>
                        <CardTitle className="text-3xl font-bold text-card-foreground">{activeGoals.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium tracking-wide text-xs uppercase">Completed</CardDescription>
                        <CardTitle className="text-3xl font-bold text-emerald-500 flex items-center gap-2"><Sparkles className="w-6 h-6" />{completedGoals.length}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {loading ? (
                <div className="text-center py-20 text-muted-foreground">Loading goals...</div>
            ) : goals.length === 0 ? (
                <div className="text-center py-20 bg-muted/50 rounded-3xl border border-dashed border-border">
                    <PiggyBank className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground">No goals yet</h3>
                    <p className="text-muted-foreground mt-1 max-w-sm mx-auto">Set savings goals to track your progress toward vacations, emergency funds, and more.</p>
                    <Button onClick={openNew} className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Plus className="mr-2 h-4 w-4" /> Create your first goal
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {goals.map(goal => {
                        const target = parseFloat(goal.target_amount);
                        const saved = parseFloat(goal.saved_amount);
                        const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
                        const isComplete = goal.status === 'completed';
                        const daysLeft = goal.target_date ? Math.max(0, Math.ceil((new Date(goal.target_date) - new Date()) / (1000 * 60 * 60 * 24))) : null;

                        return (
                            <Card key={goal.id} className={`bg-card border-border overflow-hidden transition-all hover:shadow-md ${isComplete ? 'opacity-75' : ''}`}>
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{goal.icon}</span>
                                            <div>
                                                <h3 className="font-bold text-card-foreground text-base">{goal.name}</h3>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                    {isComplete && <span className="text-emerald-500 font-semibold">✓ Completed</span>}
                                                    {daysLeft !== null && !isComplete && (
                                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{daysLeft} days left</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            {!isComplete && (
                                                <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => { setOpenContribute(goal); setContributeAmount(''); }}>
                                                    <Plus className="w-3 h-3 mr-1" /> Add
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => openEdit(goal)}>
                                                <Edit2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="mb-2">
                                        <div className="flex justify-between text-sm mb-1.5">
                                            <span className="font-semibold text-foreground/80">{fmt(saved)}</span>
                                            <span className="text-muted-foreground">{fmt(target)}</span>
                                        </div>
                                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500 ease-out"
                                                style={{ width: `${pct}%`, backgroundColor: goal.color || '#6366f1' }}
                                            />
                                        </div>
                                        <div className="text-right text-xs text-muted-foreground mt-1 font-medium">{pct.toFixed(1)}%</div>
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
                    <DialogHeader><DialogTitle>{editItem ? 'Edit Goal' : 'New Savings Goal'}</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Goal Name</Label>
                            <Input className="bg-background border-border" placeholder="Vacation to Bali" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Icon</Label>
                            <div className="flex flex-wrap gap-2">
                                {GOAL_ICONS.map(icon => (
                                    <button key={icon} type="button" onClick={() => setForm({ ...form, icon })}
                                        className={`text-xl p-1.5 rounded-xl transition-all ${form.icon === icon ? 'bg-indigo-500/20 ring-2 ring-indigo-500 scale-110' : 'hover:bg-muted'}`}>
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex gap-2">
                                {GOAL_COLORS.map(c => (
                                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                                        className={`w-6 h-6 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-card scale-110' : ''}`}
                                        style={{ backgroundColor: c, ringColor: c }} />
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Target Amount</Label>
                                <Input type="number" step="0.01" min="0" className="bg-background border-border" value={form.target_amount} onChange={e => setForm({ ...form, target_amount: e.target.value })} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Saved So Far</Label>
                                <Input type="number" step="0.01" min="0" className="bg-background border-border" value={form.saved_amount} onChange={e => setForm({ ...form, saved_amount: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Target Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Input type="date" className="bg-background border-border" value={form.target_date || ''} onChange={e => setForm({ ...form, target_date: e.target.value })} />
                        </div>
                        <DialogFooter className="pt-4 border-t border-border flex justify-between w-full">
                            {editItem ? (
                                <div className="flex justify-between w-full">
                                    <Button type="button" variant="destructive" onClick={() => { handleDelete(editItem.id); setOpenDialog(false); }}><Trash2 className="w-4 h-4 mr-2" />Delete</Button>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => setOpenDialog(false)}>Cancel</Button>
                                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Save</Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => setOpenDialog(false)}>Cancel</Button>
                                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Create Goal</Button>
                                </>
                            )}
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Contribute Dialog */}
            <Dialog open={!!openContribute} onOpenChange={() => setOpenContribute(null)}>
                <DialogContent className="bg-card border-border text-card-foreground sm:max-w-xs">
                    <DialogHeader><DialogTitle>Add to "{openContribute?.name}"</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Amount to Add</Label>
                            <Input type="number" step="0.01" min="0" className="bg-background border-border" value={contributeAmount} onChange={e => setContributeAmount(e.target.value)} placeholder="500" autoFocus />
                        </div>
                        {openContribute && (
                            <div className="bg-muted/50 rounded-xl p-3 text-sm text-muted-foreground">
                                Progress: {fmt(openContribute.saved_amount)} → {contributeAmount ? fmt(parseFloat(openContribute.saved_amount) + parseFloat(contributeAmount)) : '—'} / {fmt(openContribute.target_amount)}
                            </div>
                        )}
                        <DialogFooter>
                            <Button variant="ghost" className="text-muted-foreground" onClick={() => setOpenContribute(null)}>Cancel</Button>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleContribute}>Add Money</Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
