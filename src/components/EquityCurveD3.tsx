/**
 * EquityCurveD3 - D3-Powered Cumulative Equity Curve & Drawdown Visualizer
 * Includes an interactive native SVG tooltip on hover displaying exact date,
 * trade PnL value, cumulative equity, and high watermark status.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { TrendingUp, Award, Calendar, DollarSign, Activity } from 'lucide-react';

export interface EquityPoint {
  index: number;
  tradeId: string;
  time: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  tradePnl: number;
  equity: number;
  cumulativeProfit: number;
  drawdownPct: number;
  highWaterMark: number;
  exitReason?: string;
  pnlPct?: number;
}

interface EquityCurveD3Props {
  initialCapital?: number;
  trades: Array<{
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    pnlUsd: number;
    pnlPct: number;
    exitReason: string;
    exitTime: string;
  }>;
  onSimulateTrade?: (pnl: number) => void;
}

export const EquityCurveD3: React.FC<EquityCurveD3Props> = ({
  initialCapital = 10000.0,
  trades,
  onSimulateTrade,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<EquityPoint | null>(null);
  const [filterRange, setFilterRange] = useState<'ALL' | 'LAST10' | 'LAST20'>('ALL');

  // Compute equity points sequentially from earliest to latest trade
  const equityData = useMemo<EquityPoint[]>(() => {
    const sortedTrades = [...trades].reverse();

    const points: EquityPoint[] = [
      {
        index: 0,
        tradeId: 'BASELINE',
        time: 'Początek Portfela UTC',
        symbol: 'USDT',
        side: 'LONG',
        tradePnl: 0,
        pnlPct: 0,
        equity: initialCapital,
        cumulativeProfit: 0,
        drawdownPct: 0,
        highWaterMark: initialCapital,
        exitReason: 'DEPOSIT',
      },
    ];

    let runningEquity = initialCapital;
    let highWaterMark = initialCapital;

    sortedTrades.forEach((trade, i) => {
      runningEquity = Math.round((runningEquity + trade.pnlUsd) * 100) / 100;
      if (runningEquity > highWaterMark) {
        highWaterMark = runningEquity;
      }
      const dd = Math.max(0, ((highWaterMark - runningEquity) / highWaterMark) * 100);

      points.push({
        index: i + 1,
        tradeId: trade.id,
        time: trade.exitTime,
        symbol: trade.symbol,
        side: trade.side,
        tradePnl: trade.pnlUsd,
        pnlPct: trade.pnlPct,
        equity: runningEquity,
        cumulativeProfit: Math.round((runningEquity - initialCapital) * 100) / 100,
        drawdownPct: Math.round(dd * 100) / 100,
        highWaterMark,
        exitReason: trade.exitReason,
      });
    });

    if (filterRange === 'LAST10') {
      return points.slice(-11);
    }
    if (filterRange === 'LAST20') {
      return points.slice(-21);
    }
    return points;
  }, [trades, initialCapital, filterRange]);

  // Overall Statistics
  const latestPoint = equityData[equityData.length - 1] || {
    equity: initialCapital,
    cumulativeProfit: 0,
  };
  const totalNetProfit = latestPoint.equity - initialCapital;
  const netProfitPct = (totalNetProfit / initialCapital) * 100;
  const maxDrawdown = Math.max(...equityData.map((p) => p.drawdownPct), 0);
  const peakEquity = Math.max(...equityData.map((p) => p.highWaterMark), initialCapital);

  // D3 Render Effect with Interactive Native SVG Tooltip
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || equityData.length === 0) return;

    const width = containerRef.current.clientWidth || 680;
    const height = 260;
    const margin = { top: 25, right: 35, bottom: 35, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

    // SVG Filters and Gradients
    const defs = svg.append('defs');

    // Drop shadow filter for SVG tooltip
    const filter = defs.append('filter')
      .attr('id', 'svg-tooltip-shadow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%');
    filter.append('feDropShadow')
      .attr('dx', '0')
      .attr('dy', '4')
      .attr('stdDeviation', '6')
      .attr('flood-color', '#000000')
      .attr('flood-opacity', '0.65');

    // Area Gradient
    const isPositive = totalNetProfit >= 0;
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'equity-curve-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', isPositive ? '#10b981' : '#f43f5e')
      .attr('stop-opacity', 0.35);

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', isPositive ? '#10b981' : '#f43f5e')
      .attr('stop-opacity', 0.0);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([0, equityData.length - 1])
      .range([0, innerWidth]);

    const yMin = Math.min(...equityData.map((d) => d.equity), initialCapital) * 0.995;
    const yMax = Math.max(...equityData.map((d) => d.equity), peakEquity) * 1.005;

    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);

    // Background Grid lines
    const yGrid = d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(() => '');

    g.append('g')
      .attr('class', 'grid')
      .call(yGrid)
      .selectAll('line')
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '3,3');
    g.select('.grid .domain').remove();

    // Baseline Line at Initial Capital ($10,000)
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(initialCapital))
      .attr('y2', yScale(initialCapital))
      .attr('stroke', '#64748b')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '4,4');

    g.append('text')
      .attr('x', innerWidth - 5)
      .attr('y', yScale(initialCapital) - 6)
      .attr('text-anchor', 'end')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .text(`Baseline: $${initialCapital.toLocaleString()}`);

    // D3 Area & Line Generators
    const areaGen = d3
      .area<EquityPoint>()
      .x((_, i) => xScale(i))
      .y0(innerHeight)
      .y1((d) => yScale(d.equity))
      .curve(d3.curveMonotoneX);

    const lineGen = d3
      .line<EquityPoint>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d.equity))
      .curve(d3.curveMonotoneX);

    const hwmLineGen = d3
      .line<EquityPoint>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d.highWaterMark))
      .curve(d3.curveStepAfter);

    // Render Area
    g.append('path')
      .datum(equityData)
      .attr('fill', 'url(#equity-curve-gradient)')
      .attr('d', areaGen);

    // Render High Water Mark Line (dashed amber)
    g.append('path')
      .datum(equityData)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.3)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.65)
      .attr('d', hwmLineGen);

    // Render Main Equity Curve Line
    const path = g
      .append('path')
      .datum(equityData)
      .attr('fill', 'none')
      .attr('stroke', isPositive ? '#10b981' : '#f43f5e')
      .attr('stroke-width', 2.5)
      .attr('d', lineGen);

    // Animate path stroke
    const totalLength = (path.node() as SVGPathElement)?.getTotalLength() || 1000;
    path
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(650)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);

    // Static Dots on Each Trade Point
    const dotsGroup = g.append('g').attr('class', 'dots-layer');

    equityData.forEach((point, i) => {
      const isStart = i === 0;
      const isWin = point.tradePnl >= 0;
      const dotColor = isStart ? '#94a3b8' : isWin ? '#10b981' : '#f43f5e';

      dotsGroup
        .append('circle')
        .attr('cx', xScale(i))
        .attr('cy', yScale(point.equity))
        .attr('r', isStart ? 3 : 4.5)
        .attr('fill', '#070b14')
        .attr('stroke', dotColor)
        .attr('stroke-width', 2);
    });

    // X-Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.min(equityData.length, 7))
      .tickFormat((d) => `#${d}`);

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .call((axis) => axis.select('.domain').attr('stroke', '#334155'))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Y-Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) => `$${d.valueOf().toLocaleString()}`);

    g.append('g')
      .call(yAxis)
      .call((axis) => axis.select('.domain').attr('stroke', '#334155'))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // ========================================================
    // NATIVE INTERACTIVE SVG TOOLTIP LAYER
    // ========================================================
    const tooltipG = g.append('g')
      .attr('class', 'svg-interactive-tooltip')
      .style('display', 'none')
      .style('pointer-events', 'none');

    // Vertical Crosshair Line
    const crosshair = tooltipG.append('line')
      .attr('class', 'tooltip-crosshair')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.7);

    // Glowing active halo circle
    const haloCircle = tooltipG.append('circle')
      .attr('class', 'tooltip-halo')
      .attr('r', 8)
      .attr('fill', 'none')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9);

    // Active center dot
    const centerDot = tooltipG.append('circle')
      .attr('class', 'tooltip-center-dot')
      .attr('r', 4.5)
      .attr('stroke', '#070b14')
      .attr('stroke-width', 2);

    // Tooltip Card Group
    const cardG = tooltipG.append('g').attr('class', 'tooltip-card');

    // Tooltip Background Box
    const boxW = 195;
    const boxH = 92;
    const cardRect = cardG.append('rect')
      .attr('width', boxW)
      .attr('height', boxH)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('fill', '#0b1222')
      .attr('fill-opacity', 0.96)
      .attr('stroke', '#06b6d4')
      .attr('stroke-width', 1.2)
      .attr('filter', 'url(#svg-tooltip-shadow)');

    // Text Lines
    // 1. Exact Date / Timestamp line
    const dateText = cardG.append('text')
      .attr('x', 12)
      .attr('y', 18)
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // 2. Exact PnL Value Line (PROMINENT)
    const pnlText = cardG.append('text')
      .attr('x', 12)
      .attr('y', 36)
      .attr('font-size', '13px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'monospace');

    // 3. Exact Cumulative Equity Line
    const equityText = cardG.append('text')
      .attr('x', 12)
      .attr('y', 53)
      .attr('fill', '#38bdf8')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('font-family', 'monospace');

    // 4. Trade Symbol & Reason line
    const tradeInfoText = cardG.append('text')
      .attr('x', 12)
      .attr('y', 69)
      .attr('fill', '#cbd5e1')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // 5. Drawdown from High Watermark line
    const ddText = cardG.append('text')
      .attr('x', 12)
      .attr('y', 83)
      .attr('fill', '#f59e0b')
      .attr('font-size', '9.5px')
      .attr('font-family', 'monospace');

    // Bisector for tracking nearest point along X
    const bisectIndex = d3.bisector((_, i: number) => i).center;

    // Interactive Full-Canvas Overlay for Mouse Interaction
    const overlay = g.append('rect')
      .attr('class', 'mouse-overlay')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair');

    overlay
      .on('mousemove', (event: MouseEvent) => {
        const [pointerX] = d3.pointer(event);
        const approxIndex = xScale.invert(pointerX);
        const index = Math.max(0, Math.min(equityData.length - 1, Math.round(approxIndex)));
        const point = equityData[index];
        if (!point) return;

        setHoveredPoint(point);

        const cx = xScale(index);
        const cy = yScale(point.equity);
        const isWin = point.tradePnl >= 0;
        const color = index === 0 ? '#94a3b8' : isWin ? '#10b981' : '#f43f5e';

        tooltipG.style('display', null);

        // Position crosshair & halo
        crosshair.attr('x1', cx).attr('x2', cx);
        haloCircle.attr('cx', cx).attr('cy', cy).attr('stroke', color);
        centerDot.attr('cx', cx).attr('cy', cy).attr('fill', color);

        // Format Date text
        dateText.text(`📅 Data: ${point.time}`);

        // Format exact PnL with sign, currency, and %
        const pnlSign = point.tradePnl > 0 ? '+' : '';
        const pctFormatted = point.pnlPct !== undefined ? ` (${pnlSign}${point.pnlPct.toFixed(2)}%)` : '';
        pnlText
          .text(`💰 Wynik PnL: ${pnlSign}$${point.tradePnl.toFixed(2)}${pctFormatted}`)
          .attr('fill', color);

        // Format Equity text
        equityText.text(`📈 Kapitał: $${point.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);

        // Format Trade specifics
        if (index === 0) {
          tradeInfoText.text('Depozyt Początkowy (Baseline)');
        } else {
          tradeInfoText.text(`${point.symbol} • ${point.side} (${point.exitReason || 'CLOSED'})`);
        }

        // Format Drawdown
        ddText.text(`🔻 Obsunięcie od szczytu: ${point.drawdownPct.toFixed(2)}%`);

        // Border color accentuates win/loss
        cardRect.attr('stroke', color);

        // Smart Box Placement so it never cuts off at edges
        let cardX = cx + 14;
        if (cx + boxW + 20 > innerWidth) {
          cardX = cx - boxW - 14; // Flip to left of cursor
        }

        let cardY = cy - boxH / 2;
        if (cardY < 5) cardY = 5;
        if (cardY + boxH > innerHeight - 5) cardY = innerHeight - boxH - 5;

        cardG.attr('transform', `translate(${cardX},${cardY})`);
      })
      .on('mouseleave', () => {
        tooltipG.style('display', 'none');
        setHoveredPoint(null);
      });
  }, [equityData, totalNetProfit, initialCapital, peakEquity]);

  return (
    <div className="bg-[#0d1424] border border-slate-800/90 rounded-xl p-4 flex flex-col space-y-3">
      {/* HEADER WITH SUMMARY METRICS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-600/40 text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white flex items-center space-x-2">
              <span>Krzywa Kapitałowa (Equity Curve • D3.js)</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono font-normal">
                {equityData.length - 1} transakcji
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Interaktywny wektorowy wykres SVG z celownikiem i natywnym dymkiem D3 na hover
            </p>
          </div>
        </div>

        {/* METRIC PILLS */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Skumulowany Zysk:</span>
            <span className={`font-mono font-bold ${totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalNetProfit >= 0 ? '+' : ''}${totalNetProfit.toFixed(2)} ({netProfitPct >= 0 ? '+' : ''}{netProfitPct.toFixed(2)}%)
            </span>
          </div>

          <div className="bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Max Drawdown:</span>
            <span className="font-mono font-bold text-amber-400">
              {maxDrawdown.toFixed(2)}%
            </span>
          </div>

          <div className="bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Szczyt (HWM):</span>
            <span className="font-mono font-bold text-white">
              ${peakEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* RANGE TOGGLE */}
          <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
            <button
              onClick={() => setFilterRange('ALL')}
              className={`px-2 py-1 rounded transition-colors ${
                filterRange === 'ALL' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Wszystkie
            </button>
            <button
              onClick={() => setFilterRange('LAST20')}
              className={`px-2 py-1 rounded transition-colors ${
                filterRange === 'LAST20' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ostatnie 20
            </button>
            <button
              onClick={() => setFilterRange('LAST10')}
              className={`px-2 py-1 rounded transition-colors ${
                filterRange === 'LAST10' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Ostatnie 10
            </button>
          </div>
        </div>
      </div>

      {/* D3 NATIVE SVG CHART CONTAINER */}
      <div ref={containerRef} className="relative w-full bg-[#070b14] rounded-lg border border-slate-900 p-2 overflow-hidden select-none">
        <svg ref={svgRef} className="w-full h-64 overflow-visible" />
      </div>

      {/* QUICK SIMULATION TOOLBAR (Adds simulated trades to see D3 curve adapt) */}
      {onSimulateTrade && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
          <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
            <Award className="w-3.5 h-3.5 text-cyan-400" />
            <span>Testuj dynamikę krzywej kapitałowej (najedź myszką, aby zobaczyć SVG Tooltip z dokładną datą i PnL):</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onSimulateTrade(300.0)}
              className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 text-[11px] font-semibold transition-colors"
            >
              + Symuluj Zysk (+1:2 RRR, +$300)
            </button>
            <button
              onClick={() => onSimulateTrade(-150.0)}
              className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-300 text-[11px] font-semibold transition-colors"
            >
              - Symuluj Stratę (SL 1.5%, -$150)
            </button>
            <button
              onClick={() => onSimulateTrade(-5.0)}
              className="px-2.5 py-1 rounded bg-blue-950/80 hover:bg-blue-900 border border-blue-600/50 text-blue-300 text-[11px] font-semibold transition-colors"
            >
              • Symuluj Break-Even (-$5 prowizja)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
