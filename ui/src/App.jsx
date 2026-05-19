import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wallet, ArrowLeftRight, PiggyBank, BarChart3, Settings as SettingsIcon, Menu, X, RefreshCw, TrendingUp, LogOut, Sun, Moon, Target, Landmark, CalendarDays, Bot, Sparkles, Plus, Keyboard } from 'lucide-react';
import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SettingsProvider } from './hooks/useSettings.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { useTheme } from './components/ThemeProvider.jsx';
import { useKeyboardShortcuts, SHORTCUT_MAP } from './hooks/useKeyboardShortcuts.jsx';
import QuickEntry from './components/QuickEntry.jsx';
import OnboardingCoach from './components/OnboardingCoach.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Budget from './pages/Budget.jsx';
import Accounts from './pages/Accounts.jsx';
import Transactions from './pages/Transactions.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Subscriptions from './pages/Subscriptions.jsx';
import Investments from './pages/Investments.jsx';
import Goals from './pages/Goals.jsx';
import Debts from './pages/Debts.jsx';
import BillCalendar from './pages/BillCalendar.jsx';
import AiAdvisor from './pages/AiAdvisor.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Rules from './pages/Rules.jsx';
import { Button } from './components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';
import { cn } from './lib/utils.js';

const MAIN_NAV = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/budget', label: 'Budget', icon: PiggyBank },
    { to: '/accounts', label: 'Accounts', icon: Wallet },
    { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
    { to: '/reports', label: 'Reports', icon: BarChart3 }
];

const FEATURE_NAV = [
    { to: '/rules', label: 'Import Rules', icon: RefreshCw },
    { to: '/subscriptions', label: 'Subscriptions', icon: RefreshCw },
    { to: '/investments', label: 'Investments', icon: TrendingUp },
    { to: '/goals', label: 'Goals', icon: Target },
    { to: '/debts', label: 'Debts', icon: Landmark },
    { to: '/calendar', label: 'Bill Calendar', icon: CalendarDays },
    { to: '/ai', label: 'AI Advisor', icon: Bot }
];

function SidebarLink({ to, label, icon: Icon, onClose, end = false }) {
    return (
        <NavLink
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}
        >
            <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
            <span className="font-medium">{label}</span>
        </NavLink>
    );
}

