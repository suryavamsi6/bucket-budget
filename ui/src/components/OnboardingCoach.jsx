import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronRight, Sparkles, X } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { getAccounts, getCategoryGroups, getTransactions, getBudget, getSettings, updateSettings } from '../api/client';
import { cn } from '../lib/utils';

const STEPS = [
    {
        id: 'account',
        title: 'Create your first account',
        description: 'Add a checking, savings, or credit card account to start tracking.',
        route: '/accounts',
        check: (data) => data.accounts?.length > 0
    },
    {
        id: 'categories',
        title: 'Set up budget categories',
        description: 'Organize your spending into groups like Bills, Groceries, Entertainment.',
        route: '/budget',
        check: (data) => data.categories?.length >= 3
    },
    {
        id: 'transaction',
        title: 'Add your first transaction',
        description: 'Record a purchase, income, or transfer to get your data flowing.',
        route: '/transactions',
        check: (data) => data.transactions?.length > 0
    },
    {
        id: 'budget',
        title: 'Assign money to categories',
        description: 'Give every dollar a job by assigning your income to categories this month.',
        route: '/budget',
        check: (data) => data.hasBudget
    },
    {
        id: 'explore',
        title: 'Explore reports & insights',
        description: 'Check your spending charts, net worth, and AI-powered insights.',
        route: '/reports',
        check: () => true // Always completable
    }
];

export default function OnboardingCoach() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [stepData, setStepData] = useState({});
    const [dismissed, setDismissed] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkProgress();
    }, []);

    const checkProgress = async () => {
        try {
            setLoading(true);
            const [accounts, groups, transactions, settings] = await Promise.all([
                getAccounts().catch(() => []),
                getCategoryGroups().catch(() => []),
                getTransactions({ limit: 1 }).catch(() => []),
                getSettings().catch(() => ({}))
            ]);

            const categories = groups.flatMap(g => g.categories || []);

            // Check if budget has any allocations this month
            const now = new Date();
            const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            let hasBudget = false;
            try {
                const budget = await getBudget(month);
                hasBudget = budget.some(g => g.categories?.some(c => c.assigned > 0));
            } catch { /* ignore */ }

            const data = { accounts, categories, transactions, hasBudget };
            setStepData(data);

            // Check if onboarding was already completed/dismissed
            if (settings.onboarding_completed === 'true' || settings.onboarding_completed === true) {
                setDismissed(true);
            } else {
                // Show coach if not all steps are done
                const allDone = STEPS.every(s => s.check(data));
                if (!allDone) {
                    setOpen(true);
                }
            }
        } catch {
            // Silent fail
        } finally {
            setLoading(false);
        }
    };

    const completedCount = STEPS.filter(s => s.check(stepData)).length;
    const progress = (completedCount / STEPS.length) * 100;

    const handleDismiss = async () => {
        setOpen(false);
        setDismissed(true);
        try {
            await updateSettings({ onboarding_completed: 'true' });
        } catch { /* ignore */ }
    };

    const handleStepClick = (step) => {
        setOpen(false);
        navigate(step.route);
    };

    if (dismissed || loading) return null;

    // Minimized floating badge
    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="fixed bottom-20 right-6 z-40 bg-primary text-primary-foreground rounded-full px-4 py-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 flex items-center gap-2 text-sm font-medium"
            >
                <Sparkles className="h-4 w-4" />
                Setup {completedCount}/{STEPS.length}
            </button>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Welcome to Oasis!
                    </DialogTitle>
                </DialogHeader>

                {/* Progress bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Getting started</span>
                        <span>{completedCount} of {STEPS.length} complete</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Steps */}
                <div className="space-y-1.5 mt-2">
                    {STEPS.map((step) => {
                        const done = step.check(stepData);
                        return (
                            <button
                                key={step.id}
                                onClick={() => !done && handleStepClick(step)}
                                className={cn(
                                    'w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors',
                                    done
                                        ? 'bg-primary/5 opacity-70'
                                        : 'hover:bg-accent cursor-pointer'
                                )}
                            >
                                {done ? (
                                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className={cn('text-sm font-medium', done && 'line-through text-muted-foreground')}>
                                        {step.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {step.description}
                                    </p>
                                </div>
                                {!done && <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
                            </button>
                        );
                    })}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-2">
                    <Button variant="ghost" size="sm" onClick={handleDismiss} className="flex-1">
                        Skip for now
                    </Button>
                    {completedCount === STEPS.length && (
                        <Button size="sm" onClick={handleDismiss} className="flex-1">
                            All done!
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
