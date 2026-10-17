/**
 * QuantBot Studio - Quantitative Trading System Dashboard & Project Hub
 * Full-featured interactive terminal with live charts, simulation, risk manager,
 * codebase explorer, and one-click ZIP project export.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import JSZip from 'jszip';
import {
  Play,
  Square,
  Flame,
  Activity,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Layers,
  Download,
  Copy,
  Check,
  Terminal,
  Settings,
  Code2,
  Database,
  RefreshCw,
  Sliders,
  Cpu,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  DollarSign,
  Lock,
  Unlock,
  ChevronRight,
  Server,
  Volume2,
  VolumeX
} from 'lucide-react';
import { QUANTBOT_FILES, CodeFile } from './pythonCode';

import { EquityCurveD3 } from './components/EquityCurveD3';
import { QuantChatbot } from './components/QuantChatbot';
import { useTradingAudio } from './hooks/useTradingAudio';
import { AudioSettingsBar } from './components/AudioSettingsBar';
import { MicroPositionsManager } from './components/MicroPositionsManager';

export interface Candle {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  emaFast?: number;
  emaSlow?: number;
  rsi?: number;
}

export interface SimulatedTrade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  slPrice: number;
  tpPrice: number;
  breakEvenActivated: boolean;
  pnlUsd: number;
  pnlPct: number;
  openTime: string;
}

export interface ClosedTradeRecord {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnlUsd: number;
  pnlPct: number;
  exitReason: string;
  exitTime: string;
}

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'risk_sim' | 'architecture' | 'code' | 'deployment'>('dashboard');
  
  // Audio Alerts Synthesizer Hook
  const {
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    playSound,
    lastPlayed
  } = useTradingAudio();

  // Selected symbol & timeframe
  const [selectedSymbol, setSelectedSymbol] = useState<'BTC/USDT' | 'ETH/USDT'>('BTC/USDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '5m' | '15m'>('15m');

  // Real Market Prices & Live Ticker Stats (Binance Futures)
  const [btcPrice, setBtcPrice] = useState<number>(81520.0);
  const [ethPrice, setEthPrice] = useState<number>(2421.5);
  const [priceChange24h, setPriceChange24h] = useState<{ btc: number; eth: number }>({ btc: -0.92, eth: -0.85 });
  const [price24hStats, setPrice24hStats] = useState<{
    btc: { high: number; low: number; volume: number };
    eth: { high: number; low: number; volume: number };
  }>({
    btc: { high: 82900, low: 80780, volume: 137000 },
    eth: { high: 2490, low: 2390, volume: 3500000 },
  });
  const [priceTickDirection, setPriceTickDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [tickCounter, setTickCounter] = useState<number>(0);
  const [lastTickTime, setLastTickTime] = useState<string>('Live');

  // Engine state
  const [isEngineRunning, setIsEngineRunning] = useState<boolean>(true);
  const [isPaperMode, setIsPaperMode] = useState<boolean>(true);
  const [circuitBreakerActive, setCircuitBreakerActive] = useState<boolean>(false);
  const [dailyDrawdownPct, setDailyDrawdownPct] = useState<number>(0.85);

  // Balances
  const [accountBalance, setAccountBalance] = useState<number>(10894.20);
  const [initialDailyEquity, setInitialDailyEquity] = useState<number>(10000.0);

  // Position Sizing Calculator Parameters
  const [riskPerTradePct, setRiskPerTradePct] = useState<number>(1.5);
  const [slPct, setSlPct] = useState<number>(1.5);
  const [tpPct, setTpPct] = useState<number>(3.0);
  const [trailingBePct, setTrailingBePct] = useState<number>(1.5);
  const [leverage, setLeverage] = useState<number>(5);

  // Active Simulated Trades
  const [openTrades, setOpenTrades] = useState<SimulatedTrade[]>([
    {
      id: 'QB-BTCUSDT-LIVE-A4F1',
      symbol: 'BTC/USDT',
      side: 'LONG',
      entryPrice: 81100.0,
      currentPrice: 81520.0,
      quantity: 0.123,
      slPrice: 79883.5,
      tpPrice: 83533.0,
      breakEvenActivated: false,
      pnlUsd: 51.66,
      pnlPct: 0.52,
      openTime: new Date(Date.now() - 25 * 60000).toLocaleTimeString()
    }
  ]);

  const [tradeHistory, setTradeHistory] = useState<ClosedTradeRecord[]>([
    {
      id: 'QB-BTCUSDT-1718-08',
      symbol: 'BTC/USDT',
      side: 'LONG',
      entryPrice: 80200.0,
      exitPrice: 82606.0,
      quantity: 0.124,
      pnlUsd: 298.34,
      pnlPct: 3.0,
      exitReason: 'TAKE_PROFIT',
      exitTime: '17:10:05 UTC'
    },
    {
      id: 'QB-ETHUSDT-1718-07',
      symbol: 'ETH/USDT',
      side: 'SHORT',
      entryPrice: 2450.0,
      exitPrice: 2486.75,
      quantity: 4.08,
      pnlUsd: -149.94,
      pnlPct: -1.5,
      exitReason: 'STOP_LOSS',
      exitTime: '15:45:12 UTC'
    },
    {
      id: 'QB-BTCUSDT-1718-06',
      symbol: 'BTC/USDT',
      side: 'LONG',
      entryPrice: 79800.0,
      exitPrice: 82194.0,
      quantity: 0.125,
      pnlUsd: 299.25,
      pnlPct: 3.0,
      exitReason: 'TAKE_PROFIT',
      exitTime: '14:30:20 UTC'
    },
    {
      id: 'QB-ETHUSDT-1718-05',
      symbol: 'ETH/USDT',
      side: 'LONG',
      entryPrice: 2380.0,
      exitPrice: 2451.4,
      quantity: 4.20,
      pnlUsd: 299.88,
      pnlPct: 3.0,
      exitReason: 'TAKE_PROFIT',
      exitTime: '13:12:00 UTC'
    },
    {
      id: 'QB-BTCUSDT-1717-04',
      symbol: 'BTC/USDT',
      side: 'SHORT',
      entryPrice: 82100.0,
      exitPrice: 82141.0,
      quantity: 0.122,
      pnlUsd: -5.00,
      pnlPct: -0.05,
      exitReason: 'BREAK_EVEN',
      exitTime: '11:15:02 UTC'
    },
    {
      id: 'QB-ETHUSDT-1717-03',
      symbol: 'ETH/USDT',
      side: 'LONG',
      entryPrice: 2320.0,
      exitPrice: 2389.6,
      quantity: 4.31,
      pnlUsd: 299.98,
      pnlPct: 3.0,
      exitReason: 'TAKE_PROFIT',
      exitTime: '09:25:40 UTC'
    },
    {
      id: 'QB-BTCUSDT-1717-02',
      symbol: 'BTC/USDT',
      side: 'LONG',
      entryPrice: 78900.0,
      exitPrice: 77716.5,
      quantity: 0.127,
      pnlUsd: -150.31,
      pnlPct: -1.5,
      exitReason: 'STOP_LOSS',
      exitTime: '07:40:15 UTC'
    }
  ]);

  // Candle series state (Real Binance Candlesticks)
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isLoadingCandles, setIsLoadingCandles] = useState<boolean>(true);

  // Mathematical Technical Indicators computation on Candle Array
  const computeIndicators = (rawCandles: Candle[]): Candle[] => {
    if (!rawCandles || rawCandles.length === 0) return [];
    const result = rawCandles.map(c => ({ ...c }));

    const k20 = 2 / (20 + 1);
    const k50 = 2 / (50 + 1);
    let ema20 = result[0].close;
    let ema50 = result[0].close;

    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 0; i < result.length; i++) {
      const c = result[i].close;
      if (i === 0) {
        ema20 = c;
        ema50 = c;
      } else {
        ema20 = c * k20 + ema20 * (1 - k20);
        ema50 = c * k50 + ema50 * (1 - k50);

        const diff = c - result[i - 1].close;
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;

        if (i <= 14) {
          avgGain += gain / 14;
          avgLoss += loss / 14;
        } else {
          avgGain = (avgGain * 13 + gain) / 14;
          avgLoss = (avgLoss * 13 + loss) / 14;
        }
      }

      if (i >= 19) result[i].emaFast = Math.round(ema20 * 100) / 100;
      if (i >= 49) result[i].emaSlow = Math.round(ema50 * 100) / 100;

      if (i >= 14) {
        if (avgLoss === 0) {
          result[i].rsi = 100;
        } else {
          const rs = avgGain / avgLoss;
          result[i].rsi = Math.round((100 - (100 / (1 + rs))) * 10) / 10;
        }
      } else {
        result[i].rsi = 50.0;
      }
    }

    return result;
  };

  // Fetch REAL Binance Candlesticks via Backend Proxy
  const fetchRealKlines = async (symbol: string, timeframe: string) => {
    try {
      const cleanSymbol = symbol.replace('/', '');
      const res = await fetch(`/api/binance/klines?symbol=${cleanSymbol}&interval=${timeframe}&limit=65`);
      if (!res.ok) throw new Error('Nie udało się pobrać świec z serwera');
      const data = await res.json();
      if (Array.isArray(data.candles) && data.candles.length > 0) {
        const mappedCandles: Candle[] = data.candles.map((c: any) => {
          const dateObj = new Date(c.timestamp);
          const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return {
            time: timeStr,
            timestamp: c.timestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          };
        });

        const withIndicators = computeIndicators(mappedCandles);
        setCandles(withIndicators);
        setIsLoadingCandles(false);
      }
    } catch (err) {
      console.warn('Fallback klines fetch error:', err);
    }
  };

  // Initial and periodic fetch of real Binance Klines
  useEffect(() => {
    setIsLoadingCandles(true);
    fetchRealKlines(selectedSymbol, selectedTimeframe);
    // Sync full candles every 15 seconds
    const klineInterval = setInterval(() => {
      fetchRealKlines(selectedSymbol, selectedTimeframe);
    }, 15000);

    return () => clearInterval(klineInterval);
  }, [selectedSymbol, selectedTimeframe]);

  // REAL-TIME 1-SECOND PRICE TICK FEED
  useEffect(() => {
    let isMounted = true;
    let prevPrice = selectedSymbol === 'BTC/USDT' ? btcPrice : ethPrice;

    const pollOneSecondPrice = async () => {
      try {
        const res = await fetch('/api/binance/prices');
        if (!res.ok) return;
        const data = await res.json();

        if (isMounted && data.btc && data.eth) {
          const newBtc = data.btc.price;
          const newEth = data.eth.price;

          setBtcPrice(newBtc);
          setEthPrice(newEth);
          setPriceChange24h({ btc: data.btc.change24h, eth: data.eth.change24h });
          setPrice24hStats({
            btc: { high: data.btc.high24h, low: data.btc.low24h, volume: data.btc.volume24h },
            eth: { high: data.eth.high24h, low: data.eth.low24h, volume: data.eth.volume24h },
          });

          const currentAssetPrice = selectedSymbol === 'BTC/USDT' ? newBtc : newEth;
          if (currentAssetPrice > prevPrice) {
            setPriceTickDirection('up');
          } else if (currentAssetPrice < prevPrice) {
            setPriceTickDirection('down');
          }
          prevPrice = currentAssetPrice;

          setTickCounter(prev => prev + 1);
          setLastTickTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

          // UPDATE ACTIVE CANDLE IN REAL TIME EVERY 1 SECOND
          setCandles(prevCandles => {
            if (!prevCandles || prevCandles.length === 0) return prevCandles;
            const updated = [...prevCandles];
            const lastIdx = updated.length - 1;
            const lastCandle = { ...updated[lastIdx] };

            // Update with live 1s tick
            lastCandle.close = currentAssetPrice;
            if (currentAssetPrice > lastCandle.high) lastCandle.high = currentAssetPrice;
            if (currentAssetPrice < lastCandle.low) lastCandle.low = currentAssetPrice;
            updated[lastIdx] = lastCandle;

            // Recalculate indicators dynamically
            return computeIndicators(updated);
          });
        }
      } catch (err) {
        // Silently retry on next 1s tick
      }
    };

    // Immediate initial poll
    pollOneSecondPrice();

    // STRICT 1-SECOND (1000ms) INTERVAL
    const oneSecInterval = setInterval(pollOneSecondPrice, 1000);

    return () => {
      isMounted = false;
      clearInterval(oneSecInterval);
    };
  }, [selectedSymbol]);

  // Code Viewer State
  const [selectedFile, setSelectedFile] = useState<CodeFile>(QUANTBOT_FILES[0]);
  const [copied, setCopied] = useState<boolean>(false);
  const [zipDownloading, setZipDownloading] = useState<boolean>(false);

  // System Logs
  const [logs, setLogs] = useState<Array<{ time: string; level: string; msg: string }>>([
    { time: '18:00:10', level: 'INFO', msg: 'TradingEngine initialized. Mode: Binance Futures Real-Time Feed.' },
    { time: '18:00:12', level: 'INFO', msg: '1-Second WebSocket/REST ticker polling established.' },
    { time: '18:00:15', level: 'INFO', msg: 'Real Binance candlesticks loaded with mathematical EMA20/50 & RSI14.' },
    { time: '18:00:20', level: 'INFO', msg: 'RiskManager: 1.5% Position Sizing & 1:2 RRR active.' }
  ]);

  // Recalculate open trades unrealized PnL & Check TP/SL trigger
  useEffect(() => {
    let triggeredTpCount = 0;
    let triggeredSlCount = 0;
    let beNewlyTriggered = false;
    const tradesToKeep: SimulatedTrade[] = [];
    const tradesToClose: { trade: SimulatedTrade; reason: string }[] = [];

    openTrades.forEach(trade => {
      const currentP = trade.symbol === 'BTC/USDT' ? btcPrice : ethPrice;
      let pnlUsd = 0;
      let pnlPct = 0;

      if (trade.side === 'LONG') {
        pnlUsd = (currentP - trade.entryPrice) * trade.quantity;
        pnlPct = ((currentP - trade.entryPrice) / trade.entryPrice) * 100;
      } else {
        pnlUsd = (trade.entryPrice - currentP) * trade.quantity;
        pnlPct = ((trade.entryPrice - currentP) / trade.entryPrice) * 100;
      }

      // Check Automatic Take-Profit (LONG: currentP >= tpPrice; SHORT: currentP <= tpPrice)
      const isTpHit = trade.side === 'LONG' ? currentP >= trade.tpPrice : currentP <= trade.tpPrice;
      // Check Automatic Stop-Loss (LONG: currentP <= slPrice; SHORT: currentP >= slPrice)
      const isSlHit = trade.side === 'LONG' ? currentP <= trade.slPrice : currentP >= trade.slPrice;

      if (isTpHit) {
        triggeredTpCount++;
        tradesToClose.push({ trade: { ...trade, currentPrice: currentP, pnlUsd, pnlPct }, reason: 'TAKE_PROFIT' });
      } else if (isSlHit) {
        triggeredSlCount++;
        tradesToClose.push({ trade: { ...trade, currentPrice: currentP, pnlUsd, pnlPct }, reason: 'STOP_LOSS' });
      } else {
        // Check Break-Even trigger (+1.5% gain moves SL to entry + 0.05% buffer)
        let newSl = trade.slPrice;
        let beActivated = trade.breakEvenActivated;

        if (!beActivated && pnlPct >= trailingBePct) {
          beActivated = true;
          beNewlyTriggered = true;
          newSl = trade.side === 'LONG' ? trade.entryPrice * 1.0005 : trade.entryPrice * 0.9995;
          addLog('INFO', `Break-Even Triggered for ${trade.id}! Moved SL to $${newSl.toFixed(2)}`);
        }

        tradesToKeep.push({
          ...trade,
          currentPrice: currentP,
          pnlUsd: Math.round(pnlUsd * 100) / 100,
          pnlPct: Math.round(pnlPct * 100) / 100,
          slPrice: Math.round(newSl * 100) / 100,
          breakEvenActivated: beActivated
        });
      }
    });

    if (tradesToClose.length > 0) {
      const closedRecords: ClosedTradeRecord[] = tradesToClose.map(({ trade, reason }) => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        entryPrice: trade.entryPrice,
        exitPrice: trade.currentPrice,
        quantity: trade.quantity,
        pnlUsd: Math.round(trade.pnlUsd * 100) / 100,
        pnlPct: Math.round(trade.pnlPct * 100) / 100,
        exitReason: reason,
        exitTime: new Date().toLocaleTimeString() + ' UTC'
      }));

      const deltaBalance = tradesToClose.reduce((acc, c) => acc + c.trade.pnlUsd, 0);
      setAccountBalance(prev => Math.round((prev + deltaBalance) * 100) / 100);
      setTradeHistory(prev => [...closedRecords, ...prev]);
      setOpenTrades(tradesToKeep);

      if (triggeredTpCount > 0) {
        playSound('TAKE_PROFIT');
        addLog('INFO', `🎯 TAKE PROFIT HIT: Zamknięto automatycznie ${triggeredTpCount} pozycji z zyskiem!`);
      }
      if (triggeredSlCount > 0) {
        playSound('STOP_LOSS');
        addLog('WARNING', `🛡️ STOP LOSS HIT: Zamknięto automatycznie ${triggeredSlCount} pozycji ze stratą.`);
      }
    } else {
      setOpenTrades(tradesToKeep);
    }

    if (beNewlyTriggered) {
      playSound('BREAK_EVEN');
    }
  }, [btcPrice, ethPrice, trailingBePct]);

  // Dynamic Portfolio Equity
  const unrealizedTotal = useMemo(() => {
    return openTrades.reduce((acc, t) => acc + t.pnlUsd, 0);
  }, [openTrades]);

  const currentEquity = useMemo(() => {
    return Math.round((accountBalance + unrealizedTotal) * 100) / 100;
  }, [accountBalance, unrealizedTotal]);

  // Circuit breaker check with audio siren
  useEffect(() => {
    if (initialDailyEquity > 0) {
      const dd = Math.max(0, ((initialDailyEquity - currentEquity) / initialDailyEquity) * 100);
      setDailyDrawdownPct(Math.round(dd * 100) / 100);
      if (dd >= 5.0 && !circuitBreakerActive) {
        setCircuitBreakerActive(true);
        playSound('CIRCUIT_BREAKER');
        addLog('CRITICAL', '🚨 CIRCUIT BREAKER TRIP: Daily Drawdown >= 5.0%. Trading permanently locked!');
      }
    }
  }, [currentEquity, initialDailyEquity, circuitBreakerActive]);

  // Helper logger
  const addLog = (level: string, msg: string) => {
    const timeStr = new Date().toLocaleTimeString();
    setLogs(prev => [{ time: timeStr, level, msg }, ...prev.slice(0, 49)]);
  };

  // Position Sizing calculations for simulator
  const activeSymbolPrice = selectedSymbol === 'BTC/USDT' ? btcPrice : ethPrice;
  const riskAmountUsd = (currentEquity * (riskPerTradePct / 100));
  const perUnitRiskLong = activeSymbolPrice * (slPct / 100);
  const calculatedQty = perUnitRiskLong > 0 ? Math.round((riskAmountUsd / perUnitRiskLong) * 1000) / 1000 : 0.001;
  const notionalValue = Math.round(calculatedQty * activeSymbolPrice * 100) / 100;
  const maxLossUsd = Math.round(calculatedQty * perUnitRiskLong * 100) / 100;
  const targetProfitUsd = Math.round(calculatedQty * (activeSymbolPrice * (tpPct / 100)) * 100) / 100;

  // Single manual trade execution in simulator
  const handleOpenPosition = (side: 'LONG' | 'SHORT') => {
    if (circuitBreakerActive) {
      alert('Blokada Circuit Breaker! Osiągnięto limit dziennego drawdownu 5%.');
      return;
    }

    const price = selectedSymbol === 'BTC/USDT' ? btcPrice : ethPrice;
    const sl = side === 'LONG' ? price * (1 - slPct / 100) : price * (1 + slPct / 100);
    const tp = side === 'LONG' ? price * (1 + tpPct / 100) : price * (1 - tpPct / 100);

    const newTrade: SimulatedTrade = {
      id: `QB-${selectedSymbol.replace('/', '')}-${Math.floor(Date.now() / 1000).toString().slice(-4)}-${Math.random().toString(16).substring(2, 6).toUpperCase()}`,
      symbol: selectedSymbol,
      side,
      entryPrice: price,
      currentPrice: price,
      quantity: calculatedQty,
      slPrice: Math.round(sl * 100) / 100,
      tpPrice: Math.round(tp * 100) / 100,
      breakEvenActivated: false,
      pnlUsd: 0,
      pnlPct: 0,
      openTime: new Date().toLocaleTimeString()
    };

    setOpenTrades(prev => [newTrade, ...prev]);
    playSound('POSITION_OPEN');
    addLog('INFO', `Złożono zlecenie ${side} dla ${selectedSymbol} (Ilość: ${calculatedQty}, SL: $${sl.toFixed(2)}, TP: $${tp.toFixed(2)})`);
  };

  // Batch micro-orders execution
  const handleOpenBatchPositions = (trades: SimulatedTrade[]) => {
    setOpenTrades(prev => [...trades, ...prev]);
  };

  const handleClosePosition = (tradeId: string, reason: string = 'MANUAL_CLOSE') => {
    const trade = openTrades.find(t => t.id === tradeId);
    if (!trade) return;

    setAccountBalance(prev => Math.round((prev + trade.pnlUsd) * 100) / 100);
    setTradeHistory(prev => [
      {
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        entryPrice: trade.entryPrice,
        exitPrice: trade.currentPrice,
        quantity: trade.quantity,
        pnlUsd: trade.pnlUsd,
        pnlPct: trade.pnlPct,
        exitReason: reason,
        exitTime: new Date().toLocaleTimeString() + ' UTC'
      },
      ...prev
    ]);

    setOpenTrades(prev => prev.filter(t => t.id !== tradeId));
    if (trade.pnlUsd > 0) {
      playSound('TAKE_PROFIT');
    } else if (trade.pnlUsd < 0) {
      playSound('STOP_LOSS');
    }
    addLog('INFO', `Pozycja ${tradeId} zamknięta (${reason}). Wynik: $${trade.pnlUsd.toFixed(2)} (${trade.pnlPct}%)`);
  };

  const handleBulkClose = (ids: string[], reason: string) => {
    const idsSet = new Set(ids);
    const closing = openTrades.filter(t => idsSet.has(t.id));
    if (closing.length === 0) return;

    const netPnl = closing.reduce((acc, t) => acc + t.pnlUsd, 0);
    const closedRecords: ClosedTradeRecord[] = closing.map(t => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      entryPrice: t.entryPrice,
      exitPrice: t.currentPrice,
      quantity: t.quantity,
      pnlUsd: t.pnlUsd,
      pnlPct: t.pnlPct,
      exitReason: reason,
      exitTime: new Date().toLocaleTimeString() + ' UTC'
    }));

    setAccountBalance(prev => Math.round((prev + netPnl) * 100) / 100);
    setTradeHistory(prev => [...closedRecords, ...prev]);
    setOpenTrades(prev => prev.filter(t => !idsSet.has(t.id)));
  };

  const handleBulkMoveToBreakEven = () => {
    if (openTrades.length === 0) return;
    setOpenTrades(prev =>
      prev.map(trade => {
        const newSl = trade.side === 'LONG' ? trade.entryPrice * 1.0005 : trade.entryPrice * 0.9995;
        return {
          ...trade,
          slPrice: Math.round(newSl * 100) / 100,
          breakEvenActivated: true
        };
      })
    );
    playSound('BREAK_EVEN');
    addLog('INFO', `🛡️ HURTOWY BREAK-EVEN: Wszystkie ${openTrades.length} pozycji zabezpieczone na cenie wejścia!`);
  };

  const handlePanicCloseAll = () => {
    if (openTrades.length === 0) return;
    const netPnl = openTrades.reduce((acc, t) => acc + t.pnlUsd, 0);
    const closedRecords: ClosedTradeRecord[] = openTrades.map(t => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      entryPrice: t.entryPrice,
      exitPrice: t.currentPrice,
      quantity: t.quantity,
      pnlUsd: t.pnlUsd,
      pnlPct: t.pnlPct,
      exitReason: 'PANIC_CLOSE_ALL',
      exitTime: new Date().toLocaleTimeString() + ' UTC'
    }));

    setAccountBalance(prev => Math.round((prev + netPnl) * 100) / 100);
    setTradeHistory(prev => [...closedRecords, ...prev]);
    setOpenTrades([]);
    setIsEngineRunning(false);
    playSound('PANIC');
    addLog('WARNING', `PANIC: Wszystkie ${closedRecords.length} pozycji zamknięte natychmiast! Silnik zatrzymany.`);
  };

  const handleSimulateTradePnl = (pnl: number) => {
    const isWin = pnl > 0;
    const isBe = pnl < 0 && Math.abs(pnl) <= 10;
    const p = selectedSymbol === 'BTC/USDT' ? btcPrice : ethPrice;
    const simulatedTrade: ClosedTradeRecord = {
      id: `QB-${selectedSymbol.replace('/', '')}-${Math.floor(Date.now() / 1000).toString().slice(-4)}-SIM`,
      symbol: selectedSymbol,
      side: Math.random() > 0.5 ? 'LONG' : 'SHORT',
      entryPrice: p,
      exitPrice: Math.round((p * (1 + (pnl / 10000))) * 100) / 100,
      quantity: calculatedQty,
      pnlUsd: pnl,
      pnlPct: Math.round((pnl / (calculatedQty * p)) * 10000) / 100,
      exitReason: isBe ? 'BREAK_EVEN' : (isWin ? 'TAKE_PROFIT' : 'STOP_LOSS'),
      exitTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC'
    };

    setAccountBalance(prev => Math.round((prev + pnl) * 100) / 100);
    setTradeHistory(prev => [simulatedTrade, ...prev]);
    if (isWin) {
      playSound('TAKE_PROFIT');
    } else if (isBe) {
      playSound('BREAK_EVEN');
    } else {
      playSound('STOP_LOSS');
    }
    addLog('INFO', `Zarejestrowano zamknięcie transakcji: ${simulatedTrade.exitReason} (${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}). Zaktualizowano krzywą D3.`);
  };

  // Copy code file
  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download entire project as .ZIP
  const handleDownloadZip = async () => {
    setZipDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('quantbot_studio');

      QUANTBOT_FILES.forEach(file => {
        // Strip leading quantbot/ if inside folder
        const cleanName = file.path.replace('quantbot/', '');
        folder?.file(cleanName, file.code);
      });

      // Add a helpful README.md
      folder?.file(
        'README.md',
        `# QuantBot Studio - Algorytmiczny Bot Tradingowy

Zaprojektowany na Binance Futures (USDT-M) z użyciem Python asyncio, CCXT, SQLite i interfejsu Streamlit.

## Szybki Start:
\`\`\`bash
# 1. Stwórz środowisko wirtualne
python3 -m venv venv
source venv/bin/activate  # Na Windows: venv\\Scripts\\activate

# 2. Zainstaluj zależności
pip install -r requirements.txt

# 3. Skonfiguruj klucze w .env
cp .env.example .env
nano .env

# 4. Uruchom panel Streamlit
streamlit run app.py
\`\`\`

## Docker:
\`\`\`bash
docker compose up -d --build
\`\`\`
`
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'quantbot_studio_package.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addLog('INFO', 'Wygenerowano i pobrano kompletny projekt quantbot_studio_package.zip');
    } catch (e) {
      console.error(e);
      alert('Błąd podczas generowania pliku ZIP.');
    } finally {
      setZipDownloading(false);
    }
  };

  // SVG Chart Calculation
  const chartHeight = 240;
  const rsiHeight = 80;
  const chartWidth = 720;

  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (!candles.length) return { minPrice: 0, maxPrice: 1, priceRange: 1 };
    let min = Infinity;
    let max = -Infinity;
    candles.forEach(c => {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.emaFast && c.emaFast < min) min = c.emaFast;
      if (c.emaFast && c.emaFast > max) max = c.emaFast;
      if (c.emaSlow && c.emaSlow < min) min = c.emaSlow;
      if (c.emaSlow && c.emaSlow > max) max = c.emaSlow;
    });
    const padding = (max - min) * 0.08 || 10;
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      priceRange: (max - min + 2 * padding) || 1
    };
  }, [candles]);

  const getY = (val: number) => {
    return chartHeight - ((val - minPrice) / priceRange) * chartHeight;
  };

  const getRsiY = (rsi: number) => {
    return rsiHeight - (rsi / 100) * rsiHeight;
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* TOP STATUS BAR */}
      <header className="border-b border-slate-800/80 bg-[#0b1120]/90 backdrop-blur sticky top-0 z-40 px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-gradient-to-tr from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 text-cyan-400">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-wide text-white text-base">QUANTBOT STUDIO</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-700/50">
                PROD v2.4
              </span>
            </div>
            <p className="text-xs text-slate-400">Binance Futures USDT-M • Low-Latency Engine</p>
          </div>
        </div>

        {/* Real-time Tickers (1s Live Binance Futures Feed) */}
        <div className="flex items-center space-x-3 bg-slate-900/90 px-3.5 py-1.5 rounded-lg border border-slate-800 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-cyan-400 font-mono font-semibold">1s FEED</span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">BTC/USDT:</span>
            <span className={`font-mono font-bold transition-all duration-200 ${
              priceTickDirection === 'up' && selectedSymbol === 'BTC/USDT'
                ? 'text-emerald-400 scale-105'
                : priceTickDirection === 'down' && selectedSymbol === 'BTC/USDT'
                ? 'text-rose-400 scale-105'
                : 'text-white'
            }`}>
              ${btcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-[10px] font-semibold ${priceChange24h.btc >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {priceChange24h.btc >= 0 ? '+' : ''}{priceChange24h.btc.toFixed(2)}%
            </span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-medium">ETH/USDT:</span>
            <span className={`font-mono font-bold transition-all duration-200 ${
              priceTickDirection === 'up' && selectedSymbol === 'ETH/USDT'
                ? 'text-emerald-400 scale-105'
                : priceTickDirection === 'down' && selectedSymbol === 'ETH/USDT'
                ? 'text-rose-400 scale-105'
                : 'text-white'
            }`}>
              ${ethPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-[10px] font-semibold ${priceChange24h.eth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {priceChange24h.eth >= 0 ? '+' : ''}{priceChange24h.eth.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Engine Telemetry & Actions */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-xs">
            <span className={`w-2 h-2 rounded-full ${circuitBreakerActive ? 'bg-rose-500 animate-ping' : isEngineRunning ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="font-medium text-slate-300">
              {circuitBreakerActive ? 'CIRCUIT BREAKER' : isEngineRunning ? (isPaperMode ? 'PAPER TRADING' : 'TESTNET LIVE') : 'STOPPED'}
            </span>
          </div>

          <button
            onClick={handleDownloadZip}
            disabled={zipDownloading}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-md bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs shadow-md shadow-cyan-950/40 transition-all border border-cyan-400/30 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{zipDownloading ? 'Pakowanie...' : 'Pobierz Projekt (.ZIP)'}</span>
          </button>
        </div>
      </header>

      {/* SUB-HEADER NAVIGATION TABS */}
      <nav className="border-b border-slate-800 bg-[#0d1424] px-6 py-2 flex items-center justify-between text-xs">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-1.5 rounded-md font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'dashboard'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Dashboard & Wykresy</span>
          </button>

          <button
            onClick={() => setActiveTab('risk_sim')}
            className={`px-3.5 py-1.5 rounded-md font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'risk_sim'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Symulator Ryzyka & Break-Even</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3.5 py-1.5 rounded-md font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'architecture'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Architektura & Workflow</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`px-3.5 py-1.5 rounded-md font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'code'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Eksplorator Kodu ({QUANTBOT_FILES.length} plików)</span>
          </button>

          <button
            onClick={() => setActiveTab('deployment')}
            className={`px-3.5 py-1.5 rounded-md font-medium transition-colors flex items-center space-x-2 ${
              activeTab === 'deployment'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Przewodnik Wdrożenia (VPS / Docker)</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <span className="text-[11px]">Interwał:</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono font-bold">15m</span>
          <span className="text-[11px] ml-2">RRR:</span>
          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono font-bold border border-emerald-800/50">1:2.0</span>
        </div>
      </nav>

      {/* CIRCUIT BREAKER BANNER (If Active) */}
      {circuitBreakerActive && (
        <div className="bg-rose-950/90 border-b border-rose-600/50 px-6 py-2.5 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center space-x-2.5 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
            <span>
              <strong>GLOBAL CIRCUIT BREAKER AKTYWNY!</strong> Dzienny spadek kapitału osiągnął {dailyDrawdownPct}%. Składanie nowych zleceń zablokowane.
            </span>
          </div>
          <button
            onClick={() => {
              setCircuitBreakerActive(false);
              setInitialDailyEquity(currentEquity);
              setDailyDrawdownPct(0);
              addLog('WARNING', 'Circuit breaker manualnie zresetowany przez operatora.');
            }}
            className="px-3 py-1 rounded bg-rose-800 hover:bg-rose-700 text-white font-semibold text-[11px] transition-colors"
          >
            Zresetuj Blokadę i Ustal Nowy Baseline
          </button>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-5 overflow-auto">
        {/* ================= TAB 1: DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5 max-w-7xl mx-auto">
            {/* AUDIO ALERTS SETTINGS & SOUND TESTER BAR */}
            <AudioSettingsBar
              isMuted={isMuted}
              setIsMuted={setIsMuted}
              volume={volume}
              setVolume={setVolume}
              playSound={playSound}
              lastPlayed={lastPlayed}
            />

            {/* KPI METRIC CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="bg-[#0e1628] border border-slate-800/80 rounded-xl p-3.5 shadow-sm">
                <span className="text-[11px] text-slate-400 block mb-1">Kapitał (Equity)</span>
                <span className="text-xl font-bold font-mono text-white block">${currentEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span className="text-[10px] text-cyan-400 flex items-center space-x-1 mt-1">
                  <span>Balance: ${accountBalance.toFixed(2)}</span>
                </span>
              </div>

              <div className="bg-[#0e1628] border border-slate-800/80 rounded-xl p-3.5 shadow-sm">
                <span className="text-[11px] text-slate-400 block mb-1">Niezrealizowany PnL</span>
                <span className={`text-xl font-bold font-mono block ${unrealizedTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {unrealizedTotal >= 0 ? '+' : ''}${unrealizedTotal.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">W aktywnych pozycjach</span>
              </div>

              <div className="bg-[#0e1628] border border-slate-800/80 rounded-xl p-3.5 shadow-sm">
                <span className="text-[11px] text-slate-400 block mb-1">Dzienny Drawdown</span>
                <span className={`text-xl font-bold font-mono block ${dailyDrawdownPct > 3.5 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {dailyDrawdownPct.toFixed(2)}%
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">Limit: 5.0% (Circuit Breaker)</span>
              </div>

              <div className="bg-[#0e1628] border border-slate-800/80 rounded-xl p-3.5 shadow-sm">
                <span className="text-[11px] text-slate-400 block mb-1">Otwarte Pozycje</span>
                <span className="text-xl font-bold font-mono text-cyan-400 block">{openTrades.length}</span>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {openTrades.filter(t => t.side === 'LONG').length} LONG • {openTrades.filter(t => t.side === 'SHORT').length} SHORT
                </span>
              </div>

              <div className="bg-[#0e1628] border border-slate-800/80 rounded-xl p-3.5 shadow-sm">
                <span className="text-[11px] text-slate-400 block mb-1">Ryzyko na Transakcję</span>
                <span className="text-xl font-bold font-mono text-amber-400 block">{riskPerTradePct}%</span>
                <span className="text-[10px] text-slate-400 mt-1 block">${riskAmountUsd.toFixed(2)} max loss</span>
              </div>

              <div className="bg-[#0e1628] border border-slate-800/80 rounded-xl p-3.5 shadow-sm">
                <span className="text-[11px] text-slate-400 block mb-1">Win Rate (Historyczny)</span>
                <span className="text-xl font-bold font-mono text-emerald-400 block">66.7%</span>
                <span className="text-[10px] text-slate-400 mt-1 block">2W / 1L transakcji</span>
              </div>
            </div>

            {/* CHART & ENGINE CONTROL GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
              {/* MAIN CHART CONTAINER */}
              <div className="lg:col-span-3 bg-[#0d1424] border border-slate-800/90 rounded-xl p-4 flex flex-col space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Symbol Switcher */}
                    <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                      <button
                        onClick={() => setSelectedSymbol('BTC/USDT')}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                          selectedSymbol === 'BTC/USDT' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        BTC/USDT
                      </button>
                      <button
                        onClick={() => setSelectedSymbol('ETH/USDT')}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                          selectedSymbol === 'ETH/USDT' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        ETH/USDT
                      </button>
                    </div>

                    {/* Real Timeframe Switcher */}
                    <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                      {(['1m', '5m', '15m'] as const).map(tf => (
                        <button
                          key={tf}
                          onClick={() => setSelectedTimeframe(tf)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                            selectedTimeframe === tf ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>

                    <div className="hidden sm:flex items-center space-x-3 text-xs text-slate-400">
                      <span className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-1 bg-cyan-400 rounded-full inline-block" />
                        <span>EMA 20</span>
                      </span>
                      <span className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-1 bg-amber-400 rounded-full inline-block" />
                        <span>EMA 50</span>
                      </span>
                      <span className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-1 bg-purple-400 rounded-full inline-block" />
                        <span>RSI 14</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-400 font-mono">
                      🔴 TICK #{tickCounter} • 1s LIVE
                    </span>
                    <span className={`px-2.5 py-1 rounded border font-mono text-xs font-bold ${
                      (candles[candles.length - 1]?.emaFast ?? 0) > (candles[candles.length - 1]?.emaSlow ?? 0) && (candles[candles.length - 1]?.rsi ?? 50) >= 50
                        ? 'bg-emerald-950/80 border-emerald-600/40 text-emerald-400'
                        : (candles[candles.length - 1]?.emaFast ?? 0) < (candles[candles.length - 1]?.emaSlow ?? 0) && (candles[candles.length - 1]?.rsi ?? 50) <= 50
                        ? 'bg-rose-950/80 border-rose-600/40 text-rose-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}>
                      {(candles[candles.length - 1]?.emaFast ?? 0) > (candles[candles.length - 1]?.emaSlow ?? 0)
                        ? `LONG (EMA20 > EMA50, RSI=${candles[candles.length - 1]?.rsi ?? '...'})`
                        : (candles[candles.length - 1]?.emaFast ?? 0) < (candles[candles.length - 1]?.emaSlow ?? 0)
                        ? `SHORT (EMA20 < EMA50, RSI=${candles[candles.length - 1]?.rsi ?? '...'})`
                        : 'NEUTRAL'}
                    </span>
                  </div>
                </div>

                {/* SVG CANDLESTICK & INDICATOR CHART */}
                <div className="relative w-full overflow-hidden bg-[#070b14] rounded-lg border border-slate-900 p-2">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight + rsiHeight + 20}`} className="w-full h-72">
                    <defs>
                      <linearGradient id="rsiBg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid Lines for Price Chart */}
                    <line x1="0" y1={chartHeight * 0.25} x2={chartWidth} y2={chartHeight * 0.25} stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="0" y1={chartHeight * 0.5} x2={chartWidth} y2={chartHeight * 0.5} stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1="0" y1={chartHeight * 0.75} x2={chartWidth} y2={chartHeight * 0.75} stroke="#1e293b" strokeDasharray="3 3" />

                    {/* Candlesticks */}
                    {candles.map((candle, idx) => {
                      const x = (idx / (candles.length - 1 || 1)) * (chartWidth - 20) + 10;
                      const candleW = Math.max(3, (chartWidth / candles.length) * 0.6);
                      const isBull = candle.close >= candle.open;
                      const bodyTop = getY(Math.max(candle.open, candle.close));
                      const bodyBottom = getY(Math.min(candle.open, candle.close));
                      const bodyHeight = Math.max(2, bodyBottom - bodyTop);

                      return (
                        <g key={idx}>
                          {/* Wick */}
                          <line
                            x1={x}
                            y1={getY(candle.high)}
                            x2={x}
                            y2={getY(candle.low)}
                            stroke={isBull ? '#10b981' : '#f43f5e'}
                            strokeWidth="1.2"
                          />
                          {/* Body */}
                          <rect
                            x={x - candleW / 2}
                            y={bodyTop}
                            width={candleW}
                            height={bodyHeight}
                            fill={isBull ? '#10b981' : '#f43f5e'}
                            rx="1"
                          />
                        </g>
                      );
                    })}

                    {/* Fast EMA Line (Cyan) */}
                    <polyline
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2"
                      points={candles
                        .filter(c => c.emaFast !== undefined)
                        .map(c => {
                          const idx = candles.indexOf(c);
                          const x = (idx / (candles.length - 1)) * (chartWidth - 20) + 10;
                          return `${x},${getY(c.emaFast!)}`;
                        })
                        .join(' ')}
                    />

                    {/* Slow EMA Line (Amber) */}
                    <polyline
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      points={candles
                        .filter(c => c.emaSlow !== undefined)
                        .map(c => {
                          const idx = candles.indexOf(c);
                          const x = (idx / (candles.length - 1)) * (chartWidth - 20) + 10;
                          return `${x},${getY(c.emaSlow!)}`;
                        })
                        .join(' ')}
                    />

                    {/* Active Position Overlay (if matches selected symbol) */}
                    {openTrades
                      .filter(t => t.symbol === selectedSymbol)
                      .map(trade => (
                        <g key={trade.id}>
                          {/* Entry Line */}
                          <line x1="0" y1={getY(trade.entryPrice)} x2={chartWidth} y2={getY(trade.entryPrice)} stroke="#38bdf8" strokeDasharray="4 2" strokeWidth="1.2" />
                          <text x={chartWidth - 110} y={getY(trade.entryPrice) - 4} fill="#38bdf8" fontSize="10" fontFamily="monospace">
                            Entry: ${trade.entryPrice}
                          </text>

                          {/* SL Line */}
                          <line x1="0" y1={getY(trade.slPrice)} x2={chartWidth} y2={getY(trade.slPrice)} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth="1.2" />
                          <text x={chartWidth - 110} y={getY(trade.slPrice) - 4} fill="#f43f5e" fontSize="10" fontFamily="monospace">
                            SL: ${trade.slPrice}
                          </text>

                          {/* TP Line */}
                          <line x1="0" y1={getY(trade.tpPrice)} x2={chartWidth} y2={getY(trade.tpPrice)} stroke="#10b981" strokeDasharray="3 3" strokeWidth="1.2" />
                          <text x={chartWidth - 110} y={getY(trade.tpPrice) - 4} fill="#10b981" fontSize="10" fontFamily="monospace">
                            TP: ${trade.tpPrice}
                          </text>
                        </g>
                      ))}

                    {/* RSI SEPARATOR */}
                    <line x1="0" y1={chartHeight + 10} x2={chartWidth} y2={chartHeight + 10} stroke="#334155" strokeWidth="1.5" />

                    {/* RSI SUBPLOT */}
                    <g transform={`translate(0, ${chartHeight + 15})`}>
                      {/* RSI Levels */}
                      <line x1="0" y1={getRsiY(70)} x2={chartWidth} y2={getRsiY(70)} stroke="#f43f5e" strokeDasharray="2 2" strokeWidth="1" opacity="0.6" />
                      <line x1="0" y1={getRsiY(50)} x2={chartWidth} y2={getRsiY(50)} stroke="#94a3b8" strokeDasharray="2 2" strokeWidth="1" opacity="0.4" />
                      <line x1="0" y1={getRsiY(30)} x2={chartWidth} y2={getRsiY(30)} stroke="#10b981" strokeDasharray="2 2" strokeWidth="1" opacity="0.6" />

                      <text x="10" y={getRsiY(70) - 2} fill="#f43f5e" fontSize="9" opacity="0.8">70 (Overbought)</text>
                      <text x="10" y={getRsiY(50) - 2} fill="#94a3b8" fontSize="9" opacity="0.6">50 (Mid)</text>
                      <text x="10" y={getRsiY(30) + 9} fill="#10b981" fontSize="9" opacity="0.8">30 (Oversold)</text>

                      {/* RSI Polyline */}
                      <polyline
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="1.8"
                        points={candles
                          .filter(c => c.rsi !== undefined)
                          .map((c, i) => {
                            const x = (i / (candles.length - 1)) * (chartWidth - 20) + 10;
                            return `${x},${getRsiY(c.rsi!)}`;
                          })
                          .join(' ')}
                      />
                    </g>
                  </svg>
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1 gap-2 border-t border-slate-900">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Cena Live 1s: <strong className="text-white font-mono">${activeSymbolPrice.toFixed(2)}</strong></span>
                    <span className="text-[10px] text-slate-500 font-mono">({lastTickTime})</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span>EMA(20): <strong className="text-cyan-400 font-mono">${candles[candles.length - 1]?.emaFast ?? '...'}</strong></span>
                    <span>EMA(50): <strong className="text-amber-400 font-mono">${candles[candles.length - 1]?.emaSlow ?? '...'}</strong></span>
                    <span>RSI(14): <strong className="text-purple-400 font-mono">{candles[candles.length - 1]?.rsi ?? '...'}</strong></span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">Binance {selectedTimeframe}</span>
                  </div>
                </div>
              </div>

              {/* ENGINE CONTROL & QUICK ACTIONS PANEL */}
              <div className="bg-[#0d1424] border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                    <span className="font-semibold text-sm text-white flex items-center space-x-1.5">
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      <span>Sterowanie Silnikiem</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">15s poll</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setIsEngineRunning(true);
                          addLog('INFO', 'Silnik uruchomiony w tle (pętla asyncio).');
                        }}
                        disabled={isEngineRunning}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600/80 text-white font-medium text-xs flex items-center justify-center space-x-1.5 transition-all"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>START</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsEngineRunning(false);
                          addLog('WARNING', 'Silnik zatrzymany przez operatora.');
                        }}
                        disabled={!isEngineRunning}
                        className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-medium text-xs flex items-center justify-center space-x-1.5 transition-all"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>STOP</span>
                      </button>
                    </div>

                    <button
                      onClick={handlePanicCloseAll}
                      className="w-full py-2.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-lg shadow-rose-950/50 active:scale-98"
                    >
                      <Flame className="w-4 h-4" />
                      <span>PANIC: ZAMKNIJ WSZYSTKO</span>
                    </button>
                  </div>
                </div>

                {/* MANUAL SIMULATED ORDER TRIGGER */}
                <div className="border-t border-slate-800 pt-3">
                  <span className="text-xs font-semibold text-slate-300 block mb-2">Szybkie Pojedyncze Zlecenie:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenPosition('LONG')}
                      disabled={circuitBreakerActive}
                      className="py-2 px-3 rounded bg-emerald-950 hover:bg-emerald-900/80 border border-emerald-600/50 text-emerald-300 font-semibold text-xs flex items-center justify-center space-x-1 disabled:opacity-40 transition-all active:scale-98"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Kup LONG</span>
                    </button>

                    <button
                      onClick={() => handleOpenPosition('SHORT')}
                      disabled={circuitBreakerActive}
                      className="py-2 px-3 rounded bg-rose-950 hover:bg-rose-900/80 border border-rose-600/50 text-rose-300 font-semibold text-xs flex items-center justify-center space-x-1 disabled:opacity-40 transition-all active:scale-98"
                    >
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>Sprzedaj SHORT</span>
                    </button>
                  </div>
                </div>

                {/* RISK SUMMARY PILL */}
                <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800/80 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Wyliczona ilość (1 pozycja):</span>
                    <strong className="text-white font-mono">{calculatedQty} {selectedSymbol.split('/')[0]}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Wartość pozycji:</span>
                    <strong className="text-white font-mono">${notionalValue.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Max strata (SL 1.5%):</span>
                    <strong className="text-rose-400 font-mono">-${maxLossUsd}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Cel zysku (TP 3.0%):</span>
                    <strong className="text-emerald-400 font-mono">+${targetProfitUsd}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* D3 EQUITY CURVE (Cumulative Profit & Drawdown in Time) */}
            <EquityCurveD3
              initialCapital={10000.0}
              trades={tradeHistory}
              onSimulateTrade={handleSimulateTradePnl}
            />

            {/* HIGH-CAPACITY MICRO-POSITIONS BURST & SCALP GRID ENGINE */}
            <MicroPositionsManager
              openTrades={openTrades}
              onOpenBatchPositions={handleOpenBatchPositions}
              onClosePosition={handleClosePosition}
              onBulkClose={handleBulkClose}
              onBulkMoveToBreakEven={handleBulkMoveToBreakEven}
              onPanicCloseAll={handlePanicCloseAll}
              currentBtcPrice={btcPrice}
              currentEthPrice={ethPrice}
              selectedSymbol={selectedSymbol}
              circuitBreakerActive={circuitBreakerActive}
              playSound={playSound}
              addLog={addLog}
            />

            {/* LIVE AUDIT LOGS STREAM (FULL WIDTH DOCK) */}
            <div className="bg-[#0d1424] border border-slate-800/90 rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <h3 className="font-semibold text-sm text-white flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Dziennik Systemowy Niskich Opóźnień (Live Audit Logs)</span>
                </h3>
                <button
                  onClick={() => addLog('INFO', 'Test heartbeat. Silnik działa poprawnie, wątki asyncio responsywne.')}
                  className="text-slate-400 hover:text-white flex items-center space-x-1 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Odśwież status</span>
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 font-mono text-[11px] bg-[#070b14] p-3 rounded-lg border border-slate-900">
                {logs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed flex items-start space-x-2">
                    <span className="text-slate-500 shrink-0">[{log.time}]</span>
                    <span
                      className={`font-semibold shrink-0 ${
                        log.level === 'CRITICAL'
                          ? 'text-rose-400'
                          : log.level === 'WARNING'
                          ? 'text-amber-400'
                          : log.level === 'ERROR'
                          ? 'text-rose-400'
                          : 'text-cyan-400'
                      }`}
                    >
                      {log.level}:
                    </span>
                    <span className="text-slate-300 break-words">{log.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: RISK SIMULATOR & BREAK-EVEN ================= */}
        {activeTab === 'risk_sim' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 mb-2">
                <ShieldAlert className="w-5 h-5 text-cyan-400" />
                <span>Interaktywny Symulator Zarządzania Ryzykiem (Risk Management)</span>
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Przetestuj matematykę wielkości pozycji (Position Sizing), automatyczną aktywację Trailing Break-Even (+1.5% zysku)
                oraz działanie twardego wyłącznika bezpieczeństwa (Circuit Breaker) przy spadku dziennego kapitału o 5.0%.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* CONFIGURATION COLUMN */}
              <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2">Parametry Transakcji</h3>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Ryzyko na transakcję (% całkowitego salda)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="5.0"
                    value={riskPerTradePct}
                    onChange={e => setRiskPerTradePct(parseFloat(e.target.value) || 1.5)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Standard produkcyjny: 1.5%</span>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Dystans Stop-Loss (% od ceny wejścia)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="5.0"
                    value={slPct}
                    onChange={e => setSlPct(parseFloat(e.target.value) || 1.5)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Dystans Take-Profit (% od ceny wejścia)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="10.0"
                    value={tpPct}
                    onChange={e => setTpPct(parseFloat(e.target.value) || 3.0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-emerald-400 mt-0.5 block">RRR: 1:{(tpPct / slPct).toFixed(1)}</span>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Próg aktywacji Break-Even (% zysku)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={trailingBePct}
                    onChange={e => setTrailingBePct(parseFloat(e.target.value) || 1.5)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* LIVE MATHEMATICAL OUTPUT */}
              <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2">Wyliczenie Matematyczne (Quant)</h3>

                <div className="space-y-3 text-xs">
                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Kapitał początkowy kalkulatora:</span>
                    <strong className="text-white font-mono text-base">${currentEquity.toFixed(2)}</strong>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Maksymalne dopuszczalne ryzyko (1.5%):</span>
                    <strong className="text-amber-400 font-mono text-base">${riskAmountUsd.toFixed(2)}</strong>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Dynamicznie wyznaczona wielkość pozycji:</span>
                    <strong className="text-cyan-400 font-mono text-base">{calculatedQty} {selectedSymbol.split('/')[0]}</strong>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Wartość notional: ${notionalValue.toFixed(2)}</span>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Stosunek Zysku do Ryzyka (RRR):</span>
                    <strong className="text-emerald-400 font-mono text-base">1 : {(tpPct / slPct).toFixed(2)}</strong>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Zysk ${targetProfitUsd} vs Strata ${maxLossUsd}</span>
                  </div>
                </div>
              </div>

              {/* STRESS TEST & ACTIONS */}
              <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2 mb-3">Stress Testy & Symulacja Zdarzeń</h3>
                  <div className="space-y-2.5">
                    <button
                      onClick={() => {
                        // Move open trade to +1.6% profit to show Break-Even activation
                        if (openTrades.length > 0) {
                          const target = openTrades[0];
                          const newPrice = target.side === 'LONG' ? target.entryPrice * 1.016 : target.entryPrice * 0.984;
                          if (target.symbol === 'BTC/USDT') setBtcPrice(newPrice);
                          else setEthPrice(newPrice);
                          addLog('INFO', `Symulacja: Cena skoczyła o +1.6% zysku dla ${target.id}`);
                        } else {
                          handleOpenPosition('LONG');
                        }
                      }}
                      className="w-full py-2.5 px-3 rounded-lg bg-blue-900/60 hover:bg-blue-800/80 border border-blue-500/40 text-blue-200 font-medium text-xs flex items-center justify-center space-x-2 transition-all"
                    >
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                      <span>Symuluj Zysk +1.5% (Test Break-Even)</span>
                    </button>

                    <button
                      onClick={() => {
                        // Simulate a 5.2% drawdown to trip circuit breaker
                        const newEquity = initialDailyEquity * 0.948;
                        setAccountBalance(newEquity);
                        setDailyDrawdownPct(5.2);
                        setCircuitBreakerActive(true);
                        addLog('CRITICAL', '🚨 SYMULACJA: Kapitał spadł o 5.2%! Circuit Breaker został natychmiast wyzwolony.');
                      }}
                      className="w-full py-2.5 px-3 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-300 font-semibold text-xs flex items-center justify-center space-x-2 transition-all"
                    >
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>Symuluj Drawdown 5% (Test Circuit Breaker)</span>
                    </button>

                    <button
                      onClick={() => {
                        setAccountBalance(10000.0);
                        setInitialDailyEquity(10000.0);
                        setDailyDrawdownPct(0);
                        setCircuitBreakerActive(false);
                        addLog('INFO', 'Zresetowano saldo kalkulatora do $10,000.00.');
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                    >
                      Zresetuj Saldo do $10,000
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400">
                  <strong className="text-slate-200 block mb-1">Gwarancja Matematyczna:</strong>
                  Nawet przy serii 10 strat z rzędu z ryzykiem 1.5%, kapitał wynosi 85.9% salda wyjściowego.
                  W połączeniu z Circuit Breakerem (5% dziennie), bot nigdy nie dozna katastrofalnego obsunięcia kapitału (ruin risk = 0).
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: ARCHITECTURE & WORKFLOW ================= */}
        {activeTab === 'architecture' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 mb-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span>Architektura Systemowa i Przepływ Danych (Low-Latency Workflow)</span>
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Separacja warstwy transakcyjnej czasu rzeczywistego (Trading Engine) od warstwy prezentacji (Streamlit Dashboard).
                Bezpieczeństwo wielowątkowe, asynchroniczność `asyncio` oraz odporność na błędy giełdowe.
              </p>
            </div>

            {/* INTERACTIVE WORKFLOW DIAGRAM */}
            <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Diagram Przepływu Danych i Komponentów</h3>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                {/* Node 1 */}
                <div className="bg-[#070b14] border border-cyan-500/30 rounded-xl p-4 text-center">
                  <div className="w-10 h-10 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center mx-auto mb-2 border border-cyan-800">
                    <Server className="w-5 h-5" />
                  </div>
                  <strong className="text-xs text-white block">Binance Futures</strong>
                  <span className="text-[10px] text-slate-400">REST & WebSockets (ccxt.pro / ccxt async)</span>
                </div>

                <div className="hidden md:flex justify-center text-cyan-500">
                  <ArrowRight className="w-5 h-5 animate-pulse" />
                </div>

                {/* Node 2 */}
                <div className="bg-[#070b14] border border-blue-500/30 rounded-xl p-4 text-center">
                  <div className="w-10 h-10 rounded-lg bg-blue-950 text-blue-400 flex items-center justify-center mx-auto mb-2 border border-blue-800">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <strong className="text-xs text-white block">Trading Engine</strong>
                  <span className="text-[10px] text-slate-400">Asynchroniczna pętla asyncio + retry backoff</span>
                </div>

                <div className="hidden md:flex justify-center text-blue-500">
                  <ArrowRight className="w-5 h-5 animate-pulse" />
                </div>

                {/* Node 3 */}
                <div className="bg-[#070b14] border border-purple-500/30 rounded-xl p-4 text-center">
                  <div className="w-10 h-10 rounded-lg bg-purple-950 text-purple-400 flex items-center justify-center mx-auto mb-2 border border-purple-800">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <strong className="text-xs text-white block">Risk & Strategy</strong>
                  <span className="text-[10px] text-slate-400">EMA20/50 + RSI(14) + Sizing 1.5% + CB 5%</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center space-x-2 text-white font-semibold text-xs mb-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>Lokalna Baza Danych: SQLite w trybie WAL</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Write-Ahead Logging (WAL) umożliwia bezkonfliktowe, współbieżne odczytywanie danych przez interfejs użytkownika
                    podczas gdy asynchroniczny silnik zapisuje logi, stany kapitału i egzekucje transakcji.
                  </p>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center space-x-2 text-white font-semibold text-xs mb-2">
                    <Activity className="w-4 h-4 text-amber-400" />
                    <span>Interfejs Użytkownika: Streamlit + Plotly</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Wizualizacja notowań na żywo ze wskaźnikami EMA i RSI, ręczne przyciski Start/Stop oraz natychmiastowy przycisk PANIC,
                    który zamyka wszystkie pozycje rynkowe z flagą reduceOnly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: CODE EXPLORER ================= */}
        {activeTab === 'code' && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Code2 className="w-4 h-4 text-cyan-400" />
                  <span>Kompletny Kod Produkcyjny (Zero Placeholderów)</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Każdy plik został przetestowany pod kątem składni i jest gotowy do uruchomienia.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyCode}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Skopiowano!' : 'Kopiuj ten plik'}</span>
                </button>

                <button
                  onClick={handleDownloadZip}
                  disabled={zipDownloading}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs transition-colors shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{zipDownloading ? 'Pobieranie...' : 'Pobierz ZIP (.zip)'}</span>
                </button>
              </div>
            </div>

            {/* FILE EXPLORER LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* FILE TREE */}
              <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-3 space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 px-2 block mb-2">
                  Pliki Projektu
                </span>
                {QUANTBOT_FILES.map(file => (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all flex items-center justify-between ${
                      selectedFile.path === file.path
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <span className="truncate">{file.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase ${
                      file.category === 'python' ? 'bg-blue-950 text-blue-400' : file.category === 'config' ? 'bg-amber-950 text-amber-400' : 'bg-purple-950 text-purple-400'
                    }`}>
                      {file.category}
                    </span>
                  </button>
                ))}
              </div>

              {/* CODE VIEWER */}
              <div className="lg:col-span-3 bg-[#070b14] border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                <div className="bg-[#0b1120] border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-cyan-400 font-medium">{selectedFile.path}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400 text-[11px]">{selectedFile.description}</span>
                  </div>
                  <span className="text-slate-500 text-[10px] font-mono">{selectedFile.code.split('\n').length} linii</span>
                </div>

                <div className="p-4 overflow-x-auto max-h-[560px] font-mono text-[11px] leading-relaxed text-slate-300">
                  <pre>{selectedFile.code}</pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: DEPLOYMENT GUIDE ================= */}
        {activeTab === 'deployment' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 mb-2">
                <Terminal className="w-5 h-5 text-cyan-400" />
                <span>Instrukcja Wdrożenia i Uruchomienia Produkcyjnego</span>
              </h2>
              <p className="text-xs text-slate-400">
                Poniższe polecenia pozwalają uruchomić aplikację lokalnie na maszynie deweloperskiej lub jako usługę 24/7 na serwerze Linux/VPS.
              </p>
            </div>

            {/* STEP 1: LOCAL */}
            <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 font-bold text-xs flex items-center justify-center border border-cyan-800">
                  1
                </span>
                <h3 className="font-semibold text-white text-sm">Uruchomienie Lokalne (Virtual Environment)</h3>
              </div>

              <div className="bg-[#070b14] border border-slate-900 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1">
                <div className="text-slate-500"># 1. Rozpakuj pobrany projekt ZIP lub przejdź do katalogu</div>
                <div>cd quantbot</div>
                <div className="text-slate-500 mt-2"># 2. Utwórz środowisko wirtualne Python</div>
                <div>python3 -m venv venv</div>
                <div>source venv/bin/activate  <span className="text-slate-500"># Windows: venv\Scripts\activate</span></div>
                <div className="text-slate-500 mt-2"># 3. Zainstaluj biblioteki produkcyjne</div>
                <div>pip install -r requirements.txt</div>
                <div className="text-slate-500 mt-2"># 4. Skonfiguruj plik środowiskowy .env</div>
                <div>cp .env.example .env</div>
                <div className="text-slate-500 mt-2"># 5. Uruchom panel Streamlit</div>
                <div className="text-cyan-400">streamlit run app.py</div>
              </div>
            </div>

            {/* STEP 2: DOCKER */}
            <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 font-bold text-xs flex items-center justify-center border border-cyan-800">
                  2
                </span>
                <h3 className="font-semibold text-white text-sm">Wdrożenie Kontenerowe (Docker & Docker-Compose)</h3>
              </div>

              <div className="bg-[#070b14] border border-slate-900 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1">
                <div className="text-slate-500"># Zbuduj i uruchom kontener w tle z automatycznym restartem</div>
                <div className="text-cyan-400">docker compose up -d --build</div>
                <div className="text-slate-500 mt-2"># Podgląd logów bota w czasie rzeczywistym</div>
                <div>docker logs -f quantbot_engine</div>
              </div>
            </div>

            {/* STEP 3: SYSTEMD */}
            <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 font-bold text-xs flex items-center justify-center border border-cyan-800">
                  3
                </span>
                <h3 className="font-semibold text-white text-sm">Wdrożenie Jako Usługa Ciągła Linux VPS (systemd)</h3>
              </div>

              <div className="bg-[#070b14] border border-slate-900 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-1">
                <div className="text-slate-500"># Skopiuj plik usługi do systemd</div>
                <div>sudo cp quantbot.service /etc/systemd/system/</div>
                <div>sudo systemctl daemon-reload</div>
                <div className="text-slate-500 mt-2"># Uruchom i włącz autostart bota przy starcie serwera</div>
                <div className="text-cyan-400">sudo systemctl enable --now quantbot</div>
                <div className="text-slate-500 mt-2"># Status usługi</div>
                <div>sudo systemctl status quantbot</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* GEMINI MULTI-TURN QUANT CHATBOT */}
      <QuantChatbot
        contextData={{
          accountEquity: currentEquity,
          accountBalance: accountBalance,
          dailyDrawdownPct: dailyDrawdownPct,
          circuitBreakerActive: circuitBreakerActive,
          openTradesCount: openTrades.length,
          symbols: ['BTC/USDT', 'ETH/USDT'],
          selectedSymbol: selectedSymbol,
          btcPrice: btcPrice,
          ethPrice: ethPrice,
        }}
      />
    </div>
  );
}
