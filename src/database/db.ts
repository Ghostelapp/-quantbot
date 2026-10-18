import Database from 'better-sqlite3';
import { config } from '../config/config.js';
import { schemaStatements } from './models.js';
import type { PerformanceStat, Position, Trade } from '../types/index.js';

export class TradingDatabase {
  private readonly db: Database.Database;

  constructor(dbPath = config.databasePath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    for (const statement of schemaStatements) {
      this.db.prepare(statement).run();
    }
  }

  insertTrade(trade: Trade): void {
    this.db
      .prepare(
        `INSERT INTO trades(symbol, side, entry_time, exit_time, entry_price, exit_price, quantity, sl, tp, pnl)
         VALUES(@symbol, @side, @openedAt, @closedAt, @entryPrice, @exitPrice, @quantity, @stopLoss, @takeProfit, @pnl)`,
      )
      .run(trade);
  }

  upsertPosition(position: Position): void {
    if (position.id) {
      this.db
        .prepare(
          `UPDATE positions
           SET sl=@stopLoss, tp=@takeProfit, unrealized_pnl=@unrealizedPnl, break_even_active=@breakEven, status=@status, exchange_order_id=@exchangeOrderId
           WHERE id=@id`,
        )
        .run({
          id: position.id,
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit,
          unrealizedPnl: position.unrealizedPnl,
          breakEven: position.breakEvenActive ? 1 : 0,
          status: position.status,
          exchangeOrderId: position.exchangeOrderId ?? null,
        });
      return;
    }

    const result = this.db
      .prepare(
        `INSERT INTO positions(symbol, side, entry_time, entry_price, quantity, sl, tp, break_even_active, exchange_order_id, status, unrealized_pnl)
         VALUES(@symbol, @side, @openedAt, @entryPrice, @quantity, @stopLoss, @takeProfit, @breakEven, @exchangeOrderId, @status, @unrealizedPnl)`,
      )
      .run({
        ...position,
        breakEven: position.breakEvenActive ? 1 : 0,
        exchangeOrderId: position.exchangeOrderId ?? null,
      });

    position.id = Number(result.lastInsertRowid);
  }

  listOpenPositions(): Position[] {
    const rows = this.db
      .prepare(
        `SELECT id, symbol, side, entry_price as entryPrice, quantity, sl as stopLoss, tp as takeProfit,
                break_even_active as breakEvenActive, exchange_order_id as exchangeOrderId, status,
                unrealized_pnl as unrealizedPnl, entry_time as openedAt
         FROM positions
         WHERE status='OPEN'`,
      )
      .all() as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      id: Number(row.id),
      symbol: String(row.symbol),
      side: row.side as Position['side'],
      entryPrice: Number(row.entryPrice),
      quantity: Number(row.quantity),
      stopLoss: Number(row.stopLoss),
      takeProfit: Number(row.takeProfit),
      breakEvenActive: Number(row.breakEvenActive) === 1,
      exchangeOrderId: row.exchangeOrderId ? String(row.exchangeOrderId) : undefined,
      status: row.status as Position['status'],
      unrealizedPnl: Number(row.unrealizedPnl),
      openedAt: String(row.openedAt),
    }));
  }

  closePosition(position: Position, exitPrice: number): void {
    if (!position.id) {
      return;
    }

    const pnl = position.side === 'LONG'
      ? (exitPrice - position.entryPrice) * position.quantity
      : (position.entryPrice - exitPrice) * position.quantity;

    this.db
      .prepare(`UPDATE positions SET status='CLOSED', unrealized_pnl=@pnl WHERE id=@id`)
      .run({ id: position.id, pnl });

    this.insertTrade({
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      pnl,
      openedAt: position.openedAt,
      closedAt: new Date().toISOString(),
    });
  }

  upsertPerformance(stat: PerformanceStat): void {
    this.db
      .prepare(
        `INSERT INTO performance(trade_date, max_dd, win_rate, realized_pnl)
         VALUES(@tradeDate, @maxDrawdown, @winRate, @realizedPnl)
         ON CONFLICT(trade_date) DO UPDATE SET max_dd=@maxDrawdown, win_rate=@winRate, realized_pnl=@realizedPnl`,
      )
      .run(stat);
  }
}
