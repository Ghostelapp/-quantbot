/**
 * MicroPositionsManager - High-Capacity Burst Micro-Orders & Scalp Grid Engine
 * Supports generating and managing large batches (10 to 100+) of micro-positions
 * with grid ladder spacing, bulk actions (Harvest Profitable, Cut Losses, Mass Break-Even),
 * and aggregate portfolio telemetry.
 */

import React, { useState, useMemo } from 'react';
import {
  Layers,
  Zap,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Flame,
  Search,
  Filter,
  ArrowUpDown,
  Coins,
  Scale,
  Sparkles
} from 'lucide-react';
import { SimulatedTrade } from '../App';
import { SoundEventType } from '../hooks/useTradingAudio';

interface MicroPositionsManagerProps {
  openTrades: SimulatedTrade[];
  onOpenBatchPositions: (trades: SimulatedTrade[]) => void;
  onClosePosition: (id: string, reason: string) => void;
  onBulkClose: (ids: string[], reason: string) => void;
  onBulkMoveToBreakEven: () => void;
  onPanicCloseAll: () => void;
  currentBtcPrice: number;
  currentEthPrice: number;
  selectedSymbol: 'BTC/USDT' | 'ETH/USDT';
  circuitBreakerActive: boolean;
  playSound: (type: SoundEventType) => void;
  addLog: (level: string, msg: string) => void;
}

