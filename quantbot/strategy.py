"""
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
    """Snapshot of technical indicators for a specific candle."""
    timestamp: int
    close_price: float
    ema_fast: float
    ema_slow: float
    rsi: float
    ema_crossover: str  # 'BULLISH', 'BEARISH', 'NONE'
    signal: str         # 'LONG', 'SHORT', 'NEUTRAL'


class EMACrossoverRSIStrategy:
    """
    Mathematical Implementation of:
    - EMA(20) & EMA(50) Crossover
    - RSI(14) Filter
    Rules:
      * LONG: EMA20 crosses above EMA50 AND 50 < RSI < 70
      * SHORT: EMA20 crosses below EMA50 AND 30 < RSI < 50
    """

    def __init__(self, config: TradingConfig) -> None:
        self.config = config

    @staticmethod
    def calculate_ema(series: pd.Series, period: int) -> pd.Series:
        """Calculates Exponential Moving Average with standard alpha = 2 / (period + 1)."""
        return series.ewm(span=period, adjust=False).mean()

    @staticmethod
    def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
        """Calculates Relative Strength Index using Wilder's smoothing."""
        delta = series.diff()
        gain = delta.clip(lower=0)
        loss = -1.0 * delta.clip(upper=0)

        avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()

        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi = 100.0 - (100.0 / (1.0 + rs))
        return rsi.fillna(50.0)

    def analyze(self, ohlcv: List[List[float]]) -> Tuple[str, Optional[IndicatorState], pd.DataFrame]:
        """
        Analyzes raw OHLCV candlestick data:
        ohlcv format: [[timestamp, open, high, low, close, volume], ...]
        Returns:
          (signal, latest_state, processed_dataframe)
        """
        if not ohlcv or len(ohlcv) < max(self.config.ema_slow_period, self.config.rsi_period) + 5:
            return "NEUTRAL", None, pd.DataFrame()

        df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df["close"] = df["close"].astype(float)
        df["timestamp"] = df["timestamp"].astype(int)

        # 1. Compute Technical Indicators
        df["ema_fast"] = self.calculate_ema(df["close"], self.config.ema_fast_period)
        df["ema_slow"] = self.calculate_ema(df["close"], self.config.ema_slow_period)
        df["rsi"] = self.calculate_rsi(df["close"], self.config.rsi_period)

        # 2. Compute Crossover Detection on closed / latest candles
        # df.iloc[-1] is latest candle, df.iloc[-2] is the immediate predecessor
        curr_fast = float(df["ema_fast"].iloc[-1])
        curr_slow = float(df["ema_slow"].iloc[-1])
        prev_fast = float(df["ema_fast"].iloc[-2])
        prev_slow = float(df["ema_slow"].iloc[-2])

        curr_rsi = float(df["rsi"].iloc[-1])
        curr_close = float(df["close"].iloc[-1])
        curr_ts = int(df["timestamp"].iloc[-1])

        # Crossover logic
        bullish_crossover = (prev_fast <= prev_slow) and (curr_fast > curr_slow)
        bearish_crossover = (prev_fast >= prev_slow) and (curr_fast < curr_slow)

        crossover_label = "BULLISH" if bullish_crossover else ("BEARISH" if bearish_crossover else "NONE")

        # 3. Apply Strict RSI Filtering
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
