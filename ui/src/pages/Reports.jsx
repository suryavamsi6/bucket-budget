import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    AreaChart, Area, LineChart, Line,
    Sankey as RechartsSankey, Rectangle
} from 'recharts';
import { getSpendingByCategory, getIncomeVsExpense, getNetWorth, getBudgetVsActual, getSpendingTrend, getSankeyData, getExportTransactionsUrl } from '../api/client.js';
import { Download, Bot } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useSettings } from '../hooks/useSettings.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

const COLORS = ['#818cf8', '#34d399', '#fb7185', '#fbbf24', '#60a5fa', '#a78bfa', '#fb923c', '#f472b6', '#2dd4bf', '#e879f9'];
const tooltipStyle = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' };

function SankeyNode({ x, y, width, height, index, payload }) {
    return (
        <Rectangle
            x={x}
            y={y}
            width={width}
            height={height}
            fill={COLORS[index % COLORS.length]}
            fillOpacity={0.9}
            rx={3}
            ry={3}
            className="transition-all duration-300 hover:fill-opacity-100"
        />
    );
}

function SankeyLink({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index }) {
    return (
        <path
            d={`
        M${sourceX},${sourceY + linkWidth / 2}
        C${sourceControlX},${sourceY + linkWidth / 2}
          ${targetControlX},${targetY + linkWidth / 2}
          ${targetX},${targetY + linkWidth / 2}
        L${targetX},${targetY - linkWidth / 2}
        C${targetControlX},${targetY - linkWidth / 2}
          ${sourceControlX},${sourceY - linkWidth / 2}
          ${sourceX},${sourceY - linkWidth / 2}
        Z
      `}
            fill={COLORS[index % COLORS.length]}
            fillOpacity={0.2}
            stroke={COLORS[index % COLORS.length]}
            strokeWidth={0}
            className="transition-all duration-300 hover:fill-opacity-40"
        />
    );
}