export const MicroPositionsManager: React.FC<MicroPositionsManagerProps> = ({
  openTrades,
  onOpenBatchPositions,
  onClosePosition,
  onBulkClose,
  onBulkMoveToBreakEven,
  onPanicCloseAll,
  currentBtcPrice,
  currentEthPrice,
  selectedSymbol,
  circuitBreakerActive,
  playSound,
  addLog
}) => {
  // Batch Generator State
  const [batchCount, setBatchCount] = useState<number>(20);
  const [batchMode, setBatchMode] = useState<'LONG' | 'SHORT' | 'GRID'>('GRID');
  const [spreadStepPct, setSpreadStepPct] = useState<number>(0.05); // 0.05% per step
  const [notionalPerOrder, setNotionalPerOrder] = useState<number>(25); // $25 per micro position
  const [batchSlPct, setBatchSlPct] = useState<number>(1.2);
  const [batchTpPct, setBatchTpPct] = useState<number>(2.4);
  const [isExecutingBurst, setIsExecutingBurst] = useState<boolean>(false);

  // Table Filtering & Sorting
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'PROFIT' | 'LOSS' | 'LONG' | 'SHORT'>('ALL');
  const [sortBy, setSortBy] = useState<'openTime' | 'pnlUsd' | 'pnlPct' | 'symbol' | 'entryPrice'>('pnlUsd');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  const currentPrice = selectedSymbol === 'BTC/USDT' ? currentBtcPrice : currentEthPrice;

  // Aggregate stats across all open positions
  const telemetry = useMemo(() => {
    const totalCount = openTrades.length;
    const totalPnlUsd = openTrades.reduce((acc, t) => acc + t.pnlUsd, 0);
    const totalNotional = openTrades.reduce((acc, t) => acc + t.currentPrice * t.quantity, 0);
    const winningTrades = openTrades.filter(t => t.pnlUsd > 0);
    const losingTrades = openTrades.filter(t => t.pnlUsd < 0);
    const winRate = totalCount > 0 ? (winningTrades.length / totalCount) * 100 : 0;

    const longTrades = openTrades.filter(t => t.side === 'LONG');
    const shortTrades = openTrades.filter(t => t.side === 'SHORT');

    const avgLongEntry =
      longTrades.length > 0
        ? longTrades.reduce((acc, t) => acc + t.entryPrice * t.quantity, 0) /
          longTrades.reduce((acc, t) => acc + t.quantity, 0)
        : null;

    const avgShortEntry =
      shortTrades.length > 0
        ? shortTrades.reduce((acc, t) => acc + t.entryPrice * t.quantity, 0) /
          shortTrades.reduce((acc, t) => acc + t.quantity, 0)
        : null;

    return {
      totalCount,
      totalPnlUsd: Math.round(totalPnlUsd * 100) / 100,
      totalNotional: Math.round(totalNotional * 100) / 100,
      winningCount: winningTrades.length,
      losingCount: losingTrades.length,
      winRate: Math.round(winRate * 10) / 10,
      longCount: longTrades.length,
      shortCount: shortTrades.length,
      avgLongEntry: avgLongEntry ? Math.round(avgLongEntry * 100) / 100 : null,
      avgShortEntry: avgShortEntry ? Math.round(avgShortEntry * 100) / 100 : null
    };
  }, [openTrades]);

  // Execute Batch of Micro-Positions
  const handleLaunchBurst = () => {
    if (circuitBreakerActive) {
      alert('Blokada Circuit Breaker! Osiągnięto limit dziennego drawdownu.');
      return;
    }

    setIsExecutingBurst(true);
    playSound('BATCH_BURST');

    const newTrades: SimulatedTrade[] = [];
    const basePrice = currentPrice;
    const nowTime = new Date().toLocaleTimeString();

    for (let i = 0; i < batchCount; i++) {
      let side: 'LONG' | 'SHORT' = 'LONG';
      if (batchMode === 'SHORT') {
        side = 'SHORT';
      } else if (batchMode === 'GRID') {
        side = i % 2 === 0 ? 'LONG' : 'SHORT';
      }

      // Step multiplier: ladder positions around current price
      const stepIndex = Math.floor(i / 2);
      const priceOffsetFactor = (stepIndex * spreadStepPct) / 100;
      let entryPrice = basePrice;

      if (batchMode === 'GRID') {
        entryPrice =
          side === 'LONG'
            ? basePrice * (1 - priceOffsetFactor)
            : basePrice * (1 + priceOffsetFactor);
      } else if (side === 'LONG') {
        entryPrice = basePrice * (1 - (i * (spreadStepPct / 2)) / 100);
      } else {
        entryPrice = basePrice * (1 + (i * (spreadStepPct / 2)) / 100);
      }

      entryPrice = Math.round(entryPrice * 100) / 100;
      const quantity = Math.max(0.0001, Math.round((notionalPerOrder / entryPrice) * 10000) / 10000);

      const slPrice =
        side === 'LONG'
          ? Math.round(entryPrice * (1 - batchSlPct / 100) * 100) / 100
          : Math.round(entryPrice * (1 + batchSlPct / 100) * 100) / 100;

      const tpPrice =
        side === 'LONG'
          ? Math.round(entryPrice * (1 + batchTpPct / 100) * 100) / 100
          : Math.round(entryPrice * (1 - batchTpPct / 100) * 100) / 100;

      const tradeId = `QB-MIC-${selectedSymbol.replace('/', '')}-${Math.floor(Date.now() / 1000).toString().slice(-4)}-${i + 1}-${Math.random().toString(16).substring(2, 5).toUpperCase()}`;

      newTrades.push({
        id: tradeId,
        symbol: selectedSymbol,
        side,
        entryPrice,
        currentPrice: basePrice,
        quantity,
        slPrice,
        tpPrice,
        breakEvenActivated: false,
        pnlUsd: 0,
        pnlPct: 0,
        openTime: nowTime
      });
    }

    onOpenBatchPositions(newTrades);
    addLog(
      'INFO',
      `⚡ BURST WYSTRZELONY: Otwarto ${batchCount} mikro-pozycji [Tryb: ${batchMode}, Walor: ${selectedSymbol}, Łączny wolumen: $${(batchCount * notionalPerOrder).toFixed(2)}]`
    );

    setTimeout(() => {
      setIsExecutingBurst(false);
    }, 400);
  };

  // Bulk actions handlers
  const handleHarvestProfitable = () => {
    const profitable = openTrades.filter(t => t.pnlUsd > 0);
    if (profitable.length === 0) {
      alert('Brak pozycji na plusie do realizacji zysku.');
      return;
    }
    const ids = profitable.map(t => t.id);
    onBulkClose(ids, 'BULK_TAKE_PROFIT_HARVEST');
    playSound('TAKE_PROFIT');
    addLog('INFO', `🎯 ZREALIZOWANO ZYSKI: Zamknięto hurtowo ${profitable.length} zyskownych mikro-pozycji!`);
  };

  const handleCutLosses = () => {
    const losing = openTrades.filter(t => t.pnlUsd < 0);
    if (losing.length === 0) {
      alert('Brak pozycji na minusie.');
      return;
    }
    const ids = losing.map(t => t.id);
    onBulkClose(ids, 'BULK_STOP_LOSS_CUT');
    playSound('STOP_LOSS');
    addLog('WARNING', `🛡️ CIĘCIE STRAT: Hurtowo zamknięto ${losing.length} mikro-pozycji ze stratą.`);
  };

  const handleCloseSide = (side: 'LONG' | 'SHORT') => {
    const matching = openTrades.filter(t => t.side === side);
    if (matching.length === 0) {
      alert(`Brak otwartych pozycji ${side}.`);
      return;
    }
    const ids = matching.map(t => t.id);
    onBulkClose(ids, `BULK_CLOSE_${side}`);
    playSound('POSITION_OPEN');
    addLog('INFO', `Zamknięto hurtowo ${matching.length} pozycji typu ${side}.`);
  };

  // Filtered and sorted trade list
  const filteredTrades = useMemo(() => {
    return openTrades
      .filter(t => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (!t.id.toLowerCase().includes(q) && !t.symbol.toLowerCase().includes(q)) {
            return false;
          }
        }
        if (filterType === 'PROFIT') return t.pnlUsd > 0;
        if (filterType === 'LOSS') return t.pnlUsd < 0;
        if (filterType === 'LONG') return t.side === 'LONG';
        if (filterType === 'SHORT') return t.side === 'SHORT';
        return true;
      })
      .sort((a, b) => {
        const valA = a[sortBy];
        const valB = b[sortBy];
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        return sortOrder === 'asc' ? (Number(valA) - Number(valB)) : (Number(valB) - Number(valA));
      });
  }, [openTrades, searchQuery, filterType, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredTrades.length / pageSize) || 1;
  const paginatedTrades = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTrades.slice(start, start + pageSize);
  }, [filteredTrades, page]);

  return (
    <div className="bg-[#0d1424] border border-slate-800/90 rounded-xl p-4 space-y-4">
      {/* HEADER & BURST GENERATOR TITLE */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/80 text-cyan-400">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center space-x-2">
              <span>Generator Wielu Mikro-Pozycji & Siatka Scalp (Burst Orders)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-900/60 text-cyan-300 font-mono border border-cyan-700/60">
                Wysoka Częstotliwość
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Otwórz od 10 do 100+ małych pozycji na Binance Futures jednym kliknięciem z drabinką spreadu i zarządzaniem hurtowym.
            </p>
          </div>
        </div>

        {/* PRESET QUICK BURST BUTTONS */}
        <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <span className="text-[11px] text-slate-400 px-2 font-mono">Szybki Burst:</span>
          {[10, 25, 50, 100].map(count => (
            <button
              key={count}
              onClick={() => {
                setBatchCount(count);
              }}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                batchCount === count
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              +{count}
            </button>
          ))}
        </div>
      </div>

      {/* GENERATOR CONTROLS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 bg-[#080d1a] p-3.5 rounded-lg border border-slate-800/80 text-xs">
        {/* Count & Preset */}
        <div>
          <label className="block text-slate-400 font-medium mb-1">
            Liczba pozycji: <strong className="text-white font-mono">{batchCount}</strong>
          </label>
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={batchCount}
            onChange={e => setBatchCount(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>5 szt.</span>
            <span>50 szt.</span>
            <span>100 szt.</span>
          </div>
        </div>

        {/* Direction Mode */}
        <div>
          <label className="block text-slate-400 font-medium mb-1">Kierunek / Typ Siatki</label>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => setBatchMode('LONG')}
              className={`py-1.5 px-2 rounded font-semibold text-[11px] transition-all flex items-center justify-center space-x-1 ${
                batchMode === 'LONG'
                  ? 'bg-emerald-900 border border-emerald-500 text-emerald-200'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>LONG</span>
            </button>
            <button
              onClick={() => setBatchMode('SHORT')}
              className={`py-1.5 px-2 rounded font-semibold text-[11px] transition-all flex items-center justify-center space-x-1 ${
                batchMode === 'SHORT'
                  ? 'bg-rose-900 border border-rose-500 text-rose-200'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <TrendingDown className="w-3 h-3 text-rose-400" />
              <span>SHORT</span>
            </button>
            <button
              onClick={() => setBatchMode('GRID')}
              className={`py-1.5 px-2 rounded font-semibold text-[11px] transition-all flex items-center justify-center space-x-1 ${
                batchMode === 'GRID'
                  ? 'bg-cyan-900 border border-cyan-500 text-cyan-200'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Scale className="w-3 h-3 text-cyan-400" />
              <span>HEDGE</span>
            </button>
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            {batchMode === 'GRID' ? 'Naprzemiennie LONG & SHORT (Grid Scalper)' : `Tylko pozycje ${batchMode}`}
          </span>
        </div>

        {/* Notional Size per Micro-Order */}
        <div>
          <label className="block text-slate-400 font-medium mb-1">
            Wielkość 1 mikro-pozycji: <strong className="text-white font-mono">${notionalPerOrder}</strong>
          </label>
          <div className="flex space-x-1">
            {[10, 25, 50, 100].map(val => (
              <button
                key={val}
                onClick={() => setNotionalPerOrder(val)}
                className={`flex-1 py-1 rounded text-[10px] font-mono border transition-all ${
                  notionalPerOrder === val
                    ? 'bg-slate-800 border-cyan-500 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                ${val}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Suma notional: <strong className="text-slate-300 font-mono">${(batchCount * notionalPerOrder).toFixed(0)} USDT</strong>
          </span>
        </div>

        {/* Spread Step Ladder */}
        <div>
          <label className="block text-slate-400 font-medium mb-1">Krok drabinki (Spread %)</label>
          <select
            value={spreadStepPct}
            onChange={e => setSpreadStepPct(parseFloat(e.target.value))}
            className="w-full py-1.5 px-2 rounded bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="0.0">0.0% (Instant Market Burst)</option>
            <option value="0.03">0.03% (Ultra-Tight Scalp)</option>
            <option value="0.05">0.05% (Standard Grid)</option>
            <option value="0.10">0.10% (Wide Ladder)</option>
            <option value="0.25">0.25% (Volatility Trap)</option>
          </select>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Rozrzut wejść: ±{((batchCount / 2) * spreadStepPct).toFixed(2)}% od rynkowej
          </span>
        </div>

        {/* LAUNCH TRIGGER BUTTON */}
        <div className="flex flex-col justify-end">
          <button
            onClick={handleLaunchBurst}
            disabled={isExecutingBurst || circuitBreakerActive}
            className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-cyan-950/40 active:scale-98"
          >
            <Zap className={`w-4 h-4 ${isExecutingBurst ? 'animate-bounce' : ''}`} />
            <span>{isExecutingBurst ? 'Wstrzeliwanie...' : `WYSTRZEL ${batchCount} POZYCJI`}</span>
          </button>
        </div>
      </div>

      {/* PORTFOLIO AGGREGATE TELEMETRY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-[#070b14] border border-slate-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-400 block">Otwarte Pozycje</span>
          <div className="text-base font-bold text-white font-mono flex items-center space-x-1.5 mt-0.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>{telemetry.totalCount}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {telemetry.longCount} L • {telemetry.shortCount} S
          </span>
        </div>

        <div className="bg-[#070b14] border border-slate-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-400 block">Niezrealizowany PnL</span>
          <div
            className={`text-base font-bold font-mono mt-0.5 ${
              telemetry.totalPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {telemetry.totalPnlUsd >= 0 ? '+' : ''}${telemetry.totalPnlUsd.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Zagregowany portfel</span>
        </div>

        <div className="bg-[#070b14] border border-slate-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-400 block">Wskaźnik w Zysku (Win %)</span>
          <div className="text-base font-bold text-cyan-300 font-mono mt-0.5">
            {telemetry.winRate}%
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {telemetry.winningCount} zielonych / {telemetry.losingCount} czerwonych
          </span>
        </div>

        <div className="bg-[#070b14] border border-slate-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-400 block">Łączny Notional</span>
          <div className="text-base font-bold text-white font-mono mt-0.5">
            ${telemetry.totalNotional.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Ekspozycja rynkowa</span>
        </div>

        <div className="bg-[#070b14] border border-slate-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-400 block">Średnie Wejście LONG</span>
          <div className="text-xs font-bold text-emerald-400 font-mono mt-1">
            {telemetry.avgLongEntry ? `$${telemetry.avgLongEntry.toFixed(2)}` : 'Brak'}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Cena BE dla Longów</span>
        </div>

        <div className="bg-[#070b14] border border-slate-800/80 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-400 block">Średnie Wejście SHORT</span>
          <div className="text-xs font-bold text-rose-400 font-mono mt-1">
            {telemetry.avgShortEntry ? `$${telemetry.avgShortEntry.toFixed(2)}` : 'Brak'}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Cena BE dla Shortów</span>
        </div>
      </div>

      {/* BULK ACTIONS CONTROL STRIP */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
        <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Akcje Hurtowe dla Wszystkich Pozycji ({openTrades.length}):</span>
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleHarvestProfitable}
            disabled={openTrades.filter(t => t.pnlUsd > 0).length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900/80 border border-emerald-700/60 text-emerald-300 disabled:opacity-40 text-xs font-semibold flex items-center space-x-1 transition-all"
            title="Zamknij natychmiast wszystkie pozycje będące w zysku"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Zrealizuj Tylko Zyskowne ({openTrades.filter(t => t.pnlUsd > 0).length})</span>
          </button>

          <button
            onClick={handleCutLosses}
            disabled={openTrades.filter(t => t.pnlUsd < 0).length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900/80 border border-rose-700/60 text-rose-300 disabled:opacity-40 text-xs font-semibold flex items-center space-x-1 transition-all"
            title="Wytnij wszystkie pozycje ze stratą"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Wytnij Straty ({openTrades.filter(t => t.pnlUsd < 0).length})</span>
          </button>

          <button
            onClick={onBulkMoveToBreakEven}
            disabled={openTrades.length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-blue-950 hover:bg-blue-900/80 border border-blue-700/60 text-blue-300 disabled:opacity-40 text-xs font-semibold flex items-center space-x-1 transition-all"
            title="Przesuń Stop-Loss wszystkich pozycji na cenę wejścia"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Wszystkie na Break-Even</span>
          </button>

          <button
            onClick={() => handleCloseSide('LONG')}
            disabled={openTrades.filter(t => t.side === 'LONG').length === 0}
            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 text-xs font-medium"
          >
            Zamknij LONG ({openTrades.filter(t => t.side === 'LONG').length})
          </button>

          <button
            onClick={() => handleCloseSide('SHORT')}
            disabled={openTrades.filter(t => t.side === 'SHORT').length === 0}
            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 text-xs font-medium"
          >
            Zamknij SHORT ({openTrades.filter(t => t.side === 'SHORT').length})
          </button>

          <button
            onClick={onPanicCloseAll}
            disabled={openTrades.length === 0}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1 transition-all shadow-md active:scale-98"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>PANIC: ZAMKNIJ WSZYSTKO</span>
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtruj po ID lub symbolu..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-[#070b14] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-48 sm:w-64"
            />
          </div>

          <div className="flex items-center space-x-1 bg-[#070b14] p-1 rounded-lg border border-slate-800 text-xs">
            {(['ALL', 'PROFIT', 'LOSS', 'LONG', 'SHORT'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setFilterType(tab);
                  setPage(1);
                }}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  filterType === tab
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab === 'ALL'
                  ? `Wszystkie (${openTrades.length})`
                  : tab === 'PROFIT'
                  ? `Zyskowne (${telemetry.winningCount})`
                  : tab === 'LOSS'
                  ? `Stratne (${telemetry.losingCount})`
                  : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Sorting selector */}
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Sortuj:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'openTime' | 'pnlUsd' | 'pnlPct' | 'symbol' | 'entryPrice')}
            className="bg-[#070b14] border border-slate-800 rounded px-2 py-1 text-white text-xs"
          >
            <option value="pnlUsd">PnL ($)</option>
            <option value="pnlPct">PnL (%)</option>
            <option value="entryPrice">Cena wejścia</option>
            <option value="openTime">Czas otwarcia</option>
          </select>
          <button
            onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
            className="px-1.5 py-1 rounded bg-[#070b14] border border-slate-800 text-white text-[10px] font-mono"
          >
            {sortOrder.toUpperCase()}
          </button>
        </div>
      </div>

      {/* POSITIONS LIST / TABLE */}
      {filteredTrades.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs bg-[#070b14] rounded-lg border border-slate-900">
          {openTrades.length === 0
            ? 'Brak otwartych pozycji. Użyj powyższego Generatora "Wystrzel 20 Pozycji", aby otworzyć serię zleceń scalpingowych!'
            : 'Brak pozycji pasujących do bieżącego filtra.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-[#070b14]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/50">
                <th className="py-2.5 px-3 font-medium">ID Zlecenia</th>
                <th className="py-2.5 px-3 font-medium">Strona</th>
                <th className="py-2.5 px-3 font-medium">Cena Wejścia</th>
                <th className="py-2.5 px-3 font-medium">Cena Bieżąca</th>
                <th className="py-2.5 px-3 font-medium">Stop-Loss</th>
                <th className="py-2.5 px-3 font-medium">Take-Profit</th>
                <th className="py-2.5 px-3 font-medium">Wolumen</th>
                <th className="py-2.5 px-3 font-medium">PnL ($ / %)</th>
                <th className="py-2.5 px-3 font-medium text-right">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 font-mono">
              {paginatedTrades.map(trade => (
                <tr key={trade.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 px-3">
                    <span className="font-bold text-white block">{trade.symbol}</span>
                    <span className="text-[10px] text-slate-500">{trade.id}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        trade.side === 'LONG'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {trade.side}
                    </span>
                  </td>
                  <td className="py-2 px-3">${trade.entryPrice.toFixed(2)}</td>
                  <td className="py-2 px-3 text-slate-300">${trade.currentPrice.toFixed(2)}</td>
                  <td className="py-2 px-3">
                    <span className="text-rose-400">${trade.slPrice.toFixed(2)}</span>
                    {trade.breakEvenActivated && (
                      <span className="ml-1.5 text-[9px] px-1 rounded bg-blue-950 text-blue-400 border border-blue-800">
                        BE
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-emerald-400">${trade.tpPrice.toFixed(2)}</td>
                  <td className="py-2 px-3 text-slate-400">
                    {trade.quantity} <span className="text-[10px] text-slate-600">(${(trade.quantity * trade.entryPrice).toFixed(1)})</span>
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`font-bold inline-block px-1.5 py-0.5 rounded text-[11px] ${
                        trade.pnlUsd >= 0
                          ? 'text-emerald-300 bg-emerald-950/60'
                          : 'text-rose-300 bg-rose-950/60'
                      }`}
                    >
                      {trade.pnlUsd >= 0 ? '+' : ''}${trade.pnlUsd.toFixed(2)} (
                      {trade.pnlPct >= 0 ? '+' : ''}
                      {trade.pnlPct.toFixed(2)}%)
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-sans">
                    <button
                      onClick={() => onClosePosition(trade.id, 'MANUAL_CLOSE')}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium transition-colors"
                    >
                      Zamknij
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PAGINATION BAR */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
          <span>
            Wyświetlono {(page - 1) * pageSize + 1} -{' '}
            {Math.min(page * pageSize, filteredTrades.length)} z {filteredTrades.length} pozycji
          </span>
          <div className="flex items-center space-x-1.5 font-mono">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs"
            >
              Poprzednia
            </button>
            <span className="px-2 text-cyan-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs"
            >
              Następna
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
