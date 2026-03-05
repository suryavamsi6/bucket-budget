const BASE = '/api';

const getAuthToken = () => localStorage.getItem('bucket_budget_token');

async function request(url, options = {}) {
    const token = getAuthToken();
    const headers = { ...options.headers };
    if (options.body) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE}${url}`, {
        headers,
        cache: 'no-store', // Prevent browser from caching GET requests (e.g., budget list after creating a group)
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

// Data Export
export const getExportTransactionsUrl = (query = {}) => {
    const qs = new URLSearchParams({ ...query, token: getAuthToken() }).toString();
    return `${BASE}/transactions/export?${qs}`;
};

// AI Advisor & LLM Integrations
export const getAiModels = (provider = 'ollama', baseUrl) =>
    request(`/ai/models?provider=${provider}&base_url=${encodeURIComponent(baseUrl || '')}`);

export const chatWithAi = (messages, provider, baseUrl, model, includeContext = true) =>
    request('/ai/chat', {
        method: 'POST',
        body: { messages, provider, base_url: baseUrl, model, include_context: includeContext }
    });

export const getFinancialExport = async (sections = 'all', format = 'markdown', months = 6) => {
    const resp = await fetch(`${BASE}/ai/export-data?sections=${sections}&format=${format}&months=${months}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    if (!resp.ok) throw new Error('Export failed');
    if (format === 'json') return resp.json();
    return resp.text();
};

// Transactions
export const getTransactions = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/transactions?${qs}`);
};
export const createTransaction = (data) => request('/transactions', { method: 'POST', body: data });
export const updateTransaction = (id, data) => request(`/transactions/${id}`, { method: 'PUT', body: data });
export const deleteTransaction = (id) => request(`/transactions/${id}`, { method: 'DELETE' });

export const uploadAttachment = async (transactionId, file) => {
    const token = getAuthToken();
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${BASE}/transactions/${transactionId}/attachments`, {
        method: 'POST',
        headers,
        body: form
    });
    if (!res.ok) throw new Error('Failed to upload attachment');
    return res.json();
};

export const deleteAttachment = (attachmentId) => request(`/transactions/attachments/${attachmentId}`, { method: 'DELETE' });

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
export const getBudgetDetails = (month) => request(`/budget/details/${month}`);
export const allocateBudget = (data) => request('/budget/allocate', { method: 'POST', body: JSON.stringify(data) });
export const assignBudget = (month, categoryId, assigned) =>
    request(`/budget/${month}/${categoryId}`, { method: 'PUT', body: { assigned } });

// Reports
export const getSpendingByCategory = (query = {}) => {
    const qs = new URLSearchParams(query).toString();
    return request(`/reports/spending-by-category?${qs}`);
};
export const getIncomeVsExpense = (months) => request(`/reports/income-vs-expense?months=${months || 12}`);
export const getNetWorth = (months = 6) => request(`/reports/net-worth?months=${months}`);
export const getBudgetVsActual = (month) => request(`/reports/budget-vs-actual/${month}`);
export const getSpendingTrend = (months = 6) => request(`/reports/spending-trend?months=${months}`);
export const getPayeeLeaderboard = (query = {}) => {
    const qs = new URLSearchParams(query).toString();
    return request(`/reports/payee-leaderboard?${qs}`);
};
export const getSpendingHeatmap = (months = 12) => request(`/reports/spending-heatmap?months=${months}`);

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

// Rules
export const getRules = () => request('/rules');
export const createRule = (data) => request('/rules', { method: 'POST', body: data });
export const updateRule = (id, data) => request(`/rules/${id}`, { method: 'PUT', body: data });
export const deleteRule = (id) => request(`/rules/${id}`, { method: 'DELETE' });
export const applyRules = (data) => request('/rules/apply', { method: 'POST', body: data });

// ── New Endpoints: Splits, CC Tracking, Forecasting, etc. ──────────────

// Account enhanced (cleared/uncleared, reconciliation, CC)
export const reconcileAccountEnhanced = (accountId, data) =>
    request(`/accounts/${accountId}/reconcile`, { method: 'POST', body: data });
export const getCCPaymentInfo = (accountId, month) =>
    request(`/accounts/${accountId}/cc-payment-info?month=${month || ''}`);

// Transaction splits & ML
export const getTransaction = (id) => request(`/transactions/${id}`);
export const suggestCategory = (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/transactions/suggest-category?${qs}`);
};
export const submitCategorizationFeedback = (data) =>
    request('/transactions/categorization-feedback', { method: 'POST', body: data });
export const retrainModel = () => request('/transactions/retrain', { method: 'POST' });
export const getDuplicates = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/transactions/duplicates?${qs}`);
};
export const matchTransactions = (data) =>
    request('/transactions/match', { method: 'POST', body: data });
export const getTransfers = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/transactions/transfers?${qs}`);
};

// Funding Templates
export const getFundingTemplates = () => request('/funding-templates');
export const createFundingTemplate = (data) => request('/funding-templates', { method: 'POST', body: data });
export const updateFundingTemplate = (id, data) => request(`/funding-templates/${id}`, { method: 'PUT', body: data });
export const deleteFundingTemplate = (id) => request(`/funding-templates/${id}`, { method: 'DELETE' });
export const applyFundingTemplate = (id, data) =>
    request(`/funding-templates/${id}/apply`, { method: 'POST', body: data });

// Split Templates
export const getSplitTemplates = () => request('/split-templates');
export const createSplitTemplate = (data) => request('/split-templates', { method: 'POST', body: data });
export const updateSplitTemplate = (id, data) => request(`/split-templates/${id}`, { method: 'PUT', body: data });
export const deleteSplitTemplate = (id) => request(`/split-templates/${id}`, { method: 'DELETE' });

// Subscriptions upcoming
export const getUpcomingBills = (days = 30) => request(`/subscriptions/upcoming?days=${days}`);

// Report forecasting
export const getCashflowForecast = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/cashflow-forecast?${qs}`);
};
export const getSpendingForecast = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/spending-forecast?${qs}`);
};
export const getNetWorthForecast = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/net-worth-forecast?${qs}`);
};

// Report PDF/CSV exports
export const downloadTransactionsPDF = (params = {}) => downloadFile('/reports/export/transactions-pdf', params, 'transactions.pdf');
export const downloadBudgetPDF = (month) => downloadFile(`/reports/export/budget-pdf/${month}`, {}, `budget-${month}.pdf`);
export const downloadNetWorthPDF = (params = {}) => downloadFile('/reports/export/net-worth-pdf', params, 'net-worth.pdf');
export const downloadTransactionsCSV = (params = {}) => downloadFile('/reports/export/transactions-csv', params, 'transactions.csv');

// Helper for file downloads
async function downloadFile(url, params, filename) {
    const token = getAuthToken();
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE}${url}${qs ? '?' + qs : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

