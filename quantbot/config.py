"""
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
