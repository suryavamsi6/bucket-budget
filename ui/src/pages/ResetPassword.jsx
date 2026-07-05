import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [errorMessage, setErrorMessage] = useState('');

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                <div className="w-full max-w-md text-center space-y-4">
                    <div className="inline-flex justify-center text-destructive mb-2">
                        <AlertCircle className="w-16 h-16" />
                    </div>
                    <h1 className="text-[22px] font-medium text-foreground">Invalid Reset Link</h1>
                    <p className="text-muted-foreground">The password reset link is invalid or missing.</p>
                    <Link to="/forgot-password" className="inline-flex items-center text-sm font-medium text-primary hover:underline mt-4">
                        Request a new link
                    </Link>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setErrorMessage('');

        if (password !== confirmPassword) {
            setStatus('error');
            setErrorMessage('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setStatus('error');
            setErrorMessage('Password must be at least 6 characters long');
            return;
        }

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to reset password');
            }

            setStatus('success');
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            setStatus('error');
            setErrorMessage(err.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-300">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-container text-on-primary-container mb-4">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h1 className="text-[28px] font-medium tracking-tight text-foreground">Reset Password</h1>
                    <p className="text-muted-foreground">Enter your new password below.</p>
                </div>

                {status === 'success' ? (
                    <div className="bg-surface-container-high border border-outline-variant/30 rounded-xl p-6 text-center space-y-4">
                        <div className="flex justify-center text-success">
                            <CheckCircle className="w-12 h-12" />
                        </div>
                        <h3 className="text-lg font-semibold text-success">Password Updated!</h3>
                        <p className="text-sm text-muted-foreground">
                            Your password has been successfully reset. Redirecting you to login...
                        </p>
                        <div className="pt-4">
                            <Link to="/login" className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                                Click here if not redirected
                            </Link>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-8 shadow-sm space-y-6">
                        {status === 'error' && (
                            <Alert variant="destructive" className="bg-error-container text-on-error-container border-none rounded-xl">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{errorMessage}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="new-password" className="text-sm font-medium text-foreground">New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                    <input
                                        id="new-password"
                                        type="password"
                                        required
                                        className="w-full pl-10 pr-4 py-3 bg-transparent border border-outline-variant rounded-xs text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={status === 'loading'}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">Confirm New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                    <input
                                        id="confirm-password"
                                        type="password"
                                        required
                                        className="w-full pl-10 pr-4 py-3 bg-transparent border border-outline-variant rounded-xs text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        disabled={status === 'loading'}
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="w-full bg-primary hover:bg-primary/92 text-primary-foreground font-medium py-3 rounded-full transition-all active:scale-[0.98] shadow-sm disabled:opacity-38 disabled:pointer-events-none"
                        >
                            {status === 'loading' ? <><Loader2 className="inline mr-2 h-4 w-4 animate-spin" /> Updating...</> : 'Reset Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
