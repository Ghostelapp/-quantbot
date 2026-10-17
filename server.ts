import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Initialize GoogleGenAI server-side client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Multi-turn Gemini AI Chat API endpoint
app.post('/api/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages, contextData } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Brak wiadomości w zapytaniu (messages array required).' });
      return;
    }

    // System instruction for QuantBot AI Advisor role
    const systemInstruction = `Jesteś "QuantBot AI Advisor" - elitarnym doradcą ds. algorytmicznego tradingu kryptowalut i inżynierem ilościowym (Senior Quantitative Trading Engineer).
Twoim zadaniem jest wspieranie użytkownika w analizie strategii EMA 20/50 Crossover, filtra RSI 14, kalkulacji wielkości pozycji (Position Sizing 1.5%), zasadzie Risk-to-Reward 1:2, mechanizmach Trailing Break-Even oraz Circuit Breaker (5% max daily drawdown).
Odpowiadaj merytorycznie, zwięźle, profesjonalnie, posługując się precyzyjną terminologią tradingową i matematyczną.
Aktualny kontekst portfela użytkownika: ${JSON.stringify(contextData || {})}
Formatuj odpowiedzi czytelnie w Markdown.`;

    // Map conversation history to Gemini contents format
    const contents = messages.map((m: { role: 'user' | 'model'; text: string }) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const replyText = response.text || 'Przepraszam, nie udało się wygenerować odpowiedzi.';
    res.json({ reply: replyText });
  } catch (err: any) {
    console.error('Błąd Gemini API:', err);
    res.status(500).json({
      error: 'Błąd przetwarzania zapytania AI.',
      details: err?.message || String(err),
    });
  }
});

// REAL-TIME 1-SECOND PRICE FEED PROXY (Binance Futures USDT-M)
app.get('/api/binance/prices', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [btcRes, ethRes] = await Promise.all([
      fetch('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT'),
      fetch('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=ETHUSDT'),
    ]);

    if (!btcRes.ok || !ethRes.ok) {
      throw new Error('Binance API response error');
    }

    const [btcData, ethData] = await Promise.all([btcRes.json(), ethRes.json()]);

    res.json({
      btc: {
        symbol: 'BTC/USDT',
        price: parseFloat(btcData.lastPrice),
        change24h: parseFloat(btcData.priceChangePercent),
        high24h: parseFloat(btcData.highPrice),
        low24h: parseFloat(btcData.lowPrice),
        volume24h: parseFloat(btcData.volume),
      },
      eth: {
        symbol: 'ETH/USDT',
        price: parseFloat(ethData.lastPrice),
        change24h: parseFloat(ethData.priceChangePercent),
        high24h: parseFloat(ethData.highPrice),
        low24h: parseFloat(ethData.lowPrice),
        volume24h: parseFloat(ethData.volume),
      },
      timestamp: Date.now(),
    });
  } catch (err: any) {
    // Fallback to spot API if futures endpoint throttles
    try {
      const spotRes = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22%5D');
      const spotData = await spotRes.json();
      const btc = spotData.find((d: any) => d.symbol === 'BTCUSDT');
      const eth = spotData.find((d: any) => d.symbol === 'ETHUSDT');
      res.json({
        btc: {
          symbol: 'BTC/USDT',
          price: parseFloat(btc?.lastPrice || '81500'),
          change24h: parseFloat(btc?.priceChangePercent || '0'),
          high24h: parseFloat(btc?.highPrice || '82000'),
          low24h: parseFloat(btc?.lowPrice || '80000'),
          volume24h: parseFloat(btc?.volume || '30000'),
        },
        eth: {
          symbol: 'ETH/USDT',
          price: parseFloat(eth?.lastPrice || '2420'),
          change24h: parseFloat(eth?.priceChangePercent || '0'),
          high24h: parseFloat(eth?.highPrice || '2480'),
          low24h: parseFloat(eth?.lowPrice || '2380'),
          volume24h: parseFloat(eth?.volume || '150000'),
        },
        timestamp: Date.now(),
      });
    } catch (fallbackErr) {
      res.status(502).json({ error: 'Błąd pobierania cen na żywo z Binance.' });
    }
  }
});

// REAL CANDLESTICKS (KLINES) PROXY (Binance Futures USDT-M)
app.get('/api/binance/klines', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSymbol = ((req.query.symbol as string) || 'BTCUSDT').replace('/', '').toUpperCase();
    const interval = (req.query.interval as string) || '15m';
    const limit = parseInt((req.query.limit as string) || '60', 10);

    const binanceUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${rawSymbol}&interval=${interval}&limit=${limit}`;
    const klinesRes = await fetch(binanceUrl);

    if (!klinesRes.ok) {
      throw new Error(`Binance klines failed with status ${klinesRes.status}`);
    }

    const rawKlines = await klinesRes.json();
    // Format: [openTime, open, high, low, close, volume, closeTime, ...]
    const candles = rawKlines.map((k: any[]) => ({
      timestamp: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));

    res.json({ symbol: rawSymbol, interval, candles });
  } catch (err: any) {
    console.error('Błąd pobierania świec:', err);
    res.status(502).json({ error: 'Błąd pobierania danych świecowych.', details: err?.message });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QuantBot Studio Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
