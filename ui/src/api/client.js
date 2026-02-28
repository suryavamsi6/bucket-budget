const BASE = '/api';

const getAuthToken = () => localStorage.getItem('bucket_budget_token');

async function request(url, options = {}) {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE}${url}`, {
        headers,
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        if (res.status === 401) {
            // Handle unauthorized (e.g., token expired)
            localStorage.removeItem('bucket_budget_token');
            if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
                window.location.href = '/login';
            }
        }
        throw new Error(err.error || 'Request failed');
    }
    return res.json();
}

// Auth
export const login = (data) => request('/auth/login', { method: 'POST', body: data });
export const registerUser = (data) => request('/auth/register', { method: 'POST', body: data });
export const getMe = () => request('/auth/me');

// Accounts
export const getAccounts = () => request('/accounts');
export const createAccount = (data) => request('/accounts', { method: 'POST', body: data });
export const updateAccount = (id, data) => request(`/accounts/${id}`, { method: 'PUT', body: data });
export const deleteAccount = (id) => request(`/accounts/${id}`, { method: 'DELETE' });

// Category Groups & Categories
export const getCategoryGroups = () => request('/category-groups');
export const createCategoryGroup = (data) => request('/category-groups', { method: 'POST', body: data });
export const updateCategoryGroup = (id, data) => request(`/category-groups/${id}`, { method: 'PUT', body: data });
export const deleteCategoryGroup = (id) => request(`/category-groups/${id}`, { method: 'DELETE' });
export const createCategory = (data) => request('/categories', { method: 'POST', body: data });
export const updateCategory = (id, data) => request(`/categories/${id}`, { method: 'PUT', body: data });
export const deleteCategory = (id) => request(`/categories/${id}`, { method: 'DELETE' });

// Transactions
export const getTransactions = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/transactions?${qs}`);
};
export const createTransaction = (data) => request('/transactions', { method: 'POST', body: data });
export const updateTransaction = (id, data) => request(`/transactions/${id}`, { method: 'PUT', body: data });
export const deleteTransaction = (id) => request(`/transactions/${id}`, { method: 'DELETE' });

export const importCSV = async (file, accountId) => {
    const token = getAuthToken();
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/transactions/import?account_id=${accountId}`, {
        method: 'POST',
        headers,
        body: form
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        if (res.status === 401) {
            localStorage.removeItem('bucket_budget_token');
            window.location.href = '/login';
        }
        throw new Error(err.error || 'Request failed');
    }
    return res.json();
};

// Budget
export const getBudget = (month) => request(`/budget/${month}`);
export const getBudgetSummary = (month) => request(`/budget/summary/${month}`);
export const assignBudget = (month, categoryId, assigned) =>
    request(`/budget/${month}/${categoryId}`, { method: 'PUT', body: { assigned } });

// Reports
export const getSpendingByCategory = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/spending-by-category?${qs}`);
};
export const getIncomeVsExpense = (months = 12) => request(`/reports/income-vs-expense?months=${months}`);
export const getNetWorth = (months = 12) => request(`/reports/net-worth?months=${months}`);
export const getBudgetVsActual = (month) => request(`/reports/budget-vs-actual/${month}`);
export const getSpendingTrend = (months = 6) => request(`/reports/spending-trend?months=${months}`);

// Settings
export const getSettings = () => request('/settings');
export const updateSettings = (data) => request('/settings', { method: 'PUT', body: data });

// Payee Autocomplete
export const getPayeeSuggestions = (q) => request(`/settings/payees?q=${encodeURIComponent(q || '')}`);

// Age of Money
export const getAgeOfMoney = () => request('/settings/age-of-money');

// Sankey Flow
export const getSankeyData = (month) => request(`/settings/sankey/${month}`);

// Account Reconciliation
export const reconcileAccount = (accountId, balance) =>
    request(`/settings/reconcile/${accountId}`, { method: 'POST', body: { balance } });

// Copy Budget from Last Month
export const copyBudget = (month) =>
    request(`/settings/copy-budget/${month}`, { method: 'POST' });

// Move Money Between Categories
export const moveMoney = (from_category_id, to_category_id, amount, month) =>
    request('/settings/move-money', { method: 'POST', body: { from_category_id, to_category_id, amount, month } });

// Export
export const getExportTransactionsUrl = () => {
    const token = getAuthToken();
    return `/api/settings/export/transactions?token=${token}`; // Modify the backend to accept token as query param for exports
};

// Subscriptions & Recurring Transactions
export const getSubscriptions = () => request('/subscriptions');
export const createSubscription = (data) => request('/subscriptions', { method: 'POST', body: data });
export const updateSubscription = (id, data) => request(`/subscriptions/${id}`, { method: 'PUT', body: data });
export const deleteSubscription = (id) => request(`/subscriptions/${id}`, { method: 'DELETE' });
export const processSubscriptions = () => request('/subscriptions/process', { method: 'POST' });

// Investments
export const getInvestments = () => request('/investments');
export const createInvestment = (data) => request('/investments', { method: 'POST', body: data });
export const updateInvestment = (id, data) => request(`/investments/${id}`, { method: 'PUT', body: data });
export const deleteInvestment = (id) => request(`/investments/${id}`, { method: 'DELETE' });
export const getInvestmentTransactions = (investmentId) => request(`/investments/${investmentId}/transactions`);
export const addInvestmentTransaction = (investmentId, data) => request(`/investments/${investmentId}/transactions`, { method: 'POST', body: data });
export const deleteInvestmentTransaction = (investmentId, txnId) => request(`/investments/${investmentId}/transactions/${txnId}`, { method: 'DELETE' });

// Goals
export const getGoals = () => request('/goals');
export const createGoal = (data) => request('/goals', { method: 'POST', body: data });
export const updateGoal = (id, data) => request(`/goals/${id}`, { method: 'PUT', body: data });
export const deleteGoal = (id) => request(`/goals/${id}`, { method: 'DELETE' });
export const contributeToGoal = (id, amount) => request(`/goals/${id}/contribute`, { method: 'POST', body: { amount } });

// Debts
export const getDebts = () => request('/debts');
export const createDebt = (data) => request('/debts', { method: 'POST', body: data });
export const updateDebt = (id, data) => request(`/debts/${id}`, { method: 'PUT', body: data });
export const deleteDebt = (id) => request(`/debts/${id}`, { method: 'DELETE' });
export const getDebtStrategies = () => request('/debts/strategies');

// Insights
export const getInsights = () => request('/insights');

// CSV Mappings
export const getCsvMappings = () => request('/settings/csv-mappings');
export const saveCsvMapping = (data) => request('/settings/csv-mappings', { method: 'POST', body: data });

// Export
export const getFinancialExport = async (sections = 'all', format = 'markdown', months = 6) => {
    const resp = await fetch(`${BASE}/export?sections=${sections}&format=${format}&months=${months}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    if (!resp.ok) throw new Error('Export failed');
    if (format === 'json') return resp.json();
    return resp.text();
};

// AI
export const getAiModels = (provider = 'ollama', baseUrl) =>
    request(`/ai/models?provider=${provider}&base_url=${encodeURIComponent(baseUrl || '')}`);
export const chatWithAi = (messages, provider, baseUrl, model, includeContext = true) =>
    request('/ai/chat', { method: 'POST', body: { messages, provider, base_url: baseUrl, model, include_context: includeContext } });
