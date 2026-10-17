"""
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
    """Calculated sizing and risk parameters for a prospective trade."""
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
    """
    Quantitative Risk Manager ensuring capital preservation.
    Rules:
      1. Position sizing derived strictly from 1.5% portfolio risk.
      2. Rigid 1:2 Risk-to-Reward Ratio (1.5% SL, 3.0% TP).
      3. Trailing Break-Even trigger at +1.5% unrealized gain.
      4. Global Circuit Breaker halts all new trades if daily drawdown >= 5.0%.
    """

    def __init__(self, config: TradingConfig) -> None:
        self.config = config
        self.circuit_breaker_tripped: bool = False
        self.daily_starting_equity: Optional[float] = None

    def initialize_daily_equity(self, current_equity: float, db_baseline: Optional[float] = None) -> None:
        """Sets the baseline equity for calculating daily max drawdown."""
        if db_baseline and db_baseline > 0:
            self.daily_starting_equity = db_baseline
        elif self.daily_starting_equity is None or self.daily_starting_equity <= 0:
            self.daily_starting_equity = current_equity

        logger.info(f"Daily starting equity initialized at: ${self.daily_starting_equity:,.2f}")

    def evaluate_circuit_breaker(self, current_equity: float) -> Tuple[bool, float]:
        """
        Calculates daily drawdown:
        Drawdown % = ((daily_starting_equity - current_equity) / daily_starting_equity) * 100
        Trips breaker if drawdown >= circuit_breaker_max_drawdown_pct (5%).
        """
        if self.daily_starting_equity is None or self.daily_starting_equity <= 0:
            self.daily_starting_equity = current_equity
            return False, 0.0

        drawdown_pct = max(0.0, ((self.daily_starting_equity - current_equity) / self.daily_starting_equity) * 100.0)

        if drawdown_pct >= self.config.circuit_breaker_max_drawdown_pct:
            if not self.circuit_breaker_tripped:
                logger.critical(
                    f"CIRCUIT BREAKER TRIGGERED! Current drawdown: {drawdown_pct:.2f}% "
                    f"exceeds max limit {self.config.circuit_breaker_max_drawdown_pct:.2f}%. "
                    f"All new trading is locked."
                )
                self.circuit_breaker_tripped = True
            return True, drawdown_pct

        return self.circuit_breaker_tripped, drawdown_pct

    def reset_circuit_breaker(self, current_equity: float) -> None:
        """Manual or next-day reset of circuit breaker."""
        self.circuit_breaker_tripped = False
        self.daily_starting_equity = current_equity
        logger.warning(f"Circuit breaker reset manually. New starting equity: ${current_equity:,.2f}")

    def calculate_position(
        self,
        symbol: str,
        side: str,
        entry_price: float,
        account_equity: float,
        step_size: float = 0.001,
        min_notional: float = 5.0,
    ) -> Optional[PositionRiskProfile]:
        """
        Calculates position size based on portfolio risk tolerance:
          Risk Amount = account_equity * (risk_per_trade_pct / 100)
          Stop Loss Distance ($) = entry_price * (stop_loss_pct / 100)
          Quantity = Risk Amount / Stop Loss Distance ($)
        """
        # 1. Check Circuit Breaker
        tripped, dd = self.evaluate_circuit_breaker(account_equity)
        if tripped:
            logger.warning(f"Trade rejected: Circuit breaker is active (Drawdown: {dd:.2f}%).")
            return None

        # 2. Risk Amount per trade (1.5% of equity)
        risk_amount_usd = account_equity * (self.config.risk_per_trade_pct / 100.0)
        sl_pct = self.config.stop_loss_pct / 100.0
        tp_pct = self.config.take_profit_pct / 100.0

        # 3. Calculate SL & TP Target Prices
        if side == "LONG":
            sl_price = round(entry_price * (1.0 - sl_pct), 4)
            tp_price = round(entry_price * (1.0 + tp_pct), 4)
            per_unit_risk = entry_price - sl_price
        elif side == "SHORT":
            sl_price = round(entry_price * (1.0 + sl_pct), 4)
            tp_price = round(entry_price * (1.0 - tp_pct), 4)
            per_unit_risk = sl_price - entry_price
        else:
            logger.error(f"Invalid side: {side}")
            return None

        if per_unit_risk <= 0:
            logger.error("Calculated per-unit risk is non-positive.")
            return None

        # 4. Raw Position Quantity & Sizing
        raw_quantity = risk_amount_usd / per_unit_risk

        # Round down to exchange precision step_size
        precision_decimals = 0
        step_str = f"{step_size:.8f}".rstrip("0")
        if "." in step_str:
            precision_decimals = len(step_str.split(".")[1])

        rounded_qty = round(raw_quantity - (raw_quantity % step_size), precision_decimals)
        notional_usd = rounded_qty * entry_price

        # 5. Check Minimum Notional Requirement
        if notional_usd < min_notional or rounded_qty <= 0:
            logger.warning(
                f"Trade rejected for {symbol}: Position notional (${notional_usd:.2f}) "
                f"below minimum notional (${min_notional:.2f}) or zero quantity."
            )
            return None

        # 6. Verify Risk to Reward Ratio
        per_unit_reward = abs(tp_price - entry_price)
        calculated_rrr = per_unit_reward / per_unit_risk
        if calculated_rrr < (self.config.risk_to_reward_ratio - 0.05):
            logger.warning(f"Calculated RRR ({calculated_rrr:.2f}) does not satisfy 1:2 criteria.")
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
        """
        Checks if position has gained at least trailing_break_even_pct (1.5%).
        If yes, moves Stop-Loss to entry price (Break-Even) + small offset to cover fees.
        """
        if already_activated:
            return None

        trigger_pct = self.config.trailing_break_even_pct / 100.0

        if side == "LONG":
            unrealized_gain_pct = (current_price - entry_price) / entry_price
            if unrealized_gain_pct >= trigger_pct and current_sl < entry_price:
                # Move to entry price (+0.05% buffer for exchange fees)
                new_sl = round(entry_price * 1.0005, 4)
                logger.info(f"LONG Break-Even triggered! Gain: {unrealized_gain_pct*100:.2f}%. Moving SL to {new_sl}")
                return new_sl

        elif side == "SHORT":
            unrealized_gain_pct = (entry_price - current_price) / entry_price
            if unrealized_gain_pct >= trigger_pct and current_sl > entry_price:
                # Move to entry price (-0.05% buffer for exchange fees)
                new_sl = round(entry_price * 0.9995, 4)
                logger.info(f"SHORT Break-Even triggered! Gain: {unrealized_gain_pct*100:.2f}%. Moving SL to {new_sl}")
                return new_sl

        return None
