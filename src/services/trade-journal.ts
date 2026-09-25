/**
 * NEXUS Trade Journal 2.1
 *
 * Structured decision journal. Keeps the reason for every simulated/trading
 * decision so later memory and analytics can learn from real outcomes.
 */

export type JournalEntry = {
  id: string;
  createdAt: number;
  symbol: string;
  timeframe?: string;
  side: "long" | "short" | "hold" | "avoid";
  status: "planned" | "open" | "closed" | "cancelled";
  entry?: number;
  exit?: number;
  stop?: number;
  target?: number;
  riskPct?: number;
  agents: Array<{ name: string; decision: string; confidence?: number; reason?: string }>;
  context: Record<string, unknown>;
  result?: {
    pnlPct?: number;
    mfePct?: number;
    maePct?: number;
    feesPct?: number;
    slippagePct?: number;
    lesson?: string;
  };
};

const KEY = "nexus.trade-journal.v2";

function load(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
function save(x: JournalEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(x.slice(-3000)));
}

export const tradeJournal = {
  list(): JournalEntry[] {
    return load().sort((a,b) => b.createdAt - a.createdAt);
  },

  create(entry: Omit<JournalEntry, "id" | "createdAt">): JournalEntry {
    const item = {
      ...entry,
      id: `trade_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      createdAt: Date.now()
    };
    const all = load();
    all.push(item);
    save(all);
    return item;
  },

  update(id: string, patch: Partial<JournalEntry>): JournalEntry | null {
    const all = load();
    const i = all.findIndex(x => x.id === id);
    if (i < 0) return null;
    all[i] = { ...all[i], ...patch };
    save(all);
    return all[i];
  },

  close(id: string, result: JournalEntry["result"]): JournalEntry | null {
    return this.update(id, { status: "closed", result });
  },

  stats() {
    const closed = load().filter(x => x.status === "closed");
    const pnl = closed.reduce((s,x) => s + Number(x.result?.pnlPct ?? 0), 0);
    const wins = closed.filter(x => Number(x.result?.pnlPct ?? 0) > 0).length;
    const losses = closed.filter(x => Number(x.result?.pnlPct ?? 0) < 0).length;
    return {
      total: closed.length,
      wins,
      losses,
      winRate: closed.length ? wins / closed.length : 0,
      netPnlPct: pnl
    };
  },

  clear() {
    localStorage.removeItem(KEY);
  }
};
