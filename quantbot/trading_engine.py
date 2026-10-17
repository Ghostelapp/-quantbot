"""
QuantBot Studio - Asynchronous Trading Engine Module
Low-latency CCXT Binance Futures async trading engine with exponential backoff,
circuit breaker integration, and thread-safe shared state.
"""

import asyncio
import logging
import math
import sys
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import ccxt.async_support as ccxt_async
from quantbot.config import TradingConfig, config as default_config
from quantbot.database import DatabaseManager
from quantbot.risk_manager import RiskManager
from quantbot.strategy import EMACrossoverRSIStrategy, IndicatorState

# Structured logging configuration
logger = logging.getLogger("QuantBot.Engine")


@dataclass
class EngineStatus:
    """Thread-safe snapshot of the trading engine's operational state."""
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
    """
    Asynchronous Core Engine coordinating market data ingestion,
    strategy analysis, risk validation, and order routing on Binance Futures.
    """

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

        # Engine State
        self.status = EngineStatus(symbols=list(self.config.symbols))
        self.exchange: Optional[ccxt_async.binance] = None
        self.market_precisions: Dict[str, Dict[str, float]] = {}

        # Paper Trading Balance Mock (if testnet/live keys are omitted)
        self._paper_balance = 10000.0
        self._paper_positions: Dict[str, Dict[str, Any]] = {}

    async def initialize(self) -> None:
        """Initializes CCXT exchange connection, sets leverage, and verifies connectivity."""
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
            logger.warning(
                "No Binance API credentials provided in .env. "
                "Engine will run in HIGH-FIDELITY PAPER TRADING mode using live public orderbooks."
            )
        else:
            self.status.is_paper_trading = False

        # Load markets with backoff
        await self._load_markets_with_retry()

        # Set leverage and margin mode for target symbols if authenticated
        if not self.status.is_paper_trading and self.exchange:
            for symbol in self.config.symbols:
                try:
                    await self.exchange.set_leverage(self.config.leverage, symbol)
                    logger.info(f"Leverage for {symbol} set to {self.config.leverage}x.")
                except Exception as e:
                    logger.warning(f"Could not set leverage for {symbol}: {e}")

        # Initialize daily starting equity
        await self.refresh_account_metrics()
        baseline = self.db.get_daily_starting_equity()
        self.risk_manager.initialize_daily_equity(self.status.account_equity, baseline)

    async def _load_markets_with_retry(self, max_retries: int = 5) -> None:
        """Loads exchange markets with exponential backoff against network spikes."""
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
                logger.info("Successfully loaded Binance Futures market specifications.")
                return
            except (ccxt_async.NetworkError, ccxt_async.RateLimitExceeded) as exc:
                backoff = math.pow(2, attempt)
                logger.error(f"Network error loading markets (Attempt {attempt}/{max_retries}): {exc}. Retrying in {backoff}s...")
                await asyncio.sleep(backoff)
            except Exception as exc:
                logger.critical(f"Fatal error loading markets: {exc}")
                raise exc

    async def refresh_account_metrics(self) -> None:
        """Refreshes balance, unrealized PnL, equity, and updates the circuit breaker."""
        async with self._lock:
            if self.status.is_paper_trading:
                # Calculate from paper positions
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
                    logger.error(f"Failed to fetch real balance: {e}")
                    self.status.last_error = str(e)
                    return

            # Check circuit breaker
            tripped, dd_pct = self.risk_manager.evaluate_circuit_breaker(total_equity)

            self.status.account_balance = round(balance, 2)
            self.status.account_equity = round(total_equity, 2)
            self.status.daily_drawdown_pct = round(dd_pct, 2)
            self.status.circuit_breaker_active = tripped
            self.status.daily_starting_equity = round(self.risk_manager.daily_starting_equity or total_equity, 2)
            self.status.last_update_utc = datetime.now(timezone.utc).isoformat()

            # Record in SQLite
            self.db.record_equity(
                balance=balance,
                unrealized_pnl=unrealized_pnl,
                total_equity=total_equity,
                daily_starting_equity=self.status.daily_starting_equity,
                drawdown_pct=dd_pct,
                circuit_breaker_active=tripped,
            )

    async def fetch_ohlcv_with_retry(self, symbol: str, limit: int = 100) -> List[List[float]]:
        """Fetches OHLCV candlestick data with resilience against Binance rate limits."""
        if not self.exchange:
            return []

        for attempt in range(1, 4):
            try:
                candles = await self.exchange.fetch_ohlcv(
                    symbol=symbol,
                    timeframe=self.config.timeframe,
                    limit=limit,
                )
                return candles
            except (ccxt_async.RateLimitExceeded, ccxt_async.NetworkError) as err:
                wait_time = 1.5 * attempt
                logger.warning(f"Rate limit / network issue for {symbol}: {err}. Backoff {wait_time}s.")
                await asyncio.sleep(wait_time)
            except Exception as e:
                logger.error(f"Error fetching OHLCV for {symbol}: {e}")
                return []
        return []

    async def process_symbol_lifecycle(self, symbol: str) -> None:
        """Single polling cycle for a symbol: indicators, active trades, break-even, and signals."""
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

        # 1. Manage Existing Open Positions (Break-Even & Exit checks)
        await self._check_open_positions_for_symbol(symbol, current_price)

        # 2. Evaluate Entry Signal if no existing position in this symbol
        open_trades = [t for t in self.db.get_open_trades() if t["symbol"] == symbol]
        if not open_trades and signal in ("LONG", "SHORT"):
            await self._execute_entry_signal(symbol, signal, current_price, state)

    async def _check_open_positions_for_symbol(self, symbol: str, current_price: float) -> None:
        """Inspects open positions for Break-Even triggers or SL/TP hits in paper mode."""
        open_trades = [t for t in self.db.get_open_trades() if t["symbol"] == symbol]
        for trade in open_trades:
            trade_id = trade["trade_id"]
            side = trade["side"]
            entry_price = float(trade["entry_price"])
            sl_price = float(trade["sl_price"])
            tp_price = float(trade["tp_price"])
            already_be = bool(trade.get("break_even_activated", 0))

            # Check Break-Even Trigger (+1.5% profit)
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

            # Paper Trading Resolution Simulation
            if self.status.is_paper_trading:
                # Update unrealized PnL in memory
                qty = float(trade["quantity"])
                unrealized = (current_price - entry_price) * qty if side == "LONG" else (entry_price - current_price) * qty
                if trade_id in self._paper_positions:
                    self._paper_positions[trade_id]["unrealized_pnl"] = unrealized

                # Check SL hit
                sl_hit = (current_price <= sl_price) if side == "LONG" else (current_price >= sl_price)
                if sl_hit:
                    res = self.db.close_trade(trade_id, sl_price, exit_reason="STOP_LOSS")
                    if res:
                        self._paper_balance += res["pnl_usd"]
                        self._paper_positions.pop(trade_id, None)
                        logger.info(f"Paper Trade {trade_id} closed via STOP_LOSS. PnL: ${res['pnl_usd']:.2f}")

                # Check TP hit
                tp_hit = (current_price >= tp_price) if side == "LONG" else (current_price <= tp_price)
                if tp_hit:
                    res = self.db.close_trade(trade_id, tp_price, exit_reason="TAKE_PROFIT")
                    if res:
                        self._paper_balance += res["pnl_usd"]
                        self._paper_positions.pop(trade_id, None)
                        logger.info(f"Paper Trade {trade_id} closed via TAKE_PROFIT. PnL: ${res['pnl_usd']:.2f}")

    async def _execute_entry_signal(
        self,
        symbol: str,
        signal: str,
        current_price: float,
        state: Optional[IndicatorState],
    ) -> None:
        """Executes risk checks and places the trade."""
        # Check overall position limit
        all_open = self.db.get_open_trades()
        if len(all_open) >= self.config.max_open_positions:
            rejection = f"Max open positions ({self.config.max_open_positions}) reached."
            logger.info(f"Signal {signal} for {symbol} skipped: {rejection}")
            if state:
                self.db.record_signal(symbol, signal, current_price, state.ema_fast, state.ema_slow, state.rsi, False, rejection)
            return

        # Quantitative Position Sizing via RiskManager
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

        # Route Order (Real Binance vs Paper Trading)
        if self.status.is_paper_trading or not self.exchange:
            # Paper execution
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
            logger.info(
                f"EXECUTED PAPER TRADE: {signal} {symbol} Qty={risk_profile.quantity} "
                f"Entry=${current_price:,.2f} SL=${risk_profile.sl_price:,.2f} TP=${risk_profile.tp_price:,.2f}"
            )
        else:
            # Real Binance Futures Order Execution
            try:
                order_side = "buy" if signal == "LONG" else "sell"
                # Market Entry
                order = await self.exchange.create_order(
                    symbol=symbol,
                    type="MARKET",
                    side=order_side,
                    amount=risk_profile.quantity,
                )
                logger.info(f"Binance Market Order Executed: {order.get('id')}")

                # Place Stop Loss Market Order
                sl_side = "sell" if signal == "LONG" else "buy"
                await self.exchange.create_order(
                    symbol=symbol,
                    type="STOP_MARKET",
                    side=sl_side,
                    amount=risk_profile.quantity,
                    params={"stopPrice": risk_profile.sl_price, "reduceOnly": True},
                )

                # Place Take Profit Market Order
                await self.exchange.create_order(
                    symbol=symbol,
                    type="TAKE_PROFIT_MARKET",
                    side=sl_side,
                    amount=risk_profile.quantity,
                    params={"stopPrice": risk_profile.tp_price, "reduceOnly": True},
                )

                # Persist trade
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
                logger.error(f"Failed to route Binance order: {exc}")
                self.db.record_log("ERROR", "TradingEngine", f"Order routing failed for {symbol}: {exc}")
                return

        if state:
            self.db.record_signal(symbol, signal, current_price, state.ema_fast, state.ema_slow, state.rsi, True, "Executed")

    async def close_all_positions(self, reason: str = "PANIC_CLOSE") -> None:
        """Emergency circuit or panic button: closes all active positions immediately."""
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
            else:
                # Paper mode exit price
                exit_price = float(trade["entry_price"])

            res = self.db.close_trade(trade_id, exit_price, exit_reason=reason)
            if res and self.status.is_paper_trading:
                self._paper_balance += res["pnl_usd"]
                self._paper_positions.pop(trade_id, None)

        logger.warning(f"All positions closed via {reason}.")
        await self.refresh_account_metrics()

    async def run_loop(self) -> None:
        """Main asynchronous event loop executing cyclic market surveillance."""
        self._is_running = True
        self.status.is_running = True
        logger.info("Trading Engine Loop started.")

        try:
            while self._is_running and not self._shutdown_event.is_set():
                await self.refresh_account_metrics()
                self.status.open_positions_count = len(self.db.get_open_trades())

                # Cycle through configured symbols
                for symbol in self.config.symbols:
                    try:
                        await self.process_symbol_lifecycle(symbol)
                    except Exception as loop_err:
                        logger.error(f"Exception processing {symbol}: {loop_err}", exc_info=True)
                        self.db.record_log("ERROR", "TradingEngine", f"Processing {symbol} failed: {loop_err}")

                await asyncio.sleep(self.config.poll_interval_seconds)

        except asyncio.CancelledError:
            logger.info("Trading loop task cancelled.")
        finally:
            self._is_running = False
            self.status.is_running = False
            if self.exchange:
                await self.exchange.close()
            logger.info("Trading Engine shut down safely.")

    def stop(self) -> None:
        """Stops the engine gracefully."""
        self._is_running = False
        self._shutdown_event.set()
