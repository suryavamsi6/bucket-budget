import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Wallet, ArrowLeftRight, PiggyBank, BarChart3, Settings as SettingsIcon, Menu, X, RefreshCw, TrendingUp, LogOut, Sun, Moon, Target, Landmark, CalendarDays, Bot } from 'lucide-react';
import { useState } from 'react';
import { SettingsProvider } from './hooks/useSettings.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { useTheme } from './components/ThemeProvider.jsx';
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
import { Button } from './components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar';

function Sidebar({ isOpen, onClose }) {
    const { logout } = useAuth();

    return (
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r border-border transition-transform duration-200 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:flex md:flex-col`}>
            <div className="flex h-16 items-center flex-shrink-0 px-6 bg-card border-b border-border/50">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg shadow-sm">
                        B
                    </div>
                    <span className="text-xl font-bold text-card-foreground tracking-tight">BucketBudget</span>
                </div>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
                <nav className="flex-1 space-y-1 px-4">
                    <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Menu</p>
                    <NavLink to="/" end onClick={onClose} className={({ isActive }) => `group flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-card-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                        <LayoutDashboard className="mr-3 h-5 w-5 flex-shrink-0" />
                        Dashboard
                    </NavLink>
                    <NavLink to="/budget" onClick={onClose} className={({ isActive }) => `group flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-card-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                        <PiggyBank className="mr-3 h-5 w-5 flex-shrink-0" />
                        Budget
                    </NavLink>
                    <NavLink to="/accounts" onClick={onClose} className={({ isActive }) => `group flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-card-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                        <Wallet className="mr-3 h-5 w-5 flex-shrink-0" />
                        Accounts
                    </NavLink>
                    <NavLink to="/transactions" onClick={onClose} className={({ isActive }) => `group flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-card-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                        <ArrowLeftRight className="mr-3 h-5 w-5 flex-shrink-0" />
                        Transactions
                    </NavLink>
                    <NavLink to="/reports" onClick={onClose} className={({ isActive }) => `group flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-card-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                        <BarChart3 className="mr-3 h-5 w-5 flex-shrink-0" />
                        Reports
                    </NavLink>

                    <div className="mt-8">
                        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-6">Features</p>
                        <NavLink to="/subscriptions" onClick={onClose} className={({ isActive }) => `group flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-card-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                            <RefreshCw className="mr-3 h-5 w-5 flex-shrink-0" />
                            Subscriptions
                        </NavLink>
                        <NavLink to="/investments" onClick={onClose} className={({ isActive }) => `group flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-card-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                            <TrendingUp className="mr-3 h-5 w-5 flex-shrink-0" />
                            Investments
                        </NavLink>
                        <NavLink to="/goals" onClick={onClose} className={({ isActive }) => `group flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-card-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                            <Target className="mr-3 h-5 w-5 flex-shrink-0" />
                            Goals
                        </NavLink>
                        <NavLink to="/debts" onClick={onClose} className={({ isActive }) => `group flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-card-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                            <Landmark className="mr-3 h-5 w-5 flex-shrink-0" />
                            Debts
                        </NavLink>
                        <NavLink to="/calendar" onClick={onClose} className={({ isActive }) => `group flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-card-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                            <CalendarDays className="mr-3 h-5 w-5 flex-shrink-0" />
                            Bill Calendar
                        </NavLink>
                        <NavLink to="/ai" onClick={onClose} className={({ isActive }) => `group flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-card-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                            <Bot className="mr-3 h-5 w-5 flex-shrink-0" />
                            AI Advisor
                        </NavLink>
                    </div>

                </nav>
            </div>
            <div className="border-t border-border/50 p-4 space-y-1">
                <NavLink to="/settings" onClick={onClose} className={({ isActive }) => `group flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-secondary text-card-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                    <SettingsIcon className="mr-3 h-5 w-5 flex-shrink-0" />
                    Settings
                </NavLink>
                <button
                    onClick={() => {
                        logout();
                        onClose();
                    }}
                    className="w-full group flex items-center rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
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
    '/ai': 'AI Advisor'
};

function ProtectedLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const { user, loading } = useAuth();
    const { theme, setTheme } = useTheme();
    const pageTitle = PAGE_TITLES[location.pathname] || 'Bucket Budget';

    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-background text-card-foreground">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background text-card-foreground font-sans">
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex flex-1 flex-col w-full relative">
                <header className="flex h-16 items-center justify-between border-b border-border/40 px-4 sm:px-6 lg:px-8 bg-background/60 backdrop-blur-xl sticky top-0 z-30 transition-colors">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden text-muted-foreground rounded-full hover:text-foreground hover:bg-muted"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </Button>
                        <h1 className="text-2xl font-semibold tracking-tight text-card-foreground">{pageTitle}</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mr-2"
                        >
                            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </Button>
                        <div className="hidden md:block text-sm font-medium text-muted-foreground mr-1">
                            {user.name}
                        </div>
                        <Avatar className="h-8 w-8 ring-1 ring-border cursor-pointer hover:ring-primary transition-all shadow-sm">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} />
                            <AvatarFallback className="bg-secondary text-foreground/80">{user.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto focus:outline-none scroll-smooth">
                    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
                        <Routes>
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
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </div>
                </main>
            </div>
        </div>
    );
}

function PublicRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="flex h-screen items-center justify-center bg-background text-card-foreground">Loading...</div>;
    if (user) return <Navigate to="/" replace />;
    return children;
}

function AppContent() {
    return (
        <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
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
