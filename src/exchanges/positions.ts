import { TradingDatabase } from '../database/db.js';
import type { Position } from '../types/index.js';

export class PositionService {
  constructor(private readonly db: TradingDatabase) {}

  listOpenPositions(): Position[] {
    return this.db.listOpenPositions();
  }

  save(position: Position): void {
    this.db.upsertPosition(position);
  }

  close(position: Position, exitPrice: number): void {
    this.db.closePosition(position, exitPrice);
  }
}
