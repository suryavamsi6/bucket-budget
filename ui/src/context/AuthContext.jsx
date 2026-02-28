import { createContext, useContext, useState, useEffect } from 'react';
import { getMe, login as loginApi, registerUser as registerApi } from '../api/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('bucket_budget_token');
            if (token) {
                try {
                    const data = await getMe();
                    setUser(data.user);
                } catch (err) {
                    // Token is invalid or expired
                    localStorage.removeItem('bucket_budget_token');
                }
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    const login = async (email, password) => {
        try {
            const { token, user: userData } = await loginApi({ email, password });
            localStorage.setItem('bucket_budget_token', token);
            setUser(userData);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const register = async (name, username, email, password) => {
        try {
            const { token, user: userData } = await registerApi({ name, username, email, password });
            localStorage.setItem('bucket_budget_token', token);
            setUser(userData);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const logout = () => {
        localStorage.removeItem('bucket_budget_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    return useContext(AuthContext);
};