function Sidebar({ isOpen, onClose }) {
    const { logout } = useAuth();

    return (
        <aside className={cn(
            'fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform duration-300 ease-out md:static md:z-auto md:m-3 md:mr-0 md:flex md:h-[calc(100vh-1.5rem)] md:translate-x-0 md:flex-col',
            'bg-surface-container-low rounded-2xl',
            isOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
            <div className="flex h-16 items-center px-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="font-display text-lg font-bold text-card-foreground">Oasis</p>
                        <p className="text-[11px] font-medium tracking-wide text-muted-foreground">Personal Finance</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto py-3">
                <nav className="flex-1 space-y-0.5 px-3">
                    <p className="px-4 pb-1 pt-4 text-[11px] font-medium tracking-wider text-muted-foreground">Core</p>
                    {MAIN_NAV.map(item => (
                        <SidebarLink key={item.to} {...item} onClose={onClose} />
                    ))}

                    <div className="mx-4 my-3 h-px bg-outline-variant/50" />
                    <p className="px-4 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground">Features</p>
                    {FEATURE_NAV.map(item => (
                        <SidebarLink key={item.to} {...item} onClose={onClose} />
                    ))}
                </nav>
            </div>

            <div className="space-y-0.5 p-3">
                <div className="mx-4 mb-2 h-px bg-outline-variant/50" />
                <SidebarLink to="/settings" label="Settings" icon={SettingsIcon} onClose={onClose} />
                <button
                    onClick={() => {
                        logout();
                        onClose();
                    }}
                    className="nav-link w-full hover:bg-error-container hover:text-on-error-container"
                >
                    <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
                    Sign out
                </button>
            </div>
        </aside>
    );
}

const PAGE_TITLES = {
    '/': 'Dashboard',
    '/budget': 'Budget',
    '/accounts': 'Accounts',
    '/transactions': 'Transactions',
    '/reports': 'Reports',
    '/settings': 'Settings',
    '/subscriptions': 'Subscriptions',
    '/investments': 'Investments',
    '/goals': 'Goals',
    '/debts': 'Debts',
    '/calendar': 'Bill Calendar',
    '/ai': 'AI Advisor',
    '/rules': 'Import Rules'
};

function ProtectedLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [quickEntryOpen, setQuickEntryOpen] = useState(false);
    const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const { theme, setTheme } = useTheme();
    const appearanceCycle = ['dark', 'midnight', 'amoled'];
    const pageTitle = PAGE_TITLES[location.pathname] || 'Oasis';
    const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Global keyboard shortcuts
    useKeyboardShortcuts({
        'ctrl+n': () => setQuickEntryOpen(true),
        'ctrl+shift+t': () => navigate('/transactions'),
        'ctrl+shift+b': () => navigate('/budget'),
        'ctrl+shift+a': () => navigate('/accounts'),
        'ctrl+shift+r': () => navigate('/reports'),
        'ctrl+shift+s': () => navigate('/settings'),
        'ctrl+shift+d': () => navigate('/'),
        'ctrl+/': () => setShortcutsHelpOpen(true),
        'escape': () => { setQuickEntryOpen(false); setShortcutsHelpOpen(false); }
    });

    if (loading) {
        return <div className="flex h-screen items-center justify-center text-card-foreground">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="app-shell flex h-screen overflow-hidden text-card-foreground">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-foreground/32 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="relative flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 lg:px-6">
                    <div className="flex h-16 items-center justify-between rounded-2xl bg-surface-container-low px-4 sm:px-5">
                        <div className="flex min-w-0 items-center gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-full text-muted-foreground hover:text-foreground md:hidden"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                                aria-label="Toggle sidebar menu"
                                aria-expanded={sidebarOpen}
                            >
                                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </Button>
                            <div className="min-w-0">
                                <h1 className="truncate font-display text-[22px] font-medium text-card-foreground">{pageTitle}</h1>
                                <p className="text-[11px] font-medium tracking-wide text-muted-foreground">{todayLabel}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    const currentIndex = appearanceCycle.indexOf(theme);
                                    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % appearanceCycle.length : 0;
                                    setTheme(appearanceCycle[nextIndex]);
                                }}
                                className="rounded-full text-muted-foreground hover:text-foreground"
                                aria-label="Toggle theme"
                            >
                                <Moon className="h-5 w-5" />
                            </Button>
                            <div className="hidden rounded-full bg-surface-container-high px-4 py-2 text-sm font-medium text-muted-foreground sm:block">
                                {user.name}
                            </div>
                            <Avatar className="h-9 w-9 border border-outline-variant">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} />
                                <AvatarFallback className="bg-primary-container text-on-primary-container">{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pb-6 pt-4 overflow-x-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 15, scale: 0.99 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -15, scale: 1.01 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="mx-auto w-full max-w-[1400px] px-3 sm:px-5 lg:px-8"
                        >
                            <Routes location={location}>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/budget" element={<Budget />} />
                                <Route path="/accounts" element={<Accounts />} />
                                <Route path="/transactions" element={<Transactions />} />
                                <Route path="/reports" element={<Reports />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/subscriptions" element={<Subscriptions />} />
                                <Route path="/investments" element={<Investments />} />
                                <Route path="/goals" element={<Goals />} />
                                <Route path="/debts" element={<Debts />} />
                                <Route path="/calendar" element={<BillCalendar />} />
                                <Route path="/ai" element={<AiAdvisor />} />
                                <Route path="/rules" element={<Rules />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>

            {/* M3 FAB - Large, surface-container with primary icon */}
            <button
                onClick={() => setQuickEntryOpen(true)}
                className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container shadow-lg hover:shadow-xl transition-all active:scale-95"
                title="Quick Add (Ctrl+N)"
                aria-label="Quick Add"
                aria-keyshortcuts="Control+n"
            >
                <Plus className="h-6 w-6" />
            </button>

            <QuickEntry open={quickEntryOpen} onOpenChange={setQuickEntryOpen} />
            <OnboardingCoach />

            {/* Keyboard Shortcuts Help Dialog */}
            <Dialog open={shortcutsHelpOpen} onOpenChange={setShortcutsHelpOpen}>
                    <DialogContent className="sm:max-w-sm bg-surface-container-high">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Keyboard className="h-5 w-5" />
                            Keyboard Shortcuts
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        {Object.entries(
                            Object.entries(SHORTCUT_MAP).reduce((acc, [key, val]) => {
                                if (!acc[val.section]) acc[val.section] = [];
                                acc[val.section].push({ key, ...val });
                                return acc;
                            }, {})
                        ).map(([section, shortcuts]) => (
                            <div key={section}>
                                <p className="text-[11px] font-medium tracking-wider text-muted-foreground mb-1.5">{section}</p>
                                {shortcuts.map(s => (
                                    <div key={s.key} className="flex items-center justify-between py-1">
                                        <span className="text-sm">{s.label}</span>
                                        <kbd className="text-xs px-2 py-0.5 rounded-sm bg-surface-container-highest font-mono">{s.key}</kbd>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function PublicRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="flex h-screen items-center justify-center text-card-foreground">Loading...</div>;
    if (user) return <Navigate to="/" replace />;
    return children;
}

function AppContent() {
    const location = useLocation();

    // Group all authenticated routes under a single key so the layout doesn't unmount
    const authRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
    const isAuthRoute = authRoutes.includes(location.pathname);
    const topLevelKey = isAuthRoute ? location.pathname : 'app';

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={topLevelKey}>
                <Route path="/login" element={
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                        <PublicRoute><Login /></PublicRoute>
                    </motion.div>
                } />
                <Route path="/register" element={
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                        <PublicRoute><Register /></PublicRoute>
                    </motion.div>
                } />
                <Route path="/forgot-password" element={
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                        <PublicRoute><ForgotPassword /></PublicRoute>
                    </motion.div>
                } />
                <Route path="/reset-password" element={
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                        <PublicRoute><ResetPassword /></PublicRoute>
                    </motion.div>
                } />
                <Route path="/*" element={
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full w-full">
                        <ProtectedLayout />
                    </motion.div>
                } />
            </Routes>
        </AnimatePresence>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <SettingsProvider>
                <BrowserRouter>
                    <AppContent />
                </BrowserRouter>
            </SettingsProvider>
        </AuthProvider>
    );
}
