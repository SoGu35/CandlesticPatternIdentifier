import WebSocket from 'ws';

const ALPACA_WS_URL = 'wss://stream.data.alpaca.markets/v2/iex';

interface TradeMessage {
  T: 't';
  S: string;   // symbol
  p: number;    // price
  s: number;    // size
  t: string;    // timestamp
}

interface BarUpdate {
  type: 'bar_update' | 'bar_close';
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class AlpacaWSBridge {
  private apiKey: string;
  private secretKey: string;
  private alpacaWs: WebSocket | null = null;
  private clients: Set<WebSocket> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private mockTimer: ReturnType<typeof setInterval> | null = null;

  // Current forming 1-min bar
  private currentBar: BarUpdate | null = null;
  private currentBarMinute = 0;

  constructor(apiKey: string, secretKey: string) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
  }

  addClient(ws: WebSocket) {
    this.clients.add(ws);
  }

  removeClient(ws: WebSocket) {
    this.clients.delete(ws);
  }

  private broadcast(data: object) {
    const msg = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  connect() {
    if (this.alpacaWs) {
      this.alpacaWs.close();
    }

    console.log('Connecting to Alpaca WebSocket...');
    this.alpacaWs = new WebSocket(ALPACA_WS_URL);

    this.alpacaWs.on('open', () => {
      console.log('Alpaca WS connected');
      // Authenticate
      this.alpacaWs!.send(JSON.stringify({
        action: 'auth',
        key: this.apiKey,
        secret: this.secretKey,
      }));
    });

    this.alpacaWs.on('message', (raw: Buffer) => {
      try {
        const messages = JSON.parse(raw.toString());
        for (const msg of messages) {
          if (msg.T === 'success' && msg.msg === 'authenticated') {
            console.log('Alpaca WS authenticated');
            // Subscribe to SPY trades
            this.alpacaWs!.send(JSON.stringify({
              action: 'subscribe',
              trades: ['SPY'],
            }));
          } else if (msg.T === 't') {
            this.handleTrade(msg as TradeMessage);
          }
        }
      } catch (err) {
        console.error('Error parsing Alpaca message:', err);
      }
    });

    this.alpacaWs.on('close', () => {
      console.log('Alpaca WS disconnected, reconnecting in 5s...');
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    });

    this.alpacaWs.on('error', (err: Error) => {
      console.error('Alpaca WS error:', err.message);
    });
  }

  private handleTrade(trade: TradeMessage) {
    const tradeTime = new Date(trade.t).getTime() / 1000;
    const minuteBucket = Math.floor(tradeTime / 60) * 60;

    if (this.currentBarMinute !== minuteBucket) {
      // Close the previous bar if one exists
      if (this.currentBar) {
        this.broadcast({ ...this.currentBar, type: 'bar_close' });
      }

      // Start a new bar
      this.currentBarMinute = minuteBucket;
      this.currentBar = {
        type: 'bar_update',
        time: minuteBucket,
        open: trade.p,
        high: trade.p,
        low: trade.p,
        close: trade.p,
        volume: trade.s,
      };
    } else if (this.currentBar) {
      // Update existing bar
      this.currentBar.high = Math.max(this.currentBar.high, trade.p);
      this.currentBar.low = Math.min(this.currentBar.low, trade.p);
      this.currentBar.close = trade.p;
      this.currentBar.volume += trade.s;
    }

    // Send live update to clients
    if (this.currentBar) {
      this.broadcast({ ...this.currentBar, type: 'bar_update' });
    }
  }

  startMockMode() {
    console.log('Starting mock data streaming...');
    let price = 525;
    let lastMinute = Math.floor(Date.now() / 60000) * 60;

    // Send initial historical bars
    const historicalBars: BarUpdate[] = [];
    let histPrice = price - 5;
    for (let i = 200; i > 0; i--) {
      const t = lastMinute - i * 60;
      const change = (Math.random() - 0.48) * 1.2;
      const open = histPrice;
      const close = histPrice + change;
      const high = Math.max(open, close) + Math.random() * 0.6;
      const low = Math.min(open, close) - Math.random() * 0.6;
      historicalBars.push({
        type: 'bar_close',
        time: t,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: Math.floor(50000 + Math.random() * 200000),
      });
      histPrice = close;
    }
    price = histPrice;

    // When a client connects, send historical data
    const origAddClient = this.addClient.bind(this);
    this.addClient = (ws: WebSocket) => {
      origAddClient(ws);
      // Send historical bars
      ws.send(JSON.stringify({ type: 'history', bars: historicalBars }));
    };

    // Simulate trades every 500ms
    this.mockTimer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const currentMinute = Math.floor(now / 60) * 60;

      if (currentMinute !== lastMinute) {
        // Close previous bar
        if (this.currentBar) {
          this.broadcast({ ...this.currentBar, type: 'bar_close' });
        }
        lastMinute = currentMinute;
        // New bar
        const change = (Math.random() - 0.48) * 0.8;
        price += change;
        this.currentBar = {
          type: 'bar_update',
          time: currentMinute,
          open: parseFloat(price.toFixed(2)),
          high: parseFloat(price.toFixed(2)),
          low: parseFloat(price.toFixed(2)),
          close: parseFloat(price.toFixed(2)),
          volume: Math.floor(Math.random() * 10000),
        };
      } else if (this.currentBar) {
        // Update current bar with mock trade
        const tick = (Math.random() - 0.48) * 0.15;
        price += tick;
        price = parseFloat(price.toFixed(2));
        this.currentBar.high = parseFloat(Math.max(this.currentBar.high, price).toFixed(2));
        this.currentBar.low = parseFloat(Math.min(this.currentBar.low, price).toFixed(2));
        this.currentBar.close = price;
        this.currentBar.volume += Math.floor(Math.random() * 5000);
      }

      if (this.currentBar) {
        this.broadcast({ ...this.currentBar, type: 'bar_update' });
      }
    }, 500);
  }
}
