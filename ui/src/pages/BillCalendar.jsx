import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CreditCard, Repeat } from 'lucide-react';
import { getSubscriptions } from '../api/client.js';
import { useSettings } from '../hooks/useSettings.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function BillCalendar() {
    const { fmt } = useSettings();
    const [subs, setSubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try { setSubs(await getSubscriptions()); } catch (e) { console.error(e); }
        setLoading(false);
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const today = new Date();

    // Map subscriptions to their due days
    const billsByDay = useMemo(() => {
        const map = {};
        for (const sub of subs) {
            if (sub.status !== 'active') continue;
            let day = null;
            if (sub.next_due_date) {
                const due = new Date(sub.next_due_date);
                if (due.getMonth() === month && due.getFullYear() === year) {
                    day = due.getDate();
                }
            }
            // For monthly subscriptions, also check billing_day
            if (!day && sub.frequency === 'monthly' && sub.billing_day) {
                day = parseInt(sub.billing_day);
            }
            if (day && day >= 1 && day <= daysInMonth) {
                if (!map[day]) map[day] = [];
                map[day].push(sub);
            }
        }
        return map;
    }, [subs, month, year, daysInMonth]);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToday = () => setCurrentDate(new Date());

    const totalThisMonth = Object.values(billsByDay).flat().reduce((s, sub) => s + Math.abs(parseFloat(sub.amount || 0)), 0);
    const billCount = Object.values(billsByDay).flat().length;

    // Calendar grid
    const cells = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-2xl text-amber-600"><CalendarDays className="h-6 w-6" /></div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Bill Calendar</h2>
                        <p className="text-muted-foreground">See when your bills and subscriptions are due.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card className="bg-gradient-to-br from-amber-500/90 via-orange-500/90 to-red-500/90 border-none shadow-lg text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/5 opacity-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-white/5 to-transparent mix-blend-overlay"></div>
                    <CardHeader className="pb-2 relative z-10">
                        <CardDescription className="text-amber-100 font-medium tracking-wide text-xs uppercase">Due This Month</CardDescription>
                        <CardTitle className="text-4xl font-bold text-white">{fmt(totalThisMonth)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium tracking-wide text-xs uppercase">Bills This Month</CardDescription>
                        <CardTitle className="text-3xl font-bold text-card-foreground">{billCount}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-card border-border shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-muted-foreground font-medium tracking-wide text-xs uppercase">Active Subscriptions</CardDescription>
                        <CardTitle className="text-3xl font-bold text-card-foreground">{subs.filter(s => s.status === 'active').length}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Card className="bg-card border-border">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
                        <h3 className="text-lg font-bold text-card-foreground min-w-[180px] text-center">{monthName}</h3>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs border-border text-muted-foreground hover:text-foreground" onClick={goToday}>Today</Button>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-16 text-muted-foreground">Loading calendar...</div>
                    ) : (
                        <div>
                            <div className="grid grid-cols-7 gap-px mb-1">
                                {WEEKDAYS.map(d => (
                                    <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-widest py-2">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-px">
                                {cells.map((day, i) => (
                                    <div key={i}
                                        className={`min-h-[80px] p-1.5 rounded-xl border transition-colors ${day ? (isToday(day) ? 'border-indigo-500 bg-indigo-500/5' : 'border-border hover:border-muted-foreground/30') : 'border-transparent'
                                            }`}>
                                        {day && (
                                            <>
                                                <div className={`text-xs font-medium mb-1 ${isToday(day) ? 'text-indigo-500 font-bold' : 'text-muted-foreground'}`}>
                                                    {day}
                                                </div>
                                                <div className="space-y-0.5">
                                                    {(billsByDay[day] || []).map((sub, j) => (
                                                        <div key={j} className="text-[9px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-md truncate font-medium" title={`${sub.name} — ${fmt(Math.abs(sub.amount))}`}>
                                                            {sub.name}
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Upcoming Bills List */}
            {Object.keys(billsByDay).length > 0 && (
                <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base text-card-foreground">Upcoming Bills This Month</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {Object.entries(billsByDay).sort(([a], [b]) => a - b).map(([day, bills]) =>
                            bills.map((sub, i) => (
                                <div key={`${day}-${i}`} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center text-xs font-bold text-amber-500">{day}</div>
                                        <div>
                                            <div className="text-sm font-medium text-foreground/80">{sub.name}</div>
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Repeat className="w-2.5 h-2.5" />{sub.frequency}</div>
                                        </div>
                                    </div>
                                    <span className="font-mono font-semibold text-sm text-foreground/80">{fmt(Math.abs(sub.amount))}</span>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
