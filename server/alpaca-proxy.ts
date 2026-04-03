import { Router } from 'express';

const ALPACA_DATA_URL = 'https://data.alpaca.markets/v2';

export function createAlpacaProxy(apiKey: string, secretKey: string): Router {
  const router = Router();

  router.get('/bars/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { timeframe = '1Min', start, end, limit = '200' } = req.query;

    // Validate symbol: uppercase letters only, 1-5 chars
    if (!/^[A-Z]{1,5}$/.test(symbol)) {
      res.status(400).json({ error: 'Invalid symbol' });
      return;
    }

    // Validate timeframe against whitelist
    const VALID_TIMEFRAMES = ['1Min', '5Min', '15Min', '1Hour', '1Day'];
    const tf = typeof timeframe === 'string' ? timeframe : '1Min';
    if (!VALID_TIMEFRAMES.includes(tf)) {
      res.status(400).json({ error: 'Invalid timeframe' });
      return;
    }

    // Clamp limit to 1-1000
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit as string) || 200));

    // Validate start/end as ISO 8601 dates
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+\-]+)?$/;
    if (start && !ISO_DATE_RE.test(start as string)) {
      res.status(400).json({ error: 'Invalid start date' });
      return;
    }
    if (end && !ISO_DATE_RE.test(end as string)) {
      res.status(400).json({ error: 'Invalid end date' });
      return;
    }

    if (!apiKey || !secretKey) {
      // Return mock historical data
      res.json({ bars: generateMockBars(limitNum) });
      return;
    }

    try {
      const params = new URLSearchParams({
        timeframe: tf,
        limit: String(limitNum),
      });
      if (start) params.set('start', start as string);
      if (end) params.set('end', end as string);

      const response = await fetch(
        `${ALPACA_DATA_URL}/stocks/${symbol}/bars?${params}`,
        {
          headers: {
            'APCA-API-KEY-ID': apiKey,
            'APCA-API-SECRET-KEY': secretKey,
          },
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error('Alpaca API error:', response.status, text);
        res.status(response.status >= 500 ? 502 : response.status).json({ error: 'Market data request failed' });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error('Proxy error:', err);
      res.status(500).json({ error: 'Failed to fetch bars' });
    }
  });

  return router;
}

function generateMockBars(count: number) {
  const bars = [];
  let price = 520 + Math.random() * 10;
  const now = Math.floor(Date.now() / 60000) * 60;

  for (let i = count; i > 0; i--) {
    const change = (Math.random() - 0.48) * 1.5;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 0.8;
    const low = Math.min(open, close) - Math.random() * 0.8;
    const volume = Math.floor(50000 + Math.random() * 200000);

    bars.push({
      t: new Date((now - i * 60) * 1000).toISOString(),
      o: parseFloat(open.toFixed(2)),
      h: parseFloat(high.toFixed(2)),
      l: parseFloat(low.toFixed(2)),
      c: parseFloat(close.toFixed(2)),
      v: volume,
    });

    price = close;
  }

  return bars;
}
