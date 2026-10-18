export class CircuitBreaker {
  private readonly maxDrawdownPct: number;
  private startEquity: number;

  constructor(maxDrawdownPct: number, startingEquity: number) {
    this.maxDrawdownPct = maxDrawdownPct;
    this.startEquity = startingEquity;
  }

  setStartEquity(value: number): void {
    this.startEquity = value;
  }

  getDrawdownPct(currentEquity: number): number {
    if (this.startEquity <= 0) {
      return 0;
    }

    return Math.max(0, ((this.startEquity - currentEquity) / this.startEquity) * 100);
  }

  isTripped(currentEquity: number): boolean {
    return this.getDrawdownPct(currentEquity) >= this.maxDrawdownPct;
  }
}
