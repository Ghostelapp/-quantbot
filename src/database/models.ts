export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    entry_time TEXT NOT NULL,
    exit_time TEXT,
    entry_price REAL NOT NULL,
    exit_price REAL,
    quantity REAL NOT NULL,
    sl REAL NOT NULL,
    tp REAL NOT NULL,
    pnl REAL
  )`,
  `CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    entry_time TEXT NOT NULL,
    entry_price REAL NOT NULL,
    quantity REAL NOT NULL,
    sl REAL NOT NULL,
    tp REAL NOT NULL,
    break_even_active INTEGER DEFAULT 0,
    exchange_order_id TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',
    unrealized_pnl REAL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_date TEXT NOT NULL UNIQUE,
    max_dd REAL NOT NULL,
    win_rate REAL NOT NULL,
    realized_pnl REAL NOT NULL
  )`,
];