export default function Reports() {
    const { fmt, fmtCompact } = useSettings();
    const navigate = useNavigate();
    const [spending, setSpending] = useState([]);
    const [incVsExp, setIncVsExp] = useState([]);
    const [netWorth, setNetWorth] = useState([]);
    const [budgetActual, setBudgetActual] = useState([]);
    const [trendData, setTrendData] = useState({ data: [], categories: [] });
    const [sankeyData, setSankeyData] = useState(null);
    const [loading, setLoading] = useState(true);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthLabel = new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    useEffect(() => {
        Promise.all([
            getSpendingByCategory({}),
            getIncomeVsExpense(12),
            getNetWorth(12),
            getBudgetVsActual(currentMonth),
            getSpendingTrend(6),
            getSankeyData(currentMonth)
        ]).then(([sp, ie, nw, ba, tr, sk]) => {
            setSpending(sp);
            setIncVsExp(ie);
            setNetWorth(nw);
            setBudgetActual(ba.filter(b => b.budgeted > 0 || b.actual > 0));
            setTrendData(tr);
            setSankeyData(sk && sk.links && sk.links.length > 0 ? sk : null);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [currentMonth]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                <p className="text-muted-foreground font-medium">Loading reports...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Financial Insights</h2>
                    <p className="text-muted-foreground">Analyze your spending habits and financial health.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:text-foreground"
                        onClick={() => { const a = document.createElement('a'); a.href = getExportTransactionsUrl(); a.click(); }}>
                        <Download className="w-4 h-4 mr-2" /> Export CSV
                    </Button>
                    <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white"
                        onClick={() => navigate('/ai')}>
                        <Bot className="w-4 h-4 mr-2" /> AI Advisor
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Sankey Flow Chart */}
                {sankeyData && sankeyData.links.length > 0 && (
                    <Card className="col-span-1 lg:col-span-2 bg-card border-border shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
                                <span className="text-xl">💸</span> Money Flow
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                Income → Category Groups → Categories for {monthLabel}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="h-[400px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsSankey
                                        data={sankeyData}
                                        node={<SankeyNode />}
                                        link={<SankeyLink />}
                                        nodePadding={30}
                                        nodeWidth={12}
                                        margin={{ top: 10, right: 120, bottom: 10, left: 10 }}
                                    >
                                        <Tooltip contentStyle={tooltipStyle} formatter={(val) => fmt(val)} itemStyle={{ color: '#f8fafc' }} />
                                    </RechartsSankey>
                                </ResponsiveContainer>
                            </div>
                            {/* Sankey Legend */}
                            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 justify-center">
                                {sankeyData.nodes.map((node, i) => (
                                    <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                        <span>{node.name}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Spending by Category - Donut */}
                <Card className="bg-card border-border shadow-sm flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-card-foreground">Spending by Category</CardTitle>
                        <CardDescription className="text-muted-foreground">All-time categorised spending</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 flex-grow flex flex-col justify-center">
                        {spending.length > 0 ? (
                            <>
                                <div className="h-[280px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={spending} dataKey="total" nameKey="category" cx="50%" cy="50%"
                                                innerRadius={70} outerRadius={110} paddingAngle={2} stroke="transparent">
                                                {spending.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} className="transition-all duration-300 hover:opacity-80 drop-shadow-sm" />)}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} formatter={(val) => fmt(val)} itemStyle={{ color: '#f8fafc' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 justify-center">
                                    {spending.map((s, i) => (
                                        <div key={i} className="flex items-center gap-1.5 text-xs">
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                            <span className="text-muted-foreground">{s.category || 'Uncategorized'}</span>
                                            <span className="font-semibold text-foreground/80 font-mono">{fmt(s.total)}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                <div className="rounded-full bg-muted/50 p-3 mb-3">
                                    <span className="text-2xl block">📊</span>
                                </div>
                                <p>No spending data available</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Income vs Expenses - Bar Chart */}
                <Card className="bg-card border-border shadow-sm flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-card-foreground">Income vs Expenses</CardTitle>
                        <CardDescription className="text-muted-foreground">Last 12 months overview</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 flex-grow flex flex-col justify-center">
                        {incVsExp.length > 0 ? (
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={incVsExp} barGap={4} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="month" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={fmtCompact} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(val) => fmt(val)} cursor={{ fill: '#1e293b' }} itemStyle={{ color: '#f8fafc' }} />
                                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                        <Bar dataKey="income" fill="#34d399" radius={[4, 4, 0, 0]} name="Income" maxBarSize={40} />
                                        <Bar dataKey="expenses" fill="#fb7185" radius={[4, 4, 0, 0]} name="Expenses" maxBarSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                <div className="rounded-full bg-muted/50 p-3 mb-3">
                                    <span className="text-2xl block">📉</span>
                                </div>
                                <p>No income/expense data available</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Net Worth - Area Chart */}
                <Card className="col-span-1 lg:col-span-2 bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-card-foreground">Net Worth Trend</CardTitle>
                        <CardDescription className="text-muted-foreground">Your total wealth over the last 12 months</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {netWorth.length > 0 ? (
                            <div className="h-[320px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={netWorth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="month" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={fmtCompact} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(val) => fmt(val)} itemStyle={{ color: '#818cf8' }} />
                                        <Area type="monotone" dataKey="net_worth" stroke="#818cf8" fill="url(#netWorthGrad)" strokeWidth={3} name="Net Worth" activeDot={{ r: 6, strokeWidth: 0 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                <div className="rounded-full bg-muted/50 p-3 mb-3">
                                    <span className="text-2xl block">📈</span>
                                </div>
                                <p>No net worth data available</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Spending Trend - Multi-line */}
                <Card className="col-span-1 lg:col-span-2 bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-card-foreground">Category Spending Trends</CardTitle>
                        <CardDescription className="text-muted-foreground">How your top expenses change over time</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {trendData.data.length > 0 ? (
                            <div className="h-[360px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="month" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={fmtCompact} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(val) => fmt(val)} itemStyle={{ color: '#f8fafc' }} />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        {trendData.categories.slice(0, 8).map((cat, i) => (
                                            <Line key={cat} type="monotone" dataKey={cat} stroke={COLORS[i % COLORS.length]}
                                                strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} name={cat} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                <div className="rounded-full bg-muted/50 p-3 mb-3">
                                    <span className="text-2xl block">📉</span>
                                </div>
                                <p>No trend data available</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Budget vs Actual - Horizontal Bar */}
                <Card className="col-span-1 lg:col-span-2 bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-card-foreground">Budget vs Actual</CardTitle>
                        <CardDescription className="text-muted-foreground">Progress against targets for {monthLabel}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {budgetActual.length > 0 ? (
                            <div className="w-full" style={{ height: Math.max(300, budgetActual.length * 45) }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={budgetActual} layout="vertical" barGap={2} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                        <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={fmtCompact} axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="category" stroke="#cbd5e1" tick={{ fill: '#cbd5e1', fontSize: 13, fontWeight: 500 }} width={120} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={tooltipStyle} formatter={(val) => fmt(val)} cursor={{ fill: '#1e293b' }} itemStyle={{ color: '#f8fafc' }} />
                                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                        <Bar dataKey="budgeted" fill="#818cf8" radius={[0, 4, 4, 0]} name="Budgeted" barSize={12} />
                                        <Bar dataKey="actual" fill="#fb923c" radius={[0, 4, 4, 0]} name="Actual" barSize={12} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                <div className="rounded-full bg-muted/50 p-3 mb-3">
                                    <span className="text-2xl block">🎯</span>
                                </div>
                                <p>No budget data available for this month</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
