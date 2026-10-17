/**
 * QuantChatbot - Multi-Turn AI Trading Advisor using Gemini API
 * Supports continuous conversation history, scrollable thread, model selection,
 * context-aware quantitative analysis, and quick prompt suggestions.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Sparkles, RefreshCw, X, MessageSquare, ChevronDown } from 'lucide-react';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface QuantChatbotProps {
  contextData?: {
    accountEquity: number;
    accountBalance: number;
    dailyDrawdownPct: number;
    circuitBreakerActive: boolean;
    openTradesCount: number;
    symbols: string[];
    selectedSymbol: string;
    btcPrice: number;
    ethPrice: number;
  };
}

export const QuantChatbot: React.FC<QuantChatbotProps> = ({ contextData }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: 'Witaj! Jestem **QuantBot AI Advisor** – asystentem inżynierii ilościowej i strategii tradingowych. Mogę przeanalizować Twoją krzywą kapitałową, zoptymalizować parametry przecięcia EMA 20/50, sprawdzić filtr RSI lub pomóc w konfiguracji zarządzania ryzykiem na Binance Futures. W czym mogę Ci dzisiaj pomóc?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<'gemini-3.8-flash' | 'gemini-3.1-flash-lite'>('gemini-3.8-flash');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputValue).trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({
            role: m.role,
            text: m.text,
          })),
          contextData,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Błąd serwera`);
      }

      const data = await response.json();
      const botReply = data.reply || 'Otrzymano pustą odpowiedź od modelu.';

      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: botReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: `⚠️ Błąd komunikacji z modelem Gemini: ${err?.message || 'Nie można połączyć się z serwerem.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    '📊 Przeanalizuj moją krzywą kapitałową i wskaźnik Max Drawdown.',
    '⚡ Jak zoptymalizować przecięcie EMA 20 i EMA 50 dla BTC/USDT na 15m?',
    '🛡️ Wyjaśnij matematykę Position Sizing przy 1.5% ryzyka na transakcję.',
    '🔄 Kiedy dokładnie aktywuje się Trailing Break-Even i Circuit Breaker?',
  ];

  const handleClearHistory = () => {
    setMessages([
      {
        role: 'model',
        text: 'Historia konwersacji została zresetowana. Jakie zagadnienie ilościowe chcesz teraz omówić?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <>
      {/* FLOATING TRIGGER BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs shadow-2xl shadow-cyan-900/60 border border-cyan-400/40 transition-all hover:scale-105 active:scale-95 group"
        >
          <div className="relative">
            <Bot className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span>Doradca AI (Gemini)</span>
        </button>
      )}

      {/* CHAT WINDOW MODAL / DRAWER */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-32px)] h-[580px] max-h-[calc(100vh-64px)] flex flex-col bg-[#0b1120] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* HEADER */}
          <div className="bg-[#0f172a] border-b border-slate-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-600/40 text-cyan-400">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-bold text-white text-xs">QuantBot AI Advisor</h4>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                    {selectedModel}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Doradca Ilościowy & Strategii Algo</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={handleClearHistory}
                title="Wyczyść historię"
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Zamknij czat"
                className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CONVERSATION THREAD */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start space-x-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'model' && (
                  <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3 h-3" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-xl p-3 leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                      : 'bg-slate-900 border border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="text-[11px]">{msg.text}</div>
                  <div
                    className={`text-[9px] mt-1 text-right font-mono ${
                      msg.role === 'user' ? 'text-cyan-200' : 'text-slate-500'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-blue-900 border border-blue-600 text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3 h-3" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center space-x-2 text-slate-400 text-xs">
                <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-700 text-cyan-400 flex items-center justify-center animate-spin">
                  <RefreshCw className="w-3 h-3" />
                </div>
                <span className="animate-pulse text-cyan-400">QuantBot analizuje dane rynkowe...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* QUICK PROMPT CHIPS */}
          <div className="px-3 py-1.5 border-t border-slate-800/80 bg-slate-950/70 overflow-x-auto flex space-x-1.5 scrollbar-none">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-300 transition-colors shrink-0 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* INPUT BAR */}
          <div className="p-3 bg-[#0f172a] border-t border-slate-800 flex items-center space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Zapytaj o strategię EMA/RSI, zarządzanie ryzykiem..."
              className="flex-1 bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputValue.trim()}
              className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
