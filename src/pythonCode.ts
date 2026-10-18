/**
 * QuantBot Source Code Repository for In-Browser Code Explorer & ZIP Export.
 */

export interface CodeFile {
  name: string;
  path: string;
  category: 'python' | 'config' | 'deployment';
  description: string;
  code: string;
}

export const QUANTBOT_FILES: CodeFile[] = [
  {
    name: "config.py",
    path: "quantbot/config.py",
    category: "python",
    description: "Niezmienna, walidowana konfiguracja parametrów handlowych, API Binance i ryzyka",
    code: `"""
QuantBot Studio - Production Configuration Module
Loads and validates all trading parameters and Binance API credentials.
"""

import os
from dataclasses import dataclass, field
from typing import List
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


@dataclass(frozen=True)
class TradingConfig:
    """Immutable configuration dataclass for the trading engine and risk management."""

    # Exchange Credentials
    api_key: str = field(default_factory=lambda: os.getenv("BINANCE_API_KEY", ""))
    api_secret: str = field(default_factory=lambda: os.getenv("BINANCE_API_SECRET", ""))
    testnet: bool = field(default_factory=lambda: os.getenv("BINANCE_TESTNET", "true").lower() in ("true", "1", "yes"))

    # Markets
    symbols: List[str] = field(default_factory=lambda: [
        s.strip() for s in os.getenv("TRADING_SYMBOLS", "BTC/USDT,ETH/USDT").split(",") if s.strip()
    ])
    timeframe: str = field(default_factory=lambda: os.getenv("TIMEFRAME", "15m"))
    leverage: int = field(default_factory=lambda: int(os.getenv("LEVERAGE", "5")))
    margin_mode: str = field(default_factory=lambda: os.getenv("MARGIN_MODE", "isolated").lower())

    # Strategy Parameters (EMA Crossover + RSI)
    ema_fast_period: int = field(default_factory=lambda: int(os.getenv("EMA_FAST_PERIOD", "20")))
    ema_slow_period: int = field(default_factory=lambda: int(os.getenv("EMA_SLOW_PERIOD", "50")))
    rsi_period: int = field(default_factory=lambda: int(os.getenv("RSI_PERIOD", "14")))
    rsi_long_lower: float = field(default_factory=lambda: float(os.getenv("RSI_LONG_LOWER", "50.0")))
    rsi_long_upper: float = field(default_factory=lambda: float(os.getenv("RSI_LONG_UPPER", "70.0")))
    rsi_short_upper: float = field(default_factory=lambda: float(os.getenv("RSI_SHORT_UPPER", "50.0")))
    rsi_short_lower: float = field(default_factory=lambda: float(os.getenv("RSI_SHORT_LOWER", "30.0")))

    # Risk Management (Strict Master Rules)
    risk_per_trade_pct: float = field(default_factory=lambda: float(os.getenv("RISK_PER_TRADE_PCT", "1.5")))
    stop_loss_pct: float = field(default_factory=lambda: float(os.getenv("STOP_LOSS_PCT", "1.5")))
    take_profit_pct: float = field(default_factory=lambda: float(os.getenv("TAKE_PROFIT_PCT", "3.0")))
    risk_to_reward_ratio: float = field(default_factory=lambda: float(os.getenv("RRR", "2.0")))
    trailing_break_even_pct: float = field(default_factory=lambda: float(os.getenv("TRAILING_BREAK_EVEN_PCT", "1.5")))
    circuit_breaker_max_drawdown_pct: float = field(default_factory=lambda: float(os.getenv("CIRCUIT_BREAKER_MAX_DD_PCT", "5.0")))
    max_open_positions: int = field(default_factory=lambda: int(os.getenv("MAX_OPEN_POSITIONS", "2")))

    # Engine Execution & Polling
    poll_interval_seconds: int = field(default_factory=lambda: int(os.getenv("POLL_INTERVAL_SECONDS", "15")))
    db_path: str = field(default_factory=lambda: os.getenv("DATABASE_PATH", "quantbot.db"))
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO").upper())

    def validate(self) -> None:
        """Validates configuration sanity on startup."""
        if not self.symbols:
            raise ValueError("TradingConfig: At least one trading symbol must be specified.")
        if self.risk_per_trade_pct <= 0 or self.risk_per_trade_pct > 5.0:
            raise ValueError(f"TradingConfig: risk_per_trade_pct ({self.risk_per_trade_pct}%) must be between 0.1% and 5.0%.")
        if self.stop_loss_pct <= 0:
            raise ValueError("TradingConfig: stop_loss_pct must be strictly positive.")
        if self.take_profit_pct <= self.stop_loss_pct:
            raise ValueError("TradingConfig: take_profit_pct must be greater than stop_loss_pct for positive RRR.")
        if self.circuit_breaker_max_drawdown_pct <= 0 or self.circuit_breaker_max_drawdown_pct > 20:
            raise ValueError("TradingConfig: Circuit breaker drawdown must be between 1.0% and 20.0%.")


config = TradingConfig()
`
  },
  {
    name: "database.py",
    path: "quantbot/database.py",
    category: "python",
    description: "Bezpieczny wątkowo SQLite z trybem WAL: transakcje, sygnały, equity i audyt logów",
    code: `"""
QuantBot Studio - Thread-Safe SQLite Persistence Module
Stores trades, signals, equity snapshots, and system audit logs.
"""

import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class DatabaseManager:
    """Thread-safe SQLite database manager for high-integrity trading records."""

    def __init__(self, db_path: str = "quantbot.db") -> None:
        self.db_path = db_path
        self._lock = threading.Lock()
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        """Returns a connection configured with WAL journal mode for concurrent reads."""
        conn = sqlite3.connect(self.db_path, check_same_thread=False, timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def _init_db(self) -> None:
        """Initializes database schema if tables do not exist."""
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()

            # Trades Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trade_id TEXT UNIQUE,
                symbol TEXT NOT NULL,
                side TEXT NOT NULL,
                entry_price REAL NOT NULL,
                exit_price REAL,
                quantity REAL NOT NULL,
                leverage INTEGER NOT NULL,
                sl_price REAL NOT NULL,
                tp_price REAL NOT NULL,
                pnl_usd REAL DEFAULT 0.0,
                pnl_pct REAL DEFAULT 0.0,
                fee_usd REAL DEFAULT 0.0,
                status TEXT NOT NULL,
                break_even_activated INTEGER DEFAULT 0,
                entry_time TEXT NOT NULL,
                exit_time TEXT,
                exit_reason TEXT
            );
            """)

            # Equity Snapshots (for Drawdown calculation & Circuit Breaker)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS equity_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                balance REAL NOT NULL,
                unrealized_pnl REAL NOT NULL,
                total_equity REAL NOT NULL,
                daily_starting_equity REAL NOT NULL,
                drawdown_pct REAL NOT NULL,
                circuit_breaker_active INTEGER NOT NULL
            );
            """)

            # Signals Log
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS signals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                symbol TEXT NOT NULL,
                signal_type TEXT NOT NULL,
                price REAL NOT NULL,
                ema_fast REAL NOT NULL,
                ema_slow REAL NOT NULL,
                rsi REAL NOT NULL,
                executed INTEGER NOT NULL,
                rejection_reason TEXT
            );
            """)

            # System Logs
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                level TEXT NOT NULL,
                module TEXT NOT NULL,
                message TEXT NOT NULL
            );
            """)

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_equity_ts ON equity_snapshots(timestamp);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(timestamp);")
            conn.commit()

    def record_log(self, level: str, module: str, message: str) -> None:
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO logs (timestamp, level, module, message) VALUES (?, ?, ?, ?)",
                (datetime.now(timezone.utc).isoformat(), level, module, message),
            )
            conn.commit()

    def record_signal(
        self,
        symbol: str,
        signal_type: str,
        price: float,
        ema_fast: float,
        ema_slow: float,
        rsi: float,
        executed: bool,
        rejection_reason: Optional[str] = None,
    ) -> None:
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO signals 
                (timestamp, symbol, signal_type, price, ema_fast, ema_slow, rsi, executed, rejection_reason) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    datetime.now(timezone.utc).isoformat(),
                    symbol,
                    signal_type,
                    price,
                    ema_fast,
                    ema_slow,
                    rsi,
                    1 if executed else 0,
                    rejection_reason or "",
                ),
            )
            conn.commit()

    def insert_trade(self, trade_data: Dict[str, Any]) -> int:
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO trades 
                (trade_id, symbol, side, entry_price, quantity, leverage, sl_price, tp_price, status, entry_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
                """,
                (
                    trade_data["trade_id"],
                    trade_data["symbol"],
                    trade_data["side"],
                    trade_data["entry_price"],
                    trade_data["quantity"],
                    trade_data["leverage"],
                    trade_data["sl_price"],
                    trade_data["tp_price"],
                    trade_data.get("entry_time", datetime.now(timezone.utc).isoformat()),
                ),
            )
            conn.commit()
            return cursor.lastrowid

    def update_trade_sl(self, trade_id: str, new_sl: float, break_even_activated: bool = True) -> None:
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE trades
                SET sl_price = ?, break_even_activated = ?
                WHERE trade_id = ? AND status = 'OPEN'
                """,
                (new_sl, 1 if break_even_activated else 0, trade_id),
            )
            conn.commit()

    def close_trade(
        self,
        trade_id: str,
        exit_price: float,
        exit_reason: str,
        fee_usd: float = 0.0,
    ) -> Optional[Dict[str, Any]]:
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM trades WHERE trade_id = ?", (trade_id,))
            row = cursor.fetchone()
            if not row or row["status"] != "OPEN":
                return None

            entry_price = float(row["entry_price"])
            quantity = float(row["quantity"])
            side = row["side"]

            if side == "LONG":
                pnl_usd = (exit_price - entry_price) * quantity - fee_usd
                pnl_pct = ((exit_price - entry_price) / entry_price) * 100.0
            else:
                pnl_usd = (entry_price - exit_price) * quantity - fee_usd
                pnl_pct = ((entry_price - exit_price) / entry_price) * 100.0

            exit_time = datetime.now(timezone.utc).isoformat()

            cursor.execute(
                """
                UPDATE trades
                SET exit_price = ?, exit_time = ?, exit_reason = ?, pnl_usd = ?, pnl_pct = ?, fee_usd = ?, status = 'CLOSED'
                WHERE trade_id = ?
                """,
                (exit_price, exit_time, exit_reason, pnl_usd, pnl_pct, fee_usd, trade_id),
            )
            conn.commit()

            return {
                "trade_id": trade_id,
                "pnl_usd": pnl_usd,
                "pnl_pct": pnl_pct,
                "exit_price": exit_price,
                "exit_reason": exit_reason,
            }

    def get_open_trades(self) -> List[Dict[str, Any]]:
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM trades WHERE status = 'OPEN' ORDER BY id DESC")
            return [dict(row) for row in cursor.fetchall()]

    def get_trade_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM trades WHERE status = 'CLOSED' ORDER BY id DESC LIMIT ?", (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def record_equity(
        self,
        balance: float,
        unrealized_pnl: float,
        total_equity: float,
        daily_starting_equity: float,
        drawdown_pct: float,
        circuit_breaker_active: bool,
    ) -> None:
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO equity_snapshots 
                (timestamp, balance, unrealized_pnl, total_equity, daily_starting_equity, drawdown_pct, circuit_breaker_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    datetime.now(timezone.utc).isoformat(),
                    balance,
                    unrealized_pnl,
                    total_equity,
                    daily_starting_equity,
                    drawdown_pct,
                    1 if circuit_breaker_active else 0,
                ),
            )
            conn.commit()

    def get_daily_starting_equity(self) -> Optional[float]:
        today_start = datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00")
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT total_equity FROM equity_snapshots WHERE timestamp >= ? ORDER BY id ASC LIMIT 1",
                (today_start,),
            )
            row = cursor.fetchone()
            return float(row["total_equity"]) if row else None

    def get_recent_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM logs ORDER BY id DESC LIMIT ?", (limit,))
            return [dict(row) for row in cursor.fetchall()]
`
  },
  {
    name: "risk_manager.py",
    path: "quantbot/risk_manager.py",
    category: "python",
    description: "Zarządzanie ryzykiem: Position Sizing (1.5%), RRR 1:2, Break-Even i Circuit Breaker (5% DD)",
    code: `"""
QuantBot Studio - Quantitative Risk Management Module
Enforces strict position sizing, stop-loss/take-profit calculation,
break-even adjustments, and the global circuit breaker mechanism.
"""

import logging
from dataclasses import dataclass
from typing import Optional, Tuple
from quantbot.config import TradingConfig

logger = logging.getLogger("QuantBot.RiskManager")


@dataclass
class PositionRiskProfile:
    symbol: str
    side: str
    entry_price: float
    quantity: float
    notional_usd: float
    risk_amount_usd: float
    sl_price: float
    tp_price: float
    risk_to_reward_ratio: float
    leverage: int


class RiskManager:
    def __init__(self, config: TradingConfig) -> None:
        self.config = config
        self.circuit_breaker_tripped: bool = False
        self.daily_starting_equity: Optional[float] = None

    def initialize_daily_equity(self, current_equity: float, db_baseline: Optional[float] = None) -> None:
        if db_baseline and db_baseline > 0:
            self.daily_starting_equity = db_baseline
        elif self.daily_starting_equity is None or self.daily_starting_equity <= 0:
            self.daily_starting_equity = current_equity
        logger.info(f"Daily starting equity initialized at: \${self.daily_starting_equity:,.2f}")

    def evaluate_circuit_breaker(self, current_equity: float) -> Tuple[bool, float]:
        if self.daily_starting_equity is None or self.daily_starting_equity <= 0:
            self.daily_starting_equity = current_equity
            return False, 0.0

        drawdown_pct = max(0.0, ((self.daily_starting_equity - current_equity) / self.daily_starting_equity) * 100.0)

        if drawdown_pct >= self.config.circuit_breaker_max_drawdown_pct:
            if not self.circuit_breaker_tripped:
                logger.critical(
                    f"CIRCUIT BREAKER TRIGGERED! Drawdown: {drawdown_pct:.2f}% >= {self.config.circuit_breaker_max_drawdown_pct:.2f}%. Trading locked."
                )
                self.circuit_breaker_tripped = True
            return True, drawdown_pct

        return self.circuit_breaker_tripped, drawdown_pct

    def reset_circuit_breaker(self, current_equity: float) -> None:
        self.circuit_breaker_tripped = False
        self.daily_starting_equity = current_equity
        logger.warning(f"Circuit breaker reset manually. New starting equity: \${current_equity:,.2f}")

    def calculate_position(
        self,
        symbol: str,
        side: str,
        entry_price: float,
        account_equity: float,
        step_size: float = 0.001,
        min_notional: float = 5.0,
    ) -> Optional[PositionRiskProfile]:
        tripped, dd = self.evaluate_circuit_breaker(account_equity)
        if tripped:
            logger.warning(f"Trade rejected: Circuit breaker is active (Drawdown: {dd:.2f}%).")
            return None

        risk_amount_usd = account_equity * (self.config.risk_per_trade_pct / 100.0)
        sl_pct = self.config.stop_loss_pct / 100.0
        tp_pct = self.config.take_profit_pct / 100.0

        if side == "LONG":
            sl_price = round(entry_price * (1.0 - sl_pct), 4)
            tp_price = round(entry_price * (1.0 + tp_pct), 4)
            per_unit_risk = entry_price - sl_price
        elif side == "SHORT":
            sl_price = round(entry_price * (1.0 + sl_pct), 4)
            tp_price = round(entry_price * (1.0 - tp_pct), 4)
            per_unit_risk = sl_price - entry_price
        else:
            return None

        if per_unit_risk <= 0:
            return None

        raw_quantity = risk_amount_usd / per_unit_risk

        precision_decimals = 0
        step_str = f"{step_size:.8f}".rstrip("0")
        if "." in step_str:
            precision_decimals = len(step_str.split(".")[1])

        rounded_qty = round(raw_quantity - (raw_quantity % step_size), precision_decimals)
        notional_usd = rounded_qty * entry_price

        if notional_usd < min_notional or rounded_qty <= 0:
            return None

        per_unit_reward = abs(tp_price - entry_price)
        calculated_rrr = per_unit_reward / per_unit_risk
        if calculated_rrr < (self.config.risk_to_reward_ratio - 0.05):
            return None

        return PositionRiskProfile(
            symbol=symbol,
            side=side,
            entry_price=entry_price,
            quantity=rounded_qty,
            notional_usd=round(notional_usd, 2),
            risk_amount_usd=round(risk_amount_usd, 2),
            sl_price=sl_price,
            tp_price=tp_price,
            risk_to_reward_ratio=round(calculated_rrr, 2),
            leverage=self.config.leverage,
        )

    def check_break_even(
        self,
        side: str,
        entry_price: float,
        current_price: float,
        current_sl: float,
        already_activated: bool,
    ) -> Optional[float]:
        if already_activated:
            return None

        trigger_pct = self.config.trailing_break_even_pct / 100.0

        if side == "LONG":
            unrealized_gain_pct = (current_price - entry_price) / entry_price
            if unrealized_gain_pct >= trigger_pct and current_sl < entry_price:
                new_sl = round(entry_price * 1.0005, 4)
                return new_sl

        elif side == "SHORT":
            unrealized_gain_pct = (entry_price - current_price) / entry_price
            if unrealized_gain_pct >= trigger_pct and current_sl > entry_price:
                new_sl = round(entry_price * 0.9995, 4)
                return new_sl

        return None
`
  },
  {
    name: "strategy.py",
    path: "quantbot/strategy.py",
    category: "python",
    description: "Strategia ilościowa: Przecięcie EMA 20/50 + filtr momentum RSI(14) na interwale 15m",
    code: `"""
QuantBot Studio - Quantitative Strategy Module
EMA 20 / EMA 50 Crossover with RSI (14) Momentum Filtering on 15m Timeframe.
"""

from dataclasses import dataclass
from typing import List, Optional, Tuple
import numpy as np
import pandas as pd
from quantbot.config import TradingConfig


@dataclass
class IndicatorState:
    timestamp: int
    close_price: float
    ema_fast: float
    ema_slow: float
    rsi: float
    ema_crossover: str
    signal: str


class EMACrossoverRSIStrategy:
    def __init__(self, config: TradingConfig) -> None:
        self.config = config

    @staticmethod
    def calculate_ema(series: pd.Series, period: int) -> pd.Series:
        return series.ewm(span=period, adjust=False).mean()

    @staticmethod
    def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
        delta = series.diff()
        gain = delta.clip(lower=0)
        loss = -1.0 * delta.clip(upper=0)
        avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi = 100.0 - (100.0 / (1.0 + rs))
        return rsi.fillna(50.0)

    def analyze(self, ohlcv: List[List[float]]) -> Tuple[str, Optional[IndicatorState], pd.DataFrame]:
        if not ohlcv or len(ohlcv) < max(self.config.ema_slow_period, self.config.rsi_period) + 5:
            return "NEUTRAL", None, pd.DataFrame()

        df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df["close"] = df["close"].astype(float)
        df["timestamp"] = df["timestamp"].astype(int)

        df["ema_fast"] = self.calculate_ema(df["close"], self.config.ema_fast_period)
        df["ema_slow"] = self.calculate_ema(df["close"], self.config.ema_slow_period)
        df["rsi"] = self.calculate_rsi(df["close"], self.config.rsi_period)

        curr_fast = float(df["ema_fast"].iloc[-1])
        curr_slow = float(df["ema_slow"].iloc[-1])
        prev_fast = float(df["ema_fast"].iloc[-2])
        prev_slow = float(df["ema_slow"].iloc[-2])

        curr_rsi = float(df["rsi"].iloc[-1])
        curr_close = float(df["close"].iloc[-1])
        curr_ts = int(df["timestamp"].iloc[-1])

        bullish_crossover = (prev_fast <= prev_slow) and (curr_fast > curr_slow)
        bearish_crossover = (prev_fast >= prev_slow) and (curr_fast < curr_slow)

        crossover_label = "BULLISH" if bullish_crossover else ("BEARISH" if bearish_crossover else "NONE")

        signal = "NEUTRAL"
        if bullish_crossover:
            if self.config.rsi_long_lower <= curr_rsi <= self.config.rsi_long_upper:
                signal = "LONG"
        elif bearish_crossover:
            if self.config.rsi_short_lower <= curr_rsi <= self.config.rsi_short_upper:
                signal = "SHORT"

        state = IndicatorState(
            timestamp=curr_ts,
            close_price=curr_close,
            ema_fast=round(curr_fast, 2),
            ema_slow=round(curr_slow, 2),
            rsi=round(curr_rsi, 2),
            ema_crossover=crossover_label,
            signal=signal,
        )

        return signal, state, df
`
  },
  {
    name: "trading_engine.py",
    path: "quantbot/trading_engine.py",
    category: "python",
    description: "Asynchroniczny silnik CCXT z exponential backoff, routingiem zleceń, obsługą paper trading i panic close",
    code: `"""
QuantBot Studio - Asynchronous Trading Engine Module
Low-latency CCXT Binance Futures async trading engine with exponential backoff,
circuit breaker integration, and thread-safe shared state.
"""

import asyncio
import logging
import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import ccxt.async_support as ccxt_async
from quantbot.config import TradingConfig, config as default_config
from quantbot.database import DatabaseManager
from quantbot.risk_manager import RiskManager
from quantbot.strategy import EMACrossoverRSIStrategy, IndicatorState

logger = logging.getLogger("QuantBot.Engine")


@dataclass
class EngineStatus:
    is_running: bool = False
    is_paper_trading: bool = False
    circuit_breaker_active: bool = False
    daily_drawdown_pct: float = 0.0
    account_balance: float = 10000.0
    account_equity: float = 10000.0
    daily_starting_equity: float = 10000.0
    open_positions_count: int = 0
    symbols: List[str] = field(default_factory=list)
    last_update_utc: str = ""
    last_error: Optional[str] = None
    indicator_states: Dict[str, Dict[str, Any]] = field(default_factory=dict)


class TradingEngine:
    def __init__(
        self,
        config: Optional[TradingConfig] = None,
        db: Optional[DatabaseManager] = None,
    ) -> None:
        self.config = config or default_config
        self.config.validate()

        self.db = db or DatabaseManager(self.config.db_path)
        self.risk_manager = RiskManager(self.config)
        self.strategy = EMACrossoverRSIStrategy(self.config)

        self._lock = asyncio.Lock()
        self._is_running = False
        self._shutdown_event = asyncio.Event()

        self.status = EngineStatus(symbols=list(self.config.symbols))
        self.exchange: Optional[ccxt_async.binance] = None
        self.market_precisions: Dict[str, Dict[str, float]] = {}

        self._paper_balance = 10000.0
        self._paper_positions: Dict[str, Dict[str, Any]] = {}

    async def initialize(self) -> None:
        has_keys = bool(self.config.api_key and self.config.api_secret)

        exchange_params: Dict[str, Any] = {
            "enableRateLimit": True,
            "options": {
                "defaultType": "future",
                "adjustForTimeDifference": True,
            },
        }

        if has_keys:
            exchange_params["apiKey"] = self.config.api_key
            exchange_params["secret"] = self.config.api_secret

        self.exchange = ccxt_async.binance(exchange_params)

        if self.config.testnet:
            self.exchange.set_sandbox_mode(True)
            logger.info("Operating in Binance Futures TESTNET / SANDBOX mode.")

        if not has_keys:
            self.status.is_paper_trading = True
            logger.warning("No Binance API credentials in .env. Running in PAPER TRADING mode.")
        else:
            self.status.is_paper_trading = False

        await self._load_markets_with_retry()

        if not self.status.is_paper_trading and self.exchange:
            for symbol in self.config.symbols:
                try:
                    await self.exchange.set_leverage(self.config.leverage, symbol)
                except Exception as e:
                    logger.warning(f"Could not set leverage for {symbol}: {e}")

        await self.refresh_account_metrics()
        baseline = self.db.get_daily_starting_equity()
        self.risk_manager.initialize_daily_equity(self.status.account_equity, baseline)

    async def _load_markets_with_retry(self, max_retries: int = 5) -> None:
        if not self.exchange:
            return
        for attempt in range(1, max_retries + 1):
            try:
                markets = await self.exchange.load_markets()
                for symbol in self.config.symbols:
                    if symbol in markets:
                        market_info = markets[symbol]
                        limits = market_info.get("limits", {})
                        amount_limits = limits.get("amount", {})
                        cost_limits = limits.get("cost", {})
                        step_size = amount_limits.get("min", 0.001) or 0.001
                        min_notional = cost_limits.get("min", 5.0) or 5.0
                        self.market_precisions[symbol] = {
                            "step_size": float(step_size),
                            "min_notional": float(min_notional),
                        }
                    else:
                        self.market_precisions[symbol] = {"step_size": 0.001, "min_notional": 5.0}
                return
            except (ccxt_async.NetworkError, ccxt_async.RateLimitExceeded) as exc:
                backoff = math.pow(2, attempt)
                await asyncio.sleep(backoff)
            except Exception as exc:
                raise exc

    async def refresh_account_metrics(self) -> None:
        async with self._lock:
            if self.status.is_paper_trading:
                unrealized_pnl = sum(p.get("unrealized_pnl", 0.0) for p in self._paper_positions.values())
                balance = self._paper_balance
                total_equity = balance + unrealized_pnl
            else:
                try:
                    if not self.exchange:
                        return
                    balance_resp = await self.exchange.fetch_balance({"type": "future"})
                    usdt_info = balance_resp.get("USDT", {})
                    balance = float(usdt_info.get("total", 0.0))
                    unrealized_pnl = float(balance_resp.get("info", {}).get("totalUnrealizedProfit", 0.0))
                    total_equity = balance + unrealized_pnl
                except Exception as e:
                    self.status.last_error = str(e)
                    return

            tripped, dd_pct = self.risk_manager.evaluate_circuit_breaker(total_equity)

            self.status.account_balance = round(balance, 2)
            self.status.account_equity = round(total_equity, 2)
            self.status.daily_drawdown_pct = round(dd_pct, 2)
            self.status.circuit_breaker_active = tripped
            self.status.daily_starting_equity = round(self.risk_manager.daily_starting_equity or total_equity, 2)
            self.status.last_update_utc = datetime.now(timezone.utc).isoformat()

            self.db.record_equity(
                balance=balance,
                unrealized_pnl=unrealized_pnl,
                total_equity=total_equity,
                daily_starting_equity=self.status.daily_starting_equity,
                drawdown_pct=dd_pct,
                circuit_breaker_active=tripped,
            )

    async def fetch_ohlcv_with_retry(self, symbol: str, limit: int = 100) -> List[List[float]]:
        if not self.exchange:
            return []
        for attempt in range(1, 4):
            try:
                candles = await self.exchange.fetch_ohlcv(symbol, self.config.timeframe, limit=limit)
                return candles
            except (ccxt_async.RateLimitExceeded, ccxt_async.NetworkError):
                await asyncio.sleep(1.5 * attempt)
            except Exception:
                return []
        return []

    async def process_symbol_lifecycle(self, symbol: str) -> None:
        candles = await self.fetch_ohlcv_with_retry(symbol, limit=80)
        if not candles:
            return

        signal, state, _ = self.strategy.analyze(candles)
        current_price = candles[-1][4]

        if state:
            self.status.indicator_states[symbol] = {
                "close_price": state.close_price,
                "ema_fast": state.ema_fast,
                "ema_slow": state.ema_slow,
                "rsi": state.rsi,
                "crossover": state.ema_crossover,
                "signal": signal,
                "timestamp": state.timestamp,
            }

        await self._check_open_positions_for_symbol(symbol, current_price)

        open_trades = [t for t in self.db.get_open_trades() if t["symbol"] == symbol]
        if not open_trades and signal in ("LONG", "SHORT"):
            await self._execute_entry_signal(symbol, signal, current_price, state)

    async def _check_open_positions_for_symbol(self, symbol: str, current_price: float) -> None:
        open_trades = [t for t in self.db.get_open_trades() if t["symbol"] == symbol]
        for trade in open_trades:
            trade_id = trade["trade_id"]
            side = trade["side"]
            entry_price = float(trade["entry_price"])
            sl_price = float(trade["sl_price"])
            tp_price = float(trade["tp_price"])
            already_be = bool(trade.get("break_even_activated", 0))

            new_sl = self.risk_manager.check_break_even(
                side=side,
                entry_price=entry_price,
                current_price=current_price,
                current_sl=sl_price,
                already_activated=already_be,
            )
            if new_sl:
                self.db.update_trade_sl(trade_id, new_sl, break_even_activated=True)
                self.db.record_log("INFO", "TradingEngine", f"Moved SL to Break-Even ({new_sl}) for {trade_id}")

            if self.status.is_paper_trading:
                qty = float(trade["quantity"])
                unrealized = (current_price - entry_price) * qty if side == "LONG" else (entry_price - current_price) * qty
                if trade_id in self._paper_positions:
                    self._paper_positions[trade_id]["unrealized_pnl"] = unrealized

                sl_hit = (current_price <= sl_price) if side == "LONG" else (current_price >= sl_price)
                if sl_hit:
                    res = self.db.close_trade(trade_id, sl_price, exit_reason="STOP_LOSS")
                    if res:
                        self._paper_balance += res["pnl_usd"]
                        self._paper_positions.pop(trade_id, None)

                tp_hit = (current_price >= tp_price) if side == "LONG" else (current_price <= tp_price)
                if tp_hit:
                    res = self.db.close_trade(trade_id, tp_price, exit_reason="TAKE_PROFIT")
                    if res:
                        self._paper_balance += res["pnl_usd"]
                        self._paper_positions.pop(trade_id, None)

    async def _execute_entry_signal(
        self,
        symbol: str,
        signal: str,
        current_price: float,
        state: Optional[IndicatorState],
    ) -> None:
        all_open = self.db.get_open_trades()
        if len(all_open) >= self.config.max_open_positions:
            rejection = f"Max open positions ({self.config.max_open_positions}) reached."
            if state:
                self.db.record_signal(symbol, signal, current_price, state.ema_fast, state.ema_slow, state.rsi, False, rejection)
            return

        prec = self.market_precisions.get(symbol, {"step_size": 0.001, "min_notional": 5.0})
        risk_profile = self.risk_manager.calculate_position(
            symbol=symbol,
            side=signal,
            entry_price=current_price,
            account_equity=self.status.account_equity,
            step_size=prec["step_size"],
            min_notional=prec["min_notional"],
        )

        if not risk_profile:
            rejection = "RiskManager rejected position size (Circuit Breaker or Notional)."
            if state:
                self.db.record_signal(symbol, signal, current_price, state.ema_fast, state.ema_slow, state.rsi, False, rejection)
            return

        trade_id = f"QB-{symbol.replace('/', '')}-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:4].upper()}"

        if self.status.is_paper_trading or not self.exchange:
            trade_record = {
                "trade_id": trade_id,
                "symbol": symbol,
                "side": signal,
                "entry_price": current_price,
                "quantity": risk_profile.quantity,
                "leverage": risk_profile.leverage,
                "sl_price": risk_profile.sl_price,
                "tp_price": risk_profile.tp_price,
            }
            self.db.insert_trade(trade_record)
            self._paper_positions[trade_id] = {
                "symbol": symbol,
                "side": signal,
                "entry_price": current_price,
                "quantity": risk_profile.quantity,
                "unrealized_pnl": 0.0,
            }
            logger.info(f"PAPER TRADE: {signal} {symbol} Qty={risk_profile.quantity} @ {current_price}")
        else:
            try:
                order_side = "buy" if signal == "LONG" else "sell"
                await self.exchange.create_order(symbol, "MARKET", order_side, risk_profile.quantity)

                sl_side = "sell" if signal == "LONG" else "buy"
                await self.exchange.create_order(
                    symbol, "STOP_MARKET", sl_side, risk_profile.quantity,
                    params={"stopPrice": risk_profile.sl_price, "reduceOnly": True}
                )
                await self.exchange.create_order(
                    symbol, "TAKE_PROFIT_MARKET", sl_side, risk_profile.quantity,
                    params={"stopPrice": risk_profile.tp_price, "reduceOnly": True}
                )

                trade_record = {
                    "trade_id": trade_id,
                    "symbol": symbol,
                    "side": signal,
                    "entry_price": current_price,
                    "quantity": risk_profile.quantity,
                    "leverage": risk_profile.leverage,
                    "sl_price": risk_profile.sl_price,
                    "tp_price": risk_profile.tp_price,
                }
                self.db.insert_trade(trade_record)
            except Exception as exc:
                self.db.record_log("ERROR", "TradingEngine", f"Order routing failed for {symbol}: {exc}")
                return

        if state:
            self.db.record_signal(symbol, signal, current_price, state.ema_fast, state.ema_slow, state.rsi, True, "Executed")

    async def close_all_positions(self, reason: str = "PANIC_CLOSE") -> None:
        open_trades = self.db.get_open_trades()
        for trade in open_trades:
            trade_id = trade["trade_id"]
            symbol = trade["symbol"]
            side = trade["side"]
            qty = float(trade["quantity"])

            exit_price = trade["entry_price"]
            if self.exchange and not self.status.is_paper_trading:
                try:
                    close_side = "sell" if side == "LONG" else "buy"
                    ticker = await self.exchange.fetch_ticker(symbol)
                    exit_price = ticker.get("last", trade["entry_price"])
                    await self.exchange.create_order(symbol, "MARKET", close_side, qty, params={"reduceOnly": True})
                except Exception as e:
                    logger.error(f"Error emergency closing {symbol}: {e}")

            res = self.db.close_trade(trade_id, float(exit_price), exit_reason=reason)
            if res and self.status.is_paper_trading:
                self._paper_balance += res["pnl_usd"]
                self._paper_positions.pop(trade_id, None)

        await self.refresh_account_metrics()

    async def run_loop(self) -> None:
        self._is_running = True
        self.status.is_running = True
        try:
            while self._is_running and not self._shutdown_event.is_set():
                await self.refresh_account_metrics()
                self.status.open_positions_count = len(self.db.get_open_trades())

                for symbol in self.config.symbols:
                    try:
                        await self.process_symbol_lifecycle(symbol)
                    except Exception as loop_err:
                        self.db.record_log("ERROR", "TradingEngine", f"Processing {symbol} failed: {loop_err}")

                await asyncio.sleep(self.config.poll_interval_seconds)
        except asyncio.CancelledError:
            pass
        finally:
            self._is_running = False
            self.status.is_running = False
            if self.exchange:
                await self.exchange.close()

    def stop(self) -> None:
        self._is_running = False
        self._shutdown_event.set()
`
  },
  {
    name: "app.py",
    path: "quantbot/app.py",
    category: "python",
    description: "Kompletny panel webowy Streamlit z interaktywnymi wykresami Plotly, metrykami i kontrolkami",
    code: `"""
QuantBot Studio - Streamlit Trading Dashboard
High-frequency quantitative monitoring interface with Plotly charts,
live PnL tracking, manual overrides, and risk telemetry.
"""

import asyncio
import threading
import time
import sys
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

st.set_page_config(
    page_title="QuantBot Studio - Binance Futures Dashboard",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

if "db" not in st.session_state:
    st.session_state.db = DatabaseManager(config.db_path)

if "engine" not in st.session_state:
    st.session_state.engine = TradingEngine(config=config, db=st.session_state.db)

if "engine_thread" not in st.session_state:
    st.session_state.engine_thread: Optional[threading.Thread] = None

if "loop" not in st.session_state:
    st.session_state.loop = None


def start_engine_in_background():
    def _run():
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        st.session_state.loop = new_loop
        new_loop.run_until_complete(st.session_state.engine.initialize())
        new_loop.run_until_complete(st.session_state.engine.run_loop())

    if not st.session_state.engine.status.is_running:
        t = threading.Thread(target=_run, daemon=True)
        t.start()
        st.session_state.engine_thread = t
        time.sleep(1.0)


def stop_engine():
    if st.session_state.engine:
        st.session_state.engine.stop()


# SIDEBAR CONTROLS
with st.sidebar:
    st.title("⚡ QuantBot Studio")
    st.caption("Binance Futures USDT-M Algorithmic Engine")
    st.divider()

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
        stop_engine()
        st.success("Wszystkie pozycje zamknięte.")
        st.rerun()

    st.divider()
    st.subheader("Parametry Ryzyka")
    st.markdown(f"""
    - **Pary:** \`{', '.join(config.symbols)}\`
    - **Timeframe:** \`{config.timeframe}\`
    - **Ryzyko/trade:** \`{config.risk_per_trade_pct}%\`
    - **Stop Loss:** \`{config.stop_loss_pct}%\`
    - **Take Profit:** \`{config.take_profit_pct}%\` (RRR 1:{config.risk_to_reward_ratio})
    - **Trailing Break-Even:** \`{config.trailing_break_even_pct}%\`
    - **Max Dzienny Drawdown:** \`{config.circuit_breaker_max_drawdown_pct}%\`
    - **Dźwignia:** \`{config.leverage}x\`
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


# MAIN DASHBOARD
st.title("Panel Transakcyjny QuantBot")

status = st.session_state.engine.status
open_trades = st.session_state.db.get_open_trades()
closed_trades = st.session_state.db.get_trade_history(limit=50)

total_wins = sum(1 for t in closed_trades if t.get("pnl_usd", 0) > 0)
total_trades = len(closed_trades)
win_rate = (total_wins / total_trades * 100.0) if total_trades > 0 else 0.0
realized_pnl = sum(t.get("pnl_usd", 0) for t in closed_trades)

m1, m2, m3, m4, m5, m6 = st.columns(6)
m1.metric("Kapitał (Equity)", f"\${status.account_equity:,.2f}")
m2.metric("Saldo (Balance)", f"\${status.account_balance:,.2f}")
m3.metric("Zrealizowany PnL", f"\${realized_pnl:,.2f}", delta=f"{realized_pnl:,.2f}")
m4.metric("Dzienny Drawdown", f"{status.daily_drawdown_pct:.2f}%", delta=f"-{status.daily_drawdown_pct:.2f}%", delta_color="inverse")
m5.metric("Otwarte Pozycje", f"{len(open_trades)} / {config.max_open_positions}")
m6.metric("Win Rate", f"{win_rate:.1f}%", f"{total_wins}/{total_trades} wygranych")

st.divider()

selected_symbol = st.selectbox("Wybierz walor do analizy technicznej:", config.symbols, index=0)

candles = asyncio.run(st.session_state.engine.fetch_ohlcv_with_retry(selected_symbol, limit=80))

if candles:
    df = pd.DataFrame(candles, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["datetime"] = pd.to_datetime(df["timestamp"], unit="ms")
    df["ema_fast"] = st.session_state.engine.strategy.calculate_ema(df["close"], config.ema_fast_period)
    df["ema_slow"] = st.session_state.engine.strategy.calculate_ema(df["close"], config.ema_slow_period)
    df["rsi"] = st.session_state.engine.strategy.calculate_rsi(df["close"], config.rsi_period)

    fig = make_subplots(
        rows=2, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.08,
        subplot_titles=(f"Notowania {selected_symbol} ({config.timeframe}) z EMA {config.ema_fast_period} i EMA {config.ema_slow_period}", "Wskaźnik RSI (14) z progami 30 / 50 / 70"),
        row_heights=[0.7, 0.3],
    )

    fig.add_trace(go.Candlestick(x=df["datetime"], open=df["open"], high=df["high"], low=df["low"], close=df["close"], name="Świece"), row=1, col=1)
    fig.add_trace(go.Scatter(x=df["datetime"], y=df["ema_fast"], line=dict(color="#00E5FF", width=1.8), name=f"EMA {config.ema_fast_period}"), row=1, col=1)
    fig.add_trace(go.Scatter(x=df["datetime"], y=df["ema_slow"], line=dict(color="#FF9100", width=1.8), name=f"EMA {config.ema_slow_period}"), row=1, col=1)

    for t in open_trades:
        if t["symbol"] == selected_symbol:
            entry = float(t["entry_price"])
            sl = float(t["sl_price"])
            tp = float(t["tp_price"])
            side = t["side"]
            fig.add_hline(y=entry, line_dash="dot", line_color="#FFFFFF", annotation_text=f"Entry ({side})", row=1, col=1)
            fig.add_hline(y=sl, line_dash="dash", line_color="#FF1744", annotation_text=f"SL ({sl})", row=1, col=1)
            fig.add_hline(y=tp, line_dash="dash", line_color="#00E676", annotation_text=f"TP ({tp})", row=1, col=1)

    fig.add_trace(go.Scatter(x=df["datetime"], y=df["rsi"], line=dict(color="#D500F9", width=1.5), name="RSI 14"), row=2, col=1)
    fig.add_hline(y=70, line_dash="dot", line_color="#EF5350", row=2, col=1)
    fig.add_hline(y=50, line_dash="dot", line_color="#B0BEC5", row=2, col=1)
    fig.add_hline(y=30, line_dash="dot", line_color="#66BB6A", row=2, col=1)

    fig.update_layout(height=620, margin=dict(l=10, r=10, t=30, b=10), template="plotly_dark", xaxis_rangeslider_visible=False)
    st.plotly_chart(fig, use_container_width=True)

st.divider()

tab_pos, tab_hist, tab_logs = st.tabs(["📊 Otwarte Pozycje", "📜 Historia Transakcji", "📝 Dziennik Zdarzeń (Logs)"])

with tab_pos:
    if not open_trades:
        st.info("Brak aktywnych pozycji. Silnik czeka na sygnał EMA Crossover + filtr RSI.")
    else:
        st.dataframe(pd.DataFrame(open_trades), use_container_width=True)

with tab_hist:
    if not closed_trades:
        st.info("Brak zamkniętych transakcji.")
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

        st.dataframe(hist_df, use_container_width=True)
        st.download_button("Pobierz Historię (CSV)", hist_df.to_csv(index=False).encode("utf-8"), "trade_history.csv", "text/csv")

with tab_logs:
    logs = st.session_state.db.get_recent_logs(limit=40)
    if logs:
        st.dataframe(pd.DataFrame(logs), use_container_width=True)
    else:
        st.info("Brak logów w bazie.")
`
  },
  {
    name: "requirements.txt",
    path: "quantbot/requirements.txt",
    category: "config",
    description: "Zależności produkcyjne Pythona: CCXT, Streamlit, Plotly, Pandas, NumPy",
    code: `ccxt>=4.2.0
streamlit>=1.35.0
plotly>=5.22.0
pandas>=2.2.0
numpy>=1.26.0
python-dotenv>=1.0.1
aiohttp>=3.9.5
`
  },
  {
    name: ".env.example",
    path: "quantbot/.env.example",
    category: "config",
    description: "Szablon zmiennych środowiskowych z pełnym opisem i bezpiecznymi wartościami domyślnymi",
    code: `# Binance Futures API Credentials
BINANCE_API_KEY=twoj_klucz_api_binance
BINANCE_API_SECRET=twoj_sekret_api_binance
BINANCE_TESTNET=true

# Rynki i pary handlowe
TRADING_SYMBOLS=BTC/USDT,ETH/USDT
TIMEFRAME=15m
LEVERAGE=5
MARGIN_MODE=isolated

# Parametry Strategii (EMA Crossover + Filtr RSI)
EMA_FAST_PERIOD=20
EMA_SLOW_PERIOD=50
RSI_PERIOD=14
RSI_LONG_LOWER=50.0
RSI_LONG_UPPER=70.0
RSI_SHORT_UPPER=50.0
RSI_SHORT_LOWER=30.0

# Ścisłe Zarządzanie Ryzykiem (Risk Management)
RISK_PER_TRADE_PCT=1.5
STOP_LOSS_PCT=1.5
TAKE_PROFIT_PCT=3.0
RRR=2.0
TRAILING_BREAK_EVEN_PCT=1.5
CIRCUIT_BREAKER_MAX_DD_PCT=5.0
MAX_OPEN_POSITIONS=2

# Silnik i baza danych
POLL_INTERVAL_SECONDS=15
DATABASE_PATH=quantbot.db
LOG_LEVEL=INFO
`
  },
  {
    name: "Dockerfile",
    path: "quantbot/Dockerfile",
    category: "deployment",
    description: "Wieloplatformowy obraz Docker z Pythonem 3.10-slim i healthcheckiem",
    code: `FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8501

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8501/_stcore/health || exit 1

CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0", "--server.headless=true"]
`
  },
  {
    name: "docker-compose.yml",
    path: "quantbot/docker-compose.yml",
    category: "deployment",
    description: "Orkiestracja kontenerowa z wolumenami dla bazy SQLite i rotacją logów",
    code: `version: '3.8'

services:
  quantbot:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: quantbot_engine
    restart: unless-stopped
    ports:
      - "8501:8501"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - ./quantbot.db:/app/quantbot.db
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "5"
`
  },
  {
    name: "quantbot.service",
    path: "quantbot/quantbot.service",
    category: "deployment",
    description: "Jednostka systemd dla serwera produkcyjnego Linux (Ubuntu / Debian VPS)",
    code: `[Unit]
Description=QuantBot Studio - Binance Futures Trading Engine & Dashboard
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/quantbot
EnvironmentFile=/opt/quantbot/.env
ExecStart=/opt/quantbot/venv/bin/streamlit run app.py --server.port=8501 --server.address=0.0.0.0 --server.headless=true
Restart=always
RestartSec=5
StandardOutput=append:/var/log/quantbot.log
StandardError=append:/var/log/quantbot_error.log

[Install]
WantedBy=multi-user.target
`
  }
];
