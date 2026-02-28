import { useState, useEffect, useRef } from 'react';
import { Bot, Send, Settings2, Loader2, Sparkles, RefreshCw, Copy, Check, Download, ChevronDown, Zap } from 'lucide-react';
import { getAiModels, chatWithAi, getFinancialExport } from '../api/client.js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';

const QUICK_PROMPTS = [
    { icon: '📊', label: 'Analyze my spending', prompt: 'Analyze my spending patterns. What are my top spending categories? Are there any areas where I could cut back?' },
    { icon: '💰', label: 'How to save more?', prompt: 'Based on my income and expenses, how much could I realistically save each month? Give me specific, actionable tips.' },
    { icon: '📋', label: 'Review my budget', prompt: 'Review my current budget allocations. Are there any categories where I\'m consistently over or under budget? What adjustments do you recommend?' },
    { icon: '🏦', label: 'Debt payoff advice', prompt: 'Look at my debts and suggest the best payoff strategy. Should I use avalanche or snowball? How much extra should I pay?' },
    { icon: '📈', label: 'Investment review', prompt: 'Review my investment portfolio. How is it performing? What\'s my asset allocation and do you have suggestions for rebalancing?' },
    { icon: '🎯', label: 'Goal planning', prompt: 'Review my savings goals. Am I on track? What monthly contribution do I need to reach each goal on time?' },
];

const DEFAULT_URLS = { ollama: 'http://localhost:11434', lmstudio: 'http://localhost:1234' };

