import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ShieldCheck, Wallet, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await login(email, password);

        if (result.success) {
            navigate('/');
        } else {
            setError(result.error || 'Failed to login');
            setIsLoading(false);
        }
    };

    return (
        <div className="app-shell relative flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6">
            <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <Card className="hidden overflow-hidden lg:block">
                    <div className="relative h-full p-8">
                        <div className="absolute inset-0 bg-primary-container/40 rounded-xl" />
                        <div className="relative z-10 flex h-full flex-col justify-between">
                            <div>
                                <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-2 text-xs font-medium tracking-wider text-muted-foreground">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Budget With Clarity
                                </div>
                                <h1 className="font-display text-4xl font-medium leading-tight text-card-foreground text-balance">
                                    Take control of every dollar.
                                </h1>
                                <p className="mt-4 max-w-md text-muted-foreground">
                                    Oasis helps you plan ahead, track spending live, and build momentum toward your goals.
                                </p>
                            </div>
                            <div className="space-y-3">
                                <div className="rounded-xl bg-surface-container-high p-4">
                                    <p className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                                        <ShieldCheck className="h-4 w-4 text-primary" />
                                        Secure local-first account access
                                    </p>
                                </div>
                                <div className="rounded-xl bg-surface-container-high p-4">
                                    <p className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                                        <Wallet className="h-4 w-4 text-primary" />
                                        Multi-account cash flow tracking
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="w-full">
                    <CardHeader className="space-y-2 pb-2">
                        <CardTitle className="font-display text-[28px] font-medium text-card-foreground">Sign in</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Welcome back. Enter your credentials to continue.
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="rounded-xl bg-error-container p-3 text-sm font-medium text-on-error-container">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email or Username</Label>
                                <Input
                                    id="email"
                                    type="text"
                                    placeholder="name@example.com or username"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</Label>
                                    <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
                                        Forgot Password?
                                    </Link>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="h-11"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col space-y-4">
                            <Button type="submit" className="h-11 w-full" disabled={isLoading}>
                                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : 'Sign in'}
                            </Button>
                            <div className="text-center text-sm text-muted-foreground">
                                Don't have an account?{' '}
                                <Link to="/register" className="font-semibold text-primary hover:underline">
                                    Sign up
                                </Link>
                            </div>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
