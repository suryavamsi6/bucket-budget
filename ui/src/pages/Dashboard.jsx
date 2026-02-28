import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Wallet, ArrowRight, CheckCircle, AlertCircle, Clock, Target, Landmark, Lightbulb } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getAccounts, getTransactions, getBudgetSummary, getSpendingByCategory, getAgeOfMoney, getInsights, getGoals, getInvestments, getDebts } from '../api/client.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

const COLORS = ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#f97316', '#ec4899'];

export default function Dashboard() {
    const { fmt } = useSettings();
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState(null);
    const [spending, setSpending] = useState([]);
    const [ageOfMoney, setAgeOfMoney] = useState(null);
    const [insights, setInsights] = useState([]);
    const [goals, setGoals] = useState([]);
    const [investments, setInvestments] = useState([]);
    const [debts, setDebts] = useState([]);
    const [loading, setLoading] = useState(true);

    const currentMonth = new Date().toISOString().slice(0, 7);

    useEffect(() => {
        Promise.all([
            getAccounts(),
            getTransactions({ limit: 8 }),
            getBudgetSummary(currentMonth),
            getSpendingByCategory({ from: `${currentMonth}-01`, to: `${currentMonth}-31` }),
            getAgeOfMoney(),
            getInsights().catch(() => []),
            getGoals().catch(() => []),
            getInvestments().catch(() => []),
            getDebts().catch(() => [])
        ]).then(([acc, txn, sum, spend, age, ins, gls, inv, dbt]) => {
            setAccounts(acc);
            setTransactions(txn.data);
            setSummary(sum);
            setSpending(spend);
            setAgeOfMoney(age);
            setInsights(ins);
            setGoals(gls);
            setInvestments(inv);
            setDebts(dbt);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const totalBalance = accounts.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);
    const netWorthAccounts = accounts.filter(a => !a.closed);

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground/80">Net Worth</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${totalBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {fmt(totalBalance)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{netWorthAccounts.length} active accounts</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-indigo-500/90 via-purple-600/90 to-blue-600/90 border-none shadow-lg shadow-indigo-500/20 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/5 opacity-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-white/5 to-transparent mix-blend-overlay"></div>
                    <CardHeader className="pb-2 relative z-10">
                        <CardTitle className="text-sm font-medium text-indigo-100">To Be Budgeted</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">
                            {fmt(summary?.to_be_budgeted)}
                        </div>
                        <p className="text-xs text-indigo-200 mt-1 font-medium">Available to assign</p>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground/80">Income</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">{fmt(summary?.month_income)}</div>
                        <p className="text-xs text-muted-foreground mt-1">This month</p>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground/80">Expenses</CardTitle>
                        <TrendingDown className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-500">{fmt(summary?.month_expenses)}</div>
                        <p className="text-xs text-muted-foreground mt-1">This month</p>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground/80">Age of Money</CardTitle>
                        <Clock className="h-4 w-4 text-indigo-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-card-foreground">
                            {ageOfMoney ? `${ageOfMoney.age}d` : '—'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Days money sits</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg font-semibold">Accounts</CardTitle>
                        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-primary hover:bg-muted">
                            <Link to="/accounts">View all <ArrowRight className="ml-2 h-4 w-4" /></Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 pt-4">
                            {accounts.length > 0 ? accounts.map(acc => (
                                <div key={acc.id} className="flex items-center justify-between border-b border-border/60 pb-4 last:border-0 last:pb-0 hover:bg-muted/30 p-2 rounded-xl transition-colors">
                                    <div className="flex items-center space-x-4">
                                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center border border-border/50">
                                            <Wallet className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold leading-none text-card-foreground">{acc.name}</p>
                                            <p className="text-xs text-muted-foreground mt-1 capitalize">{acc.type.replace('_', ' ')}</p>
                                        </div>
                                    </div>
                                    <div className={`font-mono text-sm font-semibold tracking-tight ${parseFloat(acc.balance) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {fmt(acc.balance)}
                                    </div>
                                </div>
                            )) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No accounts yet</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold">Spending This Month</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center h-full pb-6">
                        {spending.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={spending}
                                            dataKey="total"
                                            nameKey="category"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={65}
                                            outerRadius={95}
                                            paddingAngle={4}
                                            stroke="none"
                                        >
                                            {spending.map((_, i) => (
                                                <Cell key={i} fill={COLORS[i % COLORS.length]} className="hover:opacity-80 transition-opacity" />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', color: 'hsl(var(--card-foreground))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            itemStyle={{ color: 'hsl(var(--card-foreground))', fontWeight: 500 }}
                                            formatter={(value) => fmt(value)}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 w-full px-2">
                                    {spending.slice(0, 6).map((s, i) => (
                                        <div key={i} className="flex items-center space-x-2 bg-muted/30 p-1.5 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors">
                                            <div className="h-3 w-3 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                            <span className="text-xs font-medium text-foreground/80 truncate" title={s.category || 'Uncategorized'}>
                                                {s.category || 'Uncategorized'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-[250px]">
                                <p className="text-sm text-muted-foreground">No spending data this month</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-card border-border shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
                    <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-primary hover:bg-muted">
                        <Link to="/transactions">View all <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50">
                        <Table>
                            <TableHeader className="bg-muted/50 backdrop-blur-sm">
                                <TableRow className="border-border/50 hover:bg-transparent">
                                    <TableHead className="text-muted-foreground font-semibold">Date</TableHead>
                                    <TableHead className="text-muted-foreground font-semibold">Payee</TableHead>
                                    <TableHead className="text-muted-foreground font-semibold">Category</TableHead>
                                    <TableHead className="text-muted-foreground font-semibold">Account</TableHead>
                                    <TableHead className="text-right text-muted-foreground font-semibold">Amount</TableHead>
                                    <TableHead className="text-center text-muted-foreground font-semibold w-[80px]">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map(txn => (
                                    <TableRow key={txn.id} className="border-border/50 hover:bg-muted/50 transition-colors">
                                        <TableCell className="text-muted-foreground font-medium">{txn.date}</TableCell>
                                        <TableCell className="text-card-foreground font-medium">{txn.payee || '—'}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                                                {txn.category_name || '—'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{txn.account_name}</TableCell>
                                        <TableCell className={`text-right font-mono font-semibold tracking-tight ${parseFloat(txn.amount) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {fmt(txn.amount)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {txn.cleared ?
                                                <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" /> :
                                                <AlertCircle className="h-4 w-4 text-amber-500 mx-auto" />
                                            }
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {transactions.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            No recent transactions found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Widgets Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Insights Widget */}
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Insights</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {insights.length > 0 ? (
                            <div className="space-y-2">
                                {insights.slice(0, 4).map((insight, i) => (
                                    <div key={i} className={`p-3 rounded-xl text-xs ${insight.severity === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                                            insight.severity === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                                                'bg-indigo-500/10 text-indigo-400'
                                        }`}>
                                        <div className="font-semibold">{insight.icon} {insight.title}</div>
                                        <div className="mt-0.5 opacity-80">{insight.description}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-6">No insights yet — add some transactions!</p>
                        )}
                    </CardContent>
                </Card>

                {/* Goals Widget */}
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-indigo-500" /> Goals</CardTitle>
                        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-primary hover:bg-muted">
                            <Link to="/goals">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {goals.filter(g => g.status === 'active').length > 0 ? (
                            <div className="space-y-3">
                                {goals.filter(g => g.status === 'active').slice(0, 3).map(goal => {
                                    const pct = parseFloat(goal.target_amount) > 0 ? Math.min(100, (parseFloat(goal.saved_amount) / parseFloat(goal.target_amount)) * 100) : 0;
                                    return (
                                        <div key={goal.id}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-medium text-foreground/80">{goal.icon} {goal.name}</span>
                                                <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                                            </div>
                                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: goal.color || '#6366f1' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-6">No active goals — <Link to="/goals" className="text-indigo-500 hover:underline">create one</Link></p>
                        )}
                    </CardContent>
                </Card>

                {/* Portfolio + Debt Widget */}
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-semibold">Portfolio & Debt</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {investments.length > 0 && (
                            <div>
                                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Investments</div>
                                <div className="text-xl font-bold text-emerald-500">
                                    {fmt(investments.reduce((s, inv) => s + parseFloat(inv.quantity) * parseFloat(inv.current_price), 0))}
                                </div>
                                <div className="text-[10px] text-muted-foreground">{investments.length} assets tracked</div>
                            </div>
                        )}
                        {debts.length > 0 && (
                            <div>
                                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Landmark className="w-3 h-3" /> Total Debt</div>
                                <div className="text-xl font-bold text-rose-500">
                                    {fmt(debts.reduce((s, d) => s + parseFloat(d.balance), 0))}
                                </div>
                                <div className="text-[10px] text-muted-foreground">{debts.length} debts tracked</div>
                            </div>
                        )}
                        {investments.length === 0 && debts.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-6">Track <Link to="/investments" className="text-indigo-500 hover:underline">investments</Link> or <Link to="/debts" className="text-indigo-500 hover:underline">debts</Link></p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