export default function AiAdvisor() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [provider, setProvider] = useState('ollama');
    const [baseUrl, setBaseUrl] = useState(DEFAULT_URLS.ollama);
    const [model, setModel] = useState('');
    const [models, setModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [modelsError, setModelsError] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [copied, setCopied] = useState(null);
    const [showExport, setShowExport] = useState(false);
    const [exportSections, setExportSections] = useState({
        accounts: true, transactions: true, budget: true, goals: true,
        debts: true, investments: true, subscriptions: true, insights: true
    });
    const [exportMonths, setExportMonths] = useState(6);
    const [exportLoading, setExportLoading] = useState(false);

    const chatEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadModels = async () => {
        setModelsLoading(true);
        setModelsError('');
        try {
            const data = await getAiModels(provider, baseUrl);
            setModels(data.models || []);
            if (data.models?.length > 0 && !model) setModel(data.models[0].id);
        } catch (e) {
            setModelsError(e.message || 'Cannot connect to LLM');
            setModels([]);
        }
        setModelsLoading(false);
    };

    const sendMessage = async (text) => {
        if (!text.trim() || loading || !model) return;

        const userMsg = { role: 'user', content: text.trim() };
        const newMsgs = [...messages, userMsg];
        setMessages(newMsgs);
        setInput('');
        setLoading(true);

        try {
            const resp = await chatWithAi(
                newMsgs.map(m => ({ role: m.role, content: m.content })),
                provider, baseUrl, model
            );
            setMessages([...newMsgs, { role: 'assistant', content: resp.content }]);
        } catch (e) {
            setMessages([...newMsgs, { role: 'assistant', content: `❌ **Error**: ${e.message || 'Failed to get response'}. Make sure your LLM is running.`, error: true }]);
        }
        setLoading(false);
        inputRef.current?.focus();
    };

    const handleSubmit = (e) => { e.preventDefault(); sendMessage(input); };

    const copyMessage = (text, idx) => {
        navigator.clipboard.writeText(text);
        setCopied(idx);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleExport = async (mode) => {
        setExportLoading(true);
        try {
            const selectedSections = Object.entries(exportSections)
                .filter(([, v]) => v).map(([k]) => k).join(',');
            const md = await getFinancialExport(selectedSections || 'all', 'markdown', exportMonths);
            if (mode === 'copy') {
                await navigator.clipboard.writeText(md);
                alert('Financial data copied to clipboard! Paste it into ChatGPT, Gemini, or Perplexity.');
            } else {
                const blob = new Blob([md], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bucket-budget-export-${new Date().toISOString().split('T')[0]}.md`;
                a.click();
                URL.revokeObjectURL(url);
            }
            setShowExport(false);
        } catch (e) { alert(e.message); }
        setExportLoading(false);
    };

    const allSelected = Object.values(exportSections).every(v => v);
    const toggleAll = () => {
        const val = !allSelected;
        setExportSections(Object.fromEntries(Object.keys(exportSections).map(k => [k, val])));
    };

    return (
        <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-500/10 rounded-2xl text-violet-500"><Bot className="h-6 w-6" /></div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Finny AI</h2>
                        <p className="text-muted-foreground text-sm">Get personalized financial advice from Finny, your local LLM advisor.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:text-foreground" onClick={() => setShowExport(true)}>
                        <Download className="w-4 h-4 mr-2" /> Export for LLM
                    </Button>
                    <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:text-foreground" onClick={() => { setShowSettings(true); loadModels(); }}>
                        <Settings2 className="w-4 h-4 mr-2" /> {model || 'Connect LLM'}
                    </Button>
                </div>
            </div>

            {/* Chat Area */}
            <Card className="bg-card border-border flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <Sparkles className="w-12 h-12 text-violet-500/30 mb-4" />
                            <h3 className="text-lg font-semibold text-card-foreground mb-1">Ask anything about your finances</h3>
                            <p className="text-muted-foreground text-sm max-w-md mb-8">
                                Your financial data is automatically shared with the LLM for personalized advice. {!model && 'Connect an LLM first →'}
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-w-xl">
                                {QUICK_PROMPTS.map((qp, i) => (
                                    <button key={i} onClick={() => sendMessage(qp.prompt)}
                                        disabled={!model || loading}
                                        className="text-left p-3 rounded-xl border border-border hover:border-violet-500/50 hover:bg-violet-500/5 transition-all disabled:opacity-50 disabled:pointer-events-none group">
                                        <span className="text-lg">{qp.icon}</span>
                                        <p className="text-xs font-medium text-muted-foreground group-hover:text-violet-400 mt-1">{qp.label}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                        ? 'bg-violet-600 text-white'
                                        : msg.error
                                            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                                            : 'bg-muted/50 border border-border text-card-foreground'
                                        }`}>
                                        <div className="text-sm whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{
                                            __html: msg.role === 'assistant'
                                                ? msg.content
                                                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                    .replace(/\n/g, '<br/>')
                                                    .replace(/^- /gm, '• ')
                                                : msg.content
                                        }} />
                                        {msg.role === 'assistant' && !msg.error && (
                                            <button onClick={() => copyMessage(msg.content, i)}
                                                className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                                                {copied === i ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-muted/50 border border-border rounded-2xl px-4 py-3 flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                                        <span className="text-sm text-muted-foreground">Thinking...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </>
                    )}
                </div>

                {/* Input */}
                <div className="border-t border-border p-4">
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder={model ? "Ask about your finances..." : "Connect an LLM first..."}
                            disabled={!model || loading}
                            className="bg-background border-border flex-1"
                        />
                        <Button type="submit" disabled={!model || !input.trim() || loading}
                            className="bg-violet-600 hover:bg-violet-700 text-white">
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                    {model && <p className="text-[10px] text-muted-foreground mt-2">Using <span className="font-mono">{model}</span> via {provider}. Your data is sent to {baseUrl} (local only).</p>}
                </div>
            </Card>

            {/* Settings Dialog */}
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogContent className="bg-card border-border text-card-foreground sm:max-w-md">
                    <DialogHeader><DialogTitle>LLM Connection Settings</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Provider</Label>
                            <Select value={provider} onValueChange={val => { setProvider(val); setBaseUrl(DEFAULT_URLS[val]); setModels([]); setModel(''); }}>
                                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground/80">
                                    <SelectItem value="ollama">🦙 Ollama</SelectItem>
                                    <SelectItem value="lmstudio">🔬 LM Studio</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Base URL</Label>
                            <Input className="bg-background border-border font-mono text-sm" value={baseUrl}
                                onChange={e => setBaseUrl(e.target.value)}
                                placeholder={DEFAULT_URLS[provider]} />
                        </div>
                        <Button onClick={loadModels} disabled={modelsLoading} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
                            {modelsLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Connecting...</> : <><RefreshCw className="w-4 h-4 mr-2" /> Fetch Models</>}
                        </Button>
                        {modelsError && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs">
                                ❌ {modelsError}
                            </div>
                        )}
                        {models.length > 0 && (
                            <div className="space-y-2">
                                <Label>Model</Label>
                                <Select value={model} onValueChange={setModel}>
                                    <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Select a model" /></SelectTrigger>
                                    <SelectContent className="bg-card border-border text-foreground/80">
                                        {models.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="bg-muted/50 p-3 rounded-xl text-xs text-muted-foreground">
                            <p className="font-semibold mb-1">💡 Setup Guide</p>
                            {provider === 'ollama' ? (
                                <>
                                    <p>1. Install Ollama: <span className="font-mono">brew install ollama</span> or <a href="https://ollama.com" className="text-violet-400 hover:underline" target="_blank">ollama.com</a></p>
                                    <p>2. Pull a model: <span className="font-mono">ollama pull llama3.2</span></p>
                                    <p>3. Start: <span className="font-mono">ollama serve</span></p>
                                </>
                            ) : (
                                <>
                                    <p>1. Download <a href="https://lmstudio.ai" className="text-violet-400 hover:underline" target="_blank">LM Studio</a></p>
                                    <p>2. Download a model and start the local server</p>
                                    <p>3. Enable "Start Server" in the left panel</p>
                                </>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" className="text-muted-foreground" onClick={() => setShowSettings(false)}>Close</Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Export Dialog */}
            <Dialog open={showExport} onOpenChange={setShowExport}>
                <DialogContent className="bg-card border-border text-card-foreground sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Export Financial Data for LLM</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <p className="text-xs text-muted-foreground">Export your data as structured Markdown — optimized for ChatGPT, Gemini, and Perplexity.</p>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm">Sections</Label>
                                <button onClick={toggleAll} className="text-[10px] text-violet-400 hover:text-violet-300">{allSelected ? 'Deselect All' : 'Select All'}</button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(exportSections).map(([key, val]) => (
                                    <label key={key} className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer text-sm transition-all ${val ? 'border-violet-500/50 bg-violet-500/5 text-foreground/80' : 'border-border text-muted-foreground'}`}>
                                        <input type="checkbox" checked={val}
                                            onChange={() => setExportSections({ ...exportSections, [key]: !val })}
                                            className="accent-violet-500" />
                                        <span className="capitalize">{key}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm">Transaction History</Label>
                            <Select value={String(exportMonths)} onValueChange={v => setExportMonths(parseInt(v))}>
                                <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-card border-border text-foreground/80">
                                    <SelectItem value="1">Last 1 month</SelectItem>
                                    <SelectItem value="3">Last 3 months</SelectItem>
                                    <SelectItem value="6">Last 6 months</SelectItem>
                                    <SelectItem value="12">Last 12 months</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2">
                            <Button onClick={() => handleExport('copy')} disabled={exportLoading}
                                className="bg-violet-600 hover:bg-violet-700 text-white">
                                {exportLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                Copy to Clipboard
                            </Button>
                            <Button variant="outline" onClick={() => handleExport('download')} disabled={exportLoading}
                                className="border-border text-muted-foreground hover:text-foreground">
                                <Download className="w-4 h-4 mr-2" /> Download .md
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
