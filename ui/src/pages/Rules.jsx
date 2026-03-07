import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Save, X, AlertCircle } from 'lucide-react';
import { getRules, createRule, updateRule, deleteRule, getCategoryGroups } from '../api/client.js';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Label } from '../components/ui/label';

export default function Rules() {
    const [rules, setRules] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({
        match_field: 'payee',
        match_type: 'contains',
        match_value: '',
        set_category_id: '',
        set_payee: '',
        set_cleared: true,
        priority: 0
    });

    const loadData = async () => {
        try {
            setLoading(true);
            const [rulesData, groupsData] = await Promise.all([
                getRules(),
                getCategoryGroups()
            ]);
            setRules(rulesData);

            const cats = [];
            groupsData.forEach(g => {
                g.categories?.forEach(c => cats.push({ ...c, group_name: g.name }));
            });
            setCategories(cats);
        } catch (err) {
            console.error('Failed to load rules data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const resetForm = () => {
        setIsEditing(false);
        setEditId(null);
        setForm({
            match_field: 'payee',
            match_type: 'contains',
            match_value: '',
            set_category_id: '',
            set_payee: '',
            set_cleared: true,
            priority: 0
        });
    };

    const handleEdit = (rule) => {
        setIsEditing(true);
        setEditId(rule.id);
        setForm({
            match_field: rule.match_field,
            match_type: rule.match_type,
            match_value: rule.match_value,
            set_category_id: rule.set_category_id || '',
            set_payee: rule.set_payee || '',
            set_cleared: rule.set_cleared,
            priority: rule.priority
        });
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this rule?')) return;
        try {
            await deleteRule(id);
            setRules(rules.filter(r => r.id !== id));
        } catch (err) {
            console.error('Failed to delete rule', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                set_category_id: form.set_category_id ? parseInt(form.set_category_id) : null,
                priority: parseInt(form.priority) || 0
            };

            if (isEditing) {
                await updateRule(editId, payload);
            } else {
                await createRule(payload);
            }
            resetForm();
            loadData();
        } catch (err) {
            console.error('Failed to save rule', err);
            alert('Failed to save rule');
        }
    };

    const getCategoryName = (id) => {
        if (!id) return '—';
        const cat = categories.find(c => c.id === id);
        return cat ? `${cat.group_name} > ${cat.name}` : 'Unknown';
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-medium tracking-tight text-foreground">Import Rules</h1>
                <p className="text-muted-foreground mt-2">
                    Automate categorization and payee renaming during CSV imports.
                </p>
            </div>

            <Card className="bg-surface-container-low border-outline-variant/30 shadow-sm">
                <CardHeader>
                    <CardTitle>{isEditing ? 'Edit Rule' : 'Create New Rule'}</CardTitle>
                    <CardDescription>Rules run automatically when uploading a CSV file.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 rounded-xl border border-primary/20 bg-primary/5">
                            <div className="space-y-2">
                                <Label>If this column...</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                    value={form.match_field}
                                    onChange={e => setForm({ ...form, match_field: e.target.value })}
                                >
                                    <option value="payee">Payee / Description</option>
                                    <option value="amount">Amount</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>...Matches</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                    value={form.match_type}
                                    onChange={e => setForm({ ...form, match_type: e.target.value })}
                                >
                                    {form.match_field === 'payee' ? (
                                        <>
                                            <option value="contains">Contains</option>
                                            <option value="equals">Equals Exact</option>
                                            <option value="starts_with">Starts With</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="equals">Equals Exact</option>
                                            <option value="less_than">Is Less Than</option>
                                            <option value="greater_than">Is Greater Than</option>
                                        </>
                                    )}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>...This Value</Label>
                                <Input
                                    required
                                    placeholder={form.match_field === 'amount' ? "e.g. 50.00" : "e.g. WALMART"}
                                    value={form.match_value}
                                    onChange={e => setForm({ ...form, match_value: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl border border-secondary bg-secondary/10">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Then set Category to:</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                                        value={form.set_category_id}
                                        onChange={e => setForm({ ...form, set_category_id: e.target.value })}
                                    >
                                        <option value="">(Leave unchanged)</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.group_name} - {cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2 flex items-center gap-2 pt-2">
                                    <input
                                        type="checkbox"
                                        id="set_cleared"
                                        className="h-4 w-4 rounded border-outline-variant/30 text-primary focus:ring-primary"
                                        checked={form.set_cleared}
                                        onChange={e => setForm({ ...form, set_cleared: e.target.checked })}
                                    />
                                    <Label htmlFor="set_cleared" className="cursor-pointer">Mark transaction as Cleared</Label>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>And rename Payee to: (Optional)</Label>
                                    <Input
                                        placeholder="e.g. Clean Walmart"
                                        value={form.set_payee}
                                        onChange={e => setForm({ ...form, set_payee: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Execution Priority (Higher runs first)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={form.priority}
                                        onChange={e => setForm({ ...form, priority: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/30">
                            {isEditing && (
                                <Button type="button" variant="outline" onClick={resetForm}>
                                    <X className="w-4 h-4 mr-2" /> Cancel
                                </Button>
                            )}
                            <Button type="submit">
                                {isEditing ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                {isEditing ? 'Save Changes' : 'Create Rule'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card className="bg-surface-container-low border-outline-variant/30 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-surface-container/50">
                        <TableRow>
                            <TableHead className="w-[80px]">Priority</TableHead>
                            <TableHead>Condition</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead className="text-right">Manage</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rules.map(rule => (
                            <TableRow key={rule.id}>
                                <TableCell className="font-mono text-muted-foreground">{rule.priority}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold capitalize">{rule.match_field}</span>
                                        <span className="text-muted-foreground text-sm italic">{rule.match_type.replace('_', ' ')}</span>
                                        <span className="bg-secondary px-2 py-0.5 rounded text-secondary-foreground text-sm font-medium">"{rule.match_value}"</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="text-sm space-y-1">
                                        {rule.set_category_id && (
                                            <div><span className="text-muted-foreground mr-1">Category &rarr;</span> {getCategoryName(rule.set_category_id)}</div>
                                        )}
                                        {rule.set_payee && (
                                            <div><span className="text-muted-foreground mr-1">Payee &rarr;</span> {rule.set_payee}</div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)} aria-label="Edit rule">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(rule.id)} aria-label="Delete rule">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {rules.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
                                        <p>No import rules configured yet.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>

        </div>
    );
}
