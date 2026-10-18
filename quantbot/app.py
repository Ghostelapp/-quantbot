"""
QuantBot Studio - Streamlit Trading Dashboard
High-frequency quantitative monitoring interface with Plotly charts,
live PnL tracking, manual overrides, and risk telemetry.
"""

import asyncio
import logging
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import streamlit as st

project_root = str(Path(__file__).resolve().parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from quantbot.config import config
from quantbot.database import DatabaseManager
from quantbot.trading_engine import TradingEngine

# Streamlit Page Setup
st.set_page_config(
    page_title="QuantBot Studio - Binance Futures Dashboard",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Shared Singletons in Streamlit Session/Cache
if "db" not in st.session_state:
    st.session_state.db = DatabaseManager(config.db_path)

if "engine" not in st.session_state:
    st.session_state.engine = TradingEngine(config=config, db=st.session_state.db)

if "engine_thread" not in st.session_state:
    st.session_state.engine_thread: Optional[threading.Thread] = None

if "loop" not in st.session_state:
    st.session_state.loop = None


def start_engine_in_background():
    """Runs the asyncio trading loop in an independent background thread."""
    engine = st.session_state.engine
    loop = asyncio.new_event_loop()

    def _run():
        asyncio.set_event_loop(loop)
        loop.run_until_complete(engine.initialize())
        loop.run_until_complete(engine.run_loop())

    if not engine.status.is_running:
        st.session_state.loop = loop
        t = threading.Thread(target=_run, daemon=True)
        t.start()
        st.session_state.engine_thread = t
        time.sleep(1.0)


def stop_engine():
    """Signals engine shutdown."""
    if st.session_state.engine:
        st.session_state.engine.stop()


# ---------------- SIDEBAR CONTROLS ----------------
with st.sidebar:
    st.title("⚡ QuantBot Studio")
    st.caption("Binance Futures USDT-M Algorithmic Engine")
    st.divider()

    # Engine Status Badge
    is_running = st.session_state.engine.status.is_running
    is_paper = st.session_state.engine.status.is_paper_trading
    cb_active = st.session_state.engine.status.circuit_breaker_active

    if cb_active:
        st.error("🚨 CIRCUIT BREAKER ACTIVE (Max DD Breached)")
    elif is_running:
        st.success(f"🟢 ENGINE ONLINE ({'PAPER TRADING' if is_paper else 'TESTNET / LIVE'})")
    else:
        st.warning("🔴 ENGINE STOPPED")

    st.subheader("Sterowanie Silnikiem")
    col1, col2 = st.columns(2)
    with col1:
        if st.button("▶ START", use_container_width=True, disabled=is_running):
            start_engine_in_background()
            st.rerun()

    with col2:
        if st.button("⏹ STOP", use_container_width=True, disabled=not is_running):
            stop_engine()
            st.rerun()

    if st.button("🔥 PANIC: Zamknij Wszystko i Zastopuj", type="primary", use_container_width=True):
        if st.session_state.loop and st.session_state.loop.is_running():
            asyncio.run_coroutine_threadsafe(
                st.session_state.engine.close_all_positions("MANUAL_PANIC"),
                st.session_state.loop,
            )
        else:
            # Synchronous close via database in stopped state
            st.session_state.engine.status.account_balance += sum(
                t.get("pnl_usd", 0) for t in st.session_state.db.get_open_trades()
            )
            for t in st.session_state.db.get_open_trades():
                st.session_state.db.close_trade(t["trade_id"], t["entry_price"], "MANUAL_PANIC")
        stop_engine()
        st.success("Wszystkie pozycje zamknięte.")
        st.rerun()

    st.divider()
    st.subheader("Parametry Ryzyka")
    st.markdown(f"""
    - **Pary:** `{', '.join(config.symbols)}`
    - **Timeframe:** `{config.timeframe}`
    - **Ryzyko/trade:** `{config.risk_per_trade_pct}%`
    - **Stop Loss:** `{config.stop_loss_pct}%`
    - **Take Profit:** `{config.take_profit_pct}%` (RRR 1:{config.risk_to_reward_ratio})
    - **Trailing Break-Even:** `{config.trailing_break_even_pct}%`
    - **Max Dzienny Drawdown:** `{config.circuit_breaker_max_drawdown_pct}%`
    - **Dźwignia:** `{config.leverage}x`
    """)

    if cb_active:
        if st.button("Odblokuj Circuit Breaker"):
            st.session_state.engine.risk_manager.reset_circuit_breaker(st.session_state.engine.status.account_equity)
            st.session_state.engine.status.circuit_breaker_active = False
            st.rerun()

    st.divider()
    auto_refresh = st.checkbox("Auto-odświeżanie (5s)", value=True)
    if auto_refresh:
        time.sleep(5)
        st.rerun()


# ---------------- MAIN DASHBOARD ----------------
st.title("Panel Transakcyjny QuantBot")

# Metrics Header
status = st.session_state.engine.status
open_trades = st.session_state.db.get_open_trades()
closed_trades = st.session_state.db.get_trade_history(limit=50)

total_wins = sum(1 for t in closed_trades if t.get("pnl_usd", 0) > 0)
total_trades = len(closed_trades)
win_rate = (total_wins / total_trades * 100.0) if total_trades > 0 else 0.0
realized_pnl = sum(t.get("pnl_usd", 0) for t in closed_trades)

m1, m2, m3, m4, m5, m6 = st.columns(6)
m1.metric("Kapitał (Equity)", f"${status.account_equity:,.2f}")
m2.metric("Saldo (Balance)", f"${status.account_balance:,.2f}")
m3.metric("Zrealizowany PnL", f"${realized_pnl:,.2f}", delta=f"{realized_pnl:,.2f}")
m4.metric("Dzienny Drawdown", f"{status.daily_drawdown_pct:.2f}%", delta=f"-{status.daily_drawdown_pct:.2f}%", delta_color="inverse")
m5.metric("Otwarte Pozycje", f"{len(open_trades)} / {config.max_open_positions}")
m6.metric("Win Rate", f"{win_rate:.1f}%", f"{total_wins}/{total_trades} wygranych")

st.divider()

# Selected Symbol for Charts
selected_symbol = st.selectbox("Wybierz walor do analizy technicznej:", config.symbols, index=0)

# Fetch latest candles for plotting
active_loop = st.session_state.loop
if active_loop and active_loop.is_running():
    candles = asyncio.run_coroutine_threadsafe(
        st.session_state.engine.fetch_ohlcv_with_retry(selected_symbol, limit=80),
        active_loop,
    ).result()
else:
    candles = asyncio.run(st.session_state.engine.fetch_ohlcv_with_retry(selected_symbol, limit=80))

if candles:
    df = pd.DataFrame(candles, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["datetime"] = pd.to_datetime(df["timestamp"], unit="ms")
    df["ema_fast"] = st.session_state.engine.strategy.calculate_ema(df["close"], config.ema_fast_period)
    df["ema_slow"] = st.session_state.engine.strategy.calculate_ema(df["close"], config.ema_slow_period)
    df["rsi"] = st.session_state.engine.strategy.calculate_rsi(df["close"], config.rsi_period)

    # Plotly Subplots: Price + Candlesticks + EMAs on Top, RSI on Bottom
    fig = make_subplots(
        rows=2, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.08,
        subplot_titles=(f"Notowania {selected_symbol} ({config.timeframe}) z EMA {config.ema_fast_period} i EMA {config.ema_slow_period}", "Wskaźnik RSI (14) z progami 30 / 50 / 70"),
        row_heights=[0.7, 0.3],
    )

    # Candlestick
    fig.add_trace(
        go.Candlestick(
            x=df["datetime"],
            open=df["open"],
            high=df["high"],
            low=df["low"],
            close=df["close"],
            name="Świece",
        ),
        row=1, col=1,
    )

    # Fast EMA
    fig.add_trace(
        go.Scatter(
            x=df["datetime"],
            y=df["ema_fast"],
            line=dict(color="#00E5FF", width=1.8),
            name=f"EMA {config.ema_fast_period} (Szybka)",
        ),
        row=1, col=1,
    )

    # Slow EMA
    fig.add_trace(
        go.Scatter(
            x=df["datetime"],
            y=df["ema_slow"],
            line=dict(color="#FF9100", width=1.8),
            name=f"EMA {config.ema_slow_period} (Wolna)",
        ),
        row=1, col=1,
    )

    # Overlay open positions for this symbol
    for t in open_trades:
        if t["symbol"] == selected_symbol:
            entry = float(t["entry_price"])
            sl = float(t["sl_price"])
            tp = float(t["tp_price"])
            side = t["side"]

            fig.add_hline(y=entry, line_dash="dot", line_color="#FFFFFF", annotation_text=f"Entry ({side})", row=1, col=1)
            fig.add_hline(y=sl, line_dash="dash", line_color="#FF1744", annotation_text=f"SL ({sl})", row=1, col=1)
            fig.add_hline(y=tp, line_dash="dash", line_color="#00E676", annotation_text=f"TP ({tp})", row=1, col=1)

    # RSI Trace
    fig.add_trace(
        go.Scatter(
            x=df["datetime"],
            y=df["rsi"],
            line=dict(color="#D500F9", width=1.5),
            name="RSI 14",
        ),
        row=2, col=1,
    )

    # RSI Levels (30, 50, 70)
    fig.add_hline(y=70, line_dash="dot", line_color="#EF5350", row=2, col=1)
    fig.add_hline(y=50, line_dash="dot", line_color="#B0BEC5", row=2, col=1)
    fig.add_hline(y=30, line_dash="dot", line_color="#66BB6A", row=2, col=1)

    fig.update_layout(
        height=620,
        margin=dict(l=10, r=10, t=30, b=10),
        template="plotly_dark",
        xaxis_rangeslider_visible=False,
    )
    st.plotly_chart(fig, use_container_width=True)

    # Indicator values summary
    latest_close = df["close"].iloc[-1]
    latest_fast = df["ema_fast"].iloc[-1]
    latest_slow = df["ema_slow"].iloc[-1]
    latest_rsi = df["rsi"].iloc[-1]

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Cena Bieżąca", f"${latest_close:,.2f}")
    c2.metric(f"EMA {config.ema_fast_period}", f"${latest_fast:,.2f}")
    c3.metric(f"EMA {config.ema_slow_period}", f"${latest_slow:,.2f}")
    c4.metric("RSI (14)", f"{latest_rsi:.2f}")

st.divider()

# Tab View: Positions / History / Logs
tab_pos, tab_hist, tab_logs = st.tabs(["📊 Otwarte Pozycje", "📜 Historia Transakcji", "📝 Dziennik Zdarzeń (Logs)"])

with tab_pos:
    if not open_trades:
        st.info("Brak aktywnych pozycji w tej chwili. Silnik czeka na sygnał EMA Crossover + filtr RSI.")
    else:
        pos_df = pd.DataFrame(open_trades)
        st.dataframe(
            pos_df[["trade_id", "symbol", "side", "entry_price", "quantity", "leverage", "sl_price", "tp_price", "break_even_activated", "entry_time"]],
            use_container_width=True,
        )

with tab_hist:
    if not closed_trades:
        st.info("Brak zamkniętych transakcji w bazie danych.")
    else:
        hist_df = pd.DataFrame(closed_trades)
        
        # Cumulative Equity Curve Calculation
        hist_df_chronological = hist_df.iloc[::-1].copy().reset_index(drop=True)
        hist_df_chronological["cumulative_pnl"] = hist_df_chronological["pnl_usd"].cumsum()
        hist_df_chronological["equity"] = 10000.0 + hist_df_chronological["cumulative_pnl"]
        hist_df_chronological["trade_number"] = hist_df_chronological.index + 1

        # Plotly Cumulative Equity Curve
        fig_equity = go.Figure()
        fig_equity.add_trace(
            go.Scatter(
                x=hist_df_chronological["trade_number"],
                y=hist_df_chronological["equity"],
                mode="lines+markers",
                name="Krzywa Kapitałowa (Equity)",
                line=dict(color="#00E676", width=2.5),
                marker=dict(size=6, color="#00E676"),
                fill="tozeroy",
                fillcolor="rgba(0, 230, 118, 0.12)",
            )
        )
        fig_equity.add_hline(y=10000.0, line_dash="dash", line_color="#90A4AE", annotation_text="Kapitał początkowy ($10,000)")
        fig_equity.update_layout(
            title="Krzywa Kapitałowa (Cumulative Equity Curve) z Historii Zamkniętych Transakcji",
            xaxis_title="Numer Transakcji",
            yaxis_title="Kapitał Portfolio (USD)",
            height=340,
            template="plotly_dark",
            margin=dict(l=10, r=10, t=40, b=10),
        )
        st.plotly_chart(fig_equity, use_container_width=True)

        st.dataframe(
            hist_df[["trade_id", "symbol", "side", "entry_price", "exit_price", "quantity", "pnl_usd", "pnl_pct", "exit_reason", "entry_time", "exit_time"]],
            use_container_width=True,
        )
        csv = hist_df.to_csv(index=False).encode("utf-8")
        st.download_button("Pobierz Historię (CSV)", csv, "trade_history.csv", "text/csv")

with tab_logs:
    logs = st.session_state.db.get_recent_logs(limit=40)
    if logs:
        log_df = pd.DataFrame(logs)
        st.dataframe(log_df[["timestamp", "level", "module", "message"]], use_container_width=True)
    else:
        st.info("Brak zarejestrowanych logów w bazie.")
