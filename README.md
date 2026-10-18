# Quantbot (Binance Futures Trading Bot)

Automated TypeScript trading bot for Binance Futures with EMA(20/50) crossover + RSI(14), risk controls, SQLite persistence, scheduling, and optional paper/dry-run modes.

## Features

- Binance Futures integration through `ccxt` (testnet first)
- Strategy: EMA 20/50 crossover + RSI filters
- Risk controls:
  - Position sizing from account balance (`1.5%` risk per trade)
  - SL/TP with `1:2` RRR
  - Max 2 open positions
  - Circuit breaker (`5%` max drawdown)
  - Break-even stop update after `1.5%` profit
- SQLite tables: `trades`, `positions`, `performance`
- Scheduler polling every 15 seconds (`node-cron`)
- Structured JSON logging (`winston`)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env template:
   ```bash
   cp .env.example .env
   ```
3. Fill Binance keys (testnet recommended first) and tune strategy/risk vars.

## Run

```bash
npm run dev      # paper trading + dry run
npm run backtest # fetch candles and print latest strategy signal
npm run start    # run bot (obeys PAPER_TRADING/DRY_RUN env flags)
npm test         # indicator + risk tests
```

## Testnet vs Live

- Keep `BINANCE_TESTNET=true` for testnet
- Keep `DRY_RUN=true` and/or `PAPER_TRADING=true` to avoid real orders
- Set `DRY_RUN=false`, `PAPER_TRADING=false`, and valid API keys for live order execution

## Strategy Rules

- **LONG**: EMA20 crosses above EMA50 and RSI between configured long bounds
- **SHORT**: EMA20 crosses below EMA50 and RSI between configured short bounds
- SL/TP calculated from configured stop-loss percent and RRR

## Performance Metrics

Performance snapshots are written to the `performance` table (daily drawdown, win rate, realized PnL). Positions and trades are stored in `positions` and `trades`.
