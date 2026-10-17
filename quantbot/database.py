"""
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
                status TEXT NOT NULL, -- 'OPEN', 'CLOSED', 'CANCELLED'
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
                signal_type TEXT NOT NULL, -- 'LONG', 'SHORT', 'NEUTRAL'
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

            # Indices for low-latency queries
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_equity_ts ON equity_snapshots(timestamp);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(timestamp);")
            conn.commit()

    def record_log(self, level: str, module: str, message: str) -> None:
        """Saves a structured log entry."""
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
        """Records an evaluation signal from the strategy."""
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
        """Inserts a newly opened trade."""
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
        """Updates the stop-loss price for break-even or trailing stop."""
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
        """Closes an open trade and calculates final PnL."""
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
        """Fetches all currently open trades."""
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM trades WHERE status = 'OPEN' ORDER BY id DESC")
            return [dict(row) for row in cursor.fetchall()]

    def get_trade_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetches the trade history for analytics."""
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
        """Stores a snapshot of equity for drawdown and circuit breaker tracking."""
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
        """Gets today's baseline equity (UTC start of day)."""
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
        """Fetches the latest system logs."""
        with self._lock, self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM logs ORDER BY id DESC LIMIT ?", (limit,))
            return [dict(row) for row in cursor.fetchall()]
