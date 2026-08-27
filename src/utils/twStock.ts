import type {
  DividendFrequency,
  FavoriteStock,
  TwStockDividend,
  TwStockExEvent,
  TwStockMarket,
  TwStockQuote,
} from "@/types";

/** 本機走 Vite proxy，避免瀏覽器 CORS；正式站仍打官方網址 */
function stockApi(
  kind: "twse" | "tpex" | "twse-www" | "mis",
  path: string,
): string {
  if (import.meta.env.DEV) return `/tw-stock/${kind}${path}`;
  switch (kind) {
    case "twse":
      return `https://openapi.twse.com.tw${path}`;
    case "tpex":
      return `https://www.tpex.org.tw${path}`;
    case "twse-www":
      return `https://www.twse.com.tw${path}`;
    case "mis":
      return `https://mis.twse.com.tw${path}`;
  }
}

const TWSE_QUOTES_URL = stockApi("twse", "/v1/exchangeReport/STOCK_DAY_ALL");
const TWSE_YIELD_URL = stockApi("twse", "/v1/exchangeReport/BWIBBU_ALL");
const TWSE_EX_URL = stockApi("twse", "/v1/exchangeReport/TWT48U_ALL");
const TWSE_EX_RWD_URL = stockApi(
  "twse-www",
  "/rwd/zh/exRight/TWT48U?response=json",
);
const TPEX_QUOTES_URL = stockApi("tpex", "/openapi/v1/tpex_mainboard_quotes");
const TPEX_YIELD_URL = stockApi(
  "tpex",
  "/openapi/v1/tpex_mainboard_peratio_analysis",
);
const TPEX_EX_URL = stockApi("tpex", "/openapi/v1/tpex_exright_prepost");
const TWSE_POLICY_URL = stockApi("twse", "/v1/opendata/t187ap45_L");
const TPEX_POLICY_URL = stockApi("tpex", "/openapi/v1/mopsfin_t187ap45_O");

type JsonRecord = Record<string, unknown>;

export interface TwStockLiveQuote {
  code: string;
  price: number | null;
  priceText: string;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  tradeDate: string | null;
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function rowText(row: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && String(direct).trim()) return String(direct).trim();
  }
  const entries = Object.entries(row);
  for (const key of keys) {
    const lower = key.toLowerCase();
    const found = entries.find(([name]) => {
      const current = name.toLowerCase();
      return current === lower || current.includes(lower);
    });
    if (found && found[1] != null && String(found[1]).trim()) {
      return String(found[1]).trim();
    }
  }
  return "";
}

export function parseTwNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const text = String(raw)
    .replace(/,/g, "")
    .replace(/[＋]/g, "+")
    .replace(/<[^>]+>/g, "")
    .trim();
  if (!text || text === "--" || text === "—" || text === "-" || text === "X") {
    return null;
  }
  if (/待公告|尚未公告|N\/A/i.test(text)) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseTwDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/\s/g, "").replace(/<[^>]+>/g, "");
  const rocLong = cleaned.match(/^(\d{2,3})年(\d{1,2})月(\d{1,2})日?/);
  if (rocLong) {
    const year = Number(rocLong[1]) + 1911;
    const month = rocLong[2].padStart(2, "0");
    const day = rocLong[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 7) {
    const year = Number(digits.slice(0, 3)) + 1911;
    return `${year}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`;
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

function formatPrice(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("zh-TW", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function changePercent(price: number | null, change: number | null): number | null {
  if (price == null || change == null) return null;
  const prev = price - change;
  if (prev === 0) return null;
  return (change / prev) * 100;
}

async function fetchJson(url: string, timeoutMs = 20_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`無法讀取資料（${response.status}）`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function asRows(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) {
    const first = asRecord(payload[0]);
    if (first && Array.isArray(first.fields) && Array.isArray(first.data)) {
      return payload.flatMap((item) => asRows(item));
    }
    return payload.map(asRecord).filter((row): row is JsonRecord => Boolean(row));
  }
  const root = asRecord(payload);
  if (!root) return [];
  if (Array.isArray(root.tables)) return asRows(root.tables);
  if (Array.isArray(root.data) && Array.isArray(root.fields)) {
    const fields = root.fields.map((field) => String(field));
    return (root.data as unknown[]).flatMap((item) => {
      if (!Array.isArray(item)) return [];
      const row: JsonRecord = {};
      fields.forEach((field, index) => {
        row[field] = item[index];
      });
      return [row];
    });
  }
  for (const key of ["data", "records"]) {
    const nested = root[key];
    if (Array.isArray(nested)) return asRows(nested);
  }
  return [];
}

function parseTwseQuotes(payload: unknown): TwStockQuote[] {
  return asRows(payload).flatMap((row) => {
    const code = rowText(row, ["Code", "股票代號", "證券代號"]);
    const name = rowText(row, ["Name", "證券名稱", "名稱"]);
    if (!code || !name) return [];
    const price = parseTwNumber(
      rowText(row, ["ClosingPrice", "收盤價", "成交", "最新成交價"]),
    );
    const change = parseTwNumber(rowText(row, ["Change", "漲跌價差", "漲跌"]));
    const volume = parseTwNumber(
      rowText(row, ["TradeVolume", "成交股數", "成交量"]),
    );
    return [
      {
        code,
        name,
        market: "twse" as const,
        price,
        priceText: price == null ? "—" : formatPrice(price),
        change,
        changePercent: changePercent(price, change),
        open: parseTwNumber(rowText(row, ["OpeningPrice", "開盤價"])),
        high: parseTwNumber(rowText(row, ["HighestPrice", "最高價"])),
        low: parseTwNumber(rowText(row, ["LowestPrice", "最低價"])),
        volume,
        tradeDate: parseTwDate(rowText(row, ["Date", "日期"])),
      },
    ];
  });
}

function parseTpexQuotes(payload: unknown): TwStockQuote[] {
  return asRows(payload).flatMap((row) => {
    const code = rowText(row, [
      "SecuritiesCompanyCode",
      "股票代號",
      "證券代號",
      "Code",
    ]);
    const name = rowText(row, ["CompanyName", "證券名稱", "名稱", "Name"]);
    if (!code || !name) return [];
    const price = parseTwNumber(
      rowText(row, ["Close", "收盤", "收盤價", "最新成交價"]),
    );
    const change = parseTwNumber(rowText(row, ["Change", "漲跌"]));
    return [
      {
        code,
        name,
        market: "tpex" as const,
        price,
        priceText: price == null ? "—" : formatPrice(price),
        change,
        changePercent: changePercent(price, change),
        open: parseTwNumber(rowText(row, ["Open", "開盤"])),
        high: parseTwNumber(rowText(row, ["High", "最高"])),
        low: parseTwNumber(rowText(row, ["Low", "最低"])),
        volume: parseTwNumber(
          rowText(row, ["TradingShares", "成交股數", "成交量"]),
        ),
        tradeDate: parseTwDate(rowText(row, ["Date", "日期"])),
      },
    ];
  });
}

function parseYieldRows(
  payload: unknown,
  codeKeys: string[],
  yieldKeys: string[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of asRows(payload)) {
    const code = rowText(row, codeKeys);
    const yieldPercent = parseTwNumber(rowText(row, yieldKeys));
    if (code && yieldPercent != null) map.set(code, yieldPercent);
  }
  return map;
}

function parseExRows(payload: unknown, codeKeys: string[]): TwStockDividend[] {
  return asRows(payload).flatMap((row) => {
    const code = rowText(row, codeKeys);
    if (!code) return [];
    const cashText = rowText(row, [
      "現金股利",
      "CashDividend",
      "Dividend",
      "CashEarningsDistribution",
    ]);
    const stockRatio = parseTwNumber(
      rowText(row, [
        "無償配股率",
        "每股無償配股率",
        "StockDividendRatio",
        "StockDividend",
      ]),
    );
    const exType = rowText(row, [
      "除權息",
      "ExrightExdividend",
      "ExType",
      "權或息",
    ]);
    return [
      {
        code,
        cashDividend: parseTwNumber(cashText),
        cashDividendText: cashText && !/待公告|尚未公告/.test(cashText)
          ? cashText.replace(/<[^>]+>/g, "").trim()
          : cashText && /待公告/.test(cashText)
            ? "待公告"
            : "",
        stockDividendRatio: stockRatio,
        yieldPercent: null,
        exDate: parseTwDate(
          rowText(row, [
            "除權除息日期",
            "除權息日期",
            "Date",
            "ExDate",
            "ExDividendDate",
          ]),
        ),
        lastExDate: null,
        lastCashDividend: null,
        trailingCash: null,
        exType,
        frequency: "none",
        history: [],
      },
    ];
  });
}

function parsePolicyPeriods(payload: unknown): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of asRows(payload)) {
    const code = rowText(row, ["公司代號", "SecuritiesCompanyCode", "Code"]);
    const period = rowText(row, [
      "股利所屬年(季)度",
      "股利所屬年季度",
      "DividendPeriod",
      "Period",
    ]);
    if (!code || !period) continue;
    const list = map.get(code) ?? [];
    list.push(period);
    map.set(code, list);
  }
  return map;
}

interface ExHistorySummary {
  count: number;
  lastExDate: string | null;
  lastCash: number | null;
  trailingCash: number;
  events: TwStockExEvent[];
}

function parseExHistory(payloads: unknown[]): Map<string, ExHistorySummary> {
  const events = new Map<string, TwStockExEvent[]>();
  for (const payload of payloads) {
    for (const row of asRows(payload)) {
      const code = rowText(row, ["股票代號", "Code", "證券代號"]);
      if (!code) continue;
      const kind = rowText(row, ["權/息", "除權息", "ExType"]);
      const date =
        parseTwDate(
          rowText(row, [
            "資料日期",
            "除權除息日期",
            "除權息日期",
            "Date",
          ]),
        ) ?? "";
      if (!date) continue;
      const combined = parseTwNumber(rowText(row, ["權值+息值"]));
      const cash =
        parseTwNumber(rowText(row, ["息值", "現金股利"])) ??
        (kind.includes("息") ? combined : null);
      const stock =
        parseTwNumber(rowText(row, ["無償配股率", "配股率"])) ?? null;
      const preClose = parseTwNumber(
        rowText(row, ["除權息前收盤價", "前收盤價"]),
      );
      const list = events.get(code) ?? [];
      const existing = list.find((item) => item.exDate === date);
      if (existing) {
        if (cash != null) existing.cashDividend = cash;
        if (stock != null) existing.stockDividendRatio = stock;
        if (kind && !existing.kind.includes(kind)) {
          existing.kind = [existing.kind, kind].filter(Boolean).join("");
        }
        if (preClose != null) existing.preClose = preClose;
        continue;
      }
      list.push({
        exDate: date,
        cashDividend: cash,
        stockDividendRatio: stock,
        kind,
        preClose,
        fillDate: null,
        fillChecked: false,
      });
      events.set(code, list);
    }
  }

  const map = new Map<string, ExHistorySummary>();
  for (const [code, list] of events) {
    const sorted = [...list].sort((a, b) => a.exDate.localeCompare(b.exDate));
    const cashEvents = sorted.filter(
      (item) => item.kind.includes("息") || item.cashDividend,
    );
    const last = cashEvents[cashEvents.length - 1] ?? sorted[sorted.length - 1];
    map.set(code, {
      count: cashEvents.length,
      lastExDate: last?.exDate ?? null,
      lastCash: last?.cashDividend ?? null,
      trailingCash: cashEvents.reduce(
        (sum, item) => sum + (item.cashDividend ?? 0),
        0,
      ),
      events: [...sorted].reverse(),
    });
  }
  return map;
}

function yyyymmdd(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function rocYyyymmdd(date: Date): string {
  return `${date.getFullYear() - 1911}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function twt49uHistoryUrls(start: Date, end: Date): string[] {
  const ranges = [
    [yyyymmdd(start), yyyymmdd(end)],
    [rocYyyymmdd(start), rocYyyymmdd(end)],
  ] as const;
  return ranges.map(([from, to]) =>
    stockApi(
      "twse-www",
      `/rwd/zh/exRight/TWT49U?response=json&startDate=${from}&endDate=${to}`,
    ),
  );
}

export async function fetchStockExHistory(): Promise<Map<string, ExHistorySummary>> {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 13);

  for (const url of twt49uHistoryUrls(start, end)) {
    try {
      const parsed = parseExHistory([await fetchJson(url, 45_000)]);
      if (parsed.size > 0) return parsed;
    } catch {
      continue;
    }
  }
  return new Map();
}

interface DailyClose {
  date: string;
  close: number;
}

const dailyCloseCache = new Map<string, DailyClose[]>();

function yearMonthsBetween(startIso: string, end: Date): string[] {
  const start = new Date(`${startIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  const months: string[] = [];
  while (cursor <= last) {
    months.push(yyyymmdd(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function parseDailyCloses(payload: unknown): DailyClose[] {
  const root = asRecord(payload);
  if (root && Array.isArray(root.aaData)) {
    return (root.aaData as unknown[]).flatMap((item) => {
      if (!Array.isArray(item)) return [];
      const date = parseTwDate(String(item[0] ?? "")) ?? "";
      const close = parseTwNumber(String(item[6] ?? ""));
      if (!date || close == null) return [];
      return [{ date, close }];
    });
  }
  return asRows(payload).flatMap((row) => {
    const date = parseTwDate(rowText(row, ["日期", "Date", "成交日期"])) ?? "";
    const close = parseTwNumber(rowText(row, ["收盤價", "Close", "收盤"]));
    if (!date || close == null) return [];
    return [{ date, close }];
  });
}

async function fetchDailyCloses(
  code: string,
  market: TwStockMarket,
  fromIso: string,
): Promise<DailyClose[]> {
  const cached = dailyCloseCache.get(`${market}:${code}`);
  if (cached?.length) return cached;

  const months = yearMonthsBetween(fromIso, new Date());
  const urls =
    market === "tpex"
      ? months.map((month) => {
          const roc = `${Number(month.slice(0, 4)) - 1911}/${month.slice(4, 6)}`;
          return stockApi(
            "tpex",
            `/web/stock/aftertrading/daily_trading_info/st43_result.php?l=zh-tw&d=${encodeURIComponent(roc)}&stkno=${encodeURIComponent(code)}`,
          );
        })
      : months.map((month) =>
          stockApi(
            "twse-www",
            `/rwd/zh/afterTrading/STOCK_DAY?response=json&date=${month}&stockNo=${encodeURIComponent(code)}`,
          ),
        );

  const results = await Promise.allSettled(urls.map((url) => fetchJson(url)));
  const closes = results.flatMap((result) =>
    result.status === "fulfilled" ? parseDailyCloses(result.value) : [],
  );
  const unique = new Map<string, number>();
  for (const item of closes) unique.set(item.date, item.close);
  const list = [...unique.entries()]
    .map(([date, close]) => ({ date, close }))
    .sort((a, b) => a.date.localeCompare(b.date));
  dailyCloseCache.set(`${market}:${code}`, list);
  return list;
}

function fillDateForEvent(event: TwStockExEvent, closes: DailyClose[]): string | null {
  if (event.preClose == null || event.preClose <= 0) return null;
  for (const day of closes) {
    if (day.date < event.exDate) continue;
    if (day.close >= event.preClose) return day.date;
  }
  return null;
}

export async function attachFillDates(
  code: string,
  market: TwStockMarket,
  events: TwStockExEvent[],
): Promise<TwStockExEvent[]> {
  if (!events.length) return events;
  if (events.every((event) => event.fillChecked)) return events;
  const fromIso = [...events].sort((a, b) => a.exDate.localeCompare(b.exDate))[0]?.exDate;
  if (!fromIso) return events;
  const closes = await fetchDailyCloses(code, market, fromIso);
  return events.map((event) => ({
    ...event,
    fillDate: fillDateForEvent(event, closes),
    fillChecked: true,
  }));
}

export function keepFillDates(
  previous: TwStockExEvent[] | undefined,
  next: TwStockExEvent[],
): TwStockExEvent[] {
  if (!previous?.length) return next;
  return next.map((event) => {
    const old = previous.find((item) => item.exDate === event.exDate);
    if (!old?.fillChecked) return event;
    return {
      ...event,
      fillDate: old.fillDate,
      fillChecked: true,
    };
  });
}

function hasCashPayout(
  yieldPercent: number | null,
  cashDividend: number | null,
  cashDividendText: string,
  lastCashDividend: number | null,
): boolean {
  if (yieldPercent != null && yieldPercent > 0) return true;
  if (cashDividend != null && cashDividend > 0) return true;
  if (lastCashDividend != null && lastCashDividend > 0) return true;
  if (/待公告/.test(cashDividendText)) return true;
  return false;
}

export function classifyDividendFrequency(
  periods: string[],
  exCount: number,
  paysCash: boolean,
): DividendFrequency {
  if (exCount >= 10) return "monthly";
  const joined = periods.join(" ");
  if (/第[1-4]季/.test(joined) || (exCount >= 3 && exCount <= 9)) {
    return "quarterly";
  }
  if (/上半年|下半年/.test(joined) || exCount === 2) return "semiannual";
  if (!paysCash && exCount === 0) return "none";
  if (/年度/.test(joined) || exCount === 1) return paysCash ? "annual" : "none";
  return paysCash ? "annual" : "none";
}

function emptyDividend(code: string, yieldPercent: number | null = null): TwStockDividend {
  return {
    code,
    cashDividend: null,
    cashDividendText: "",
    stockDividendRatio: null,
    yieldPercent,
    exDate: null,
    lastExDate: null,
    lastCashDividend: null,
    trailingCash: null,
    exType: "",
    frequency: "none",
    history: [],
  };
}

function attachUpcomingToEvents(
  events: TwStockExEvent[],
  upcoming: TwStockDividend[],
  code: string,
): TwStockExEvent[] {
  if (!events.length) return events;
  return events.map((event) => {
    const match = upcoming.find(
      (item) => item.code === code && item.exDate === event.exDate,
    );
    if (!match) return event;
    return {
      ...event,
      cashDividend: event.cashDividend ?? match.cashDividend,
      stockDividendRatio: event.stockDividendRatio ?? match.stockDividendRatio,
      kind: event.kind || match.exType,
    };
  });
}

function mergeDividends(
  upcoming: TwStockDividend[],
  yields: Map<string, number>,
  periodsByCode: Map<string, string[]>,
  historyByCode: Map<string, ExHistorySummary>,
): TwStockDividend[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const byCode = new Map<string, TwStockDividend>();
  const sorted = [...upcoming].sort((a, b) => {
    if (!a.exDate) return 1;
    if (!b.exDate) return -1;
    return a.exDate.localeCompare(b.exDate);
  });
  for (const item of sorted) {
    const existing = byCode.get(item.code);
    if (!existing) {
      byCode.set(item.code, { ...item });
      continue;
    }
    const existingPast = Boolean(existing.exDate && existing.exDate < todayIso);
    const incomingFuture = Boolean(item.exDate && item.exDate >= todayIso);
    if (existingPast && incomingFuture) byCode.set(item.code, { ...item });
  }
  for (const [code, yieldPercent] of yields) {
    const existing = byCode.get(code);
    if (existing) existing.yieldPercent = yieldPercent;
    else byCode.set(code, emptyDividend(code, yieldPercent));
  }

  for (const code of new Set([...periodsByCode.keys(), ...historyByCode.keys()])) {
    if (!byCode.has(code)) byCode.set(code, emptyDividend(code));
  }

  return [...byCode.values()].map((item) => {
    const history = historyByCode.get(item.code);
    const lastExDate = history?.lastExDate ?? item.lastExDate;
    const lastCashDividend = history?.lastCash ?? item.lastCashDividend;
    const trailingCash = history?.trailingCash ?? item.trailingCash;
    return {
      ...item,
      exDate: item.exDate && item.exDate >= todayIso ? item.exDate : null,
      exType: item.exDate && item.exDate >= todayIso ? item.exType : "",
      lastExDate,
      lastCashDividend,
      trailingCash,
      history: keepFillDates(
        item.history,
        attachUpcomingToEvents(
          history?.events ?? item.history ?? [],
          upcoming,
          item.code,
        ),
      ),
      frequency: classifyDividendFrequency(
        periodsByCode.get(item.code) ?? [],
        history?.count ?? 0,
        hasCashPayout(
          item.yieldPercent,
          item.cashDividend,
          item.cashDividendText,
          lastCashDividend,
        ),
      ),
    };
  });
}

export function overlayDividendHistory(
  dividendsByCode: Record<string, TwStockDividend>,
  historyByCode: Map<string, ExHistorySummary>,
): Record<string, TwStockDividend> {
  if (!historyByCode.size) return dividendsByCode;
  const next = { ...dividendsByCode };
  for (const [code, history] of historyByCode) {
    const current = next[code] ?? emptyDividend(code);
    next[code] = {
      ...current,
      lastExDate: history.lastExDate,
      lastCashDividend: history.lastCash,
      trailingCash: history.trailingCash,
      history: keepFillDates(current.history, history.events.length ? history.events : current.history),
      frequency: classifyDividendFrequency(
        [],
        history.count,
        hasCashPayout(
          current.yieldPercent,
          current.cashDividend,
          current.cashDividendText,
          history.lastCash,
        ),
      ),
    };
  }
  return next;
}

let memoryByCode = new Map<string, TwStockDividend>();
let memoryHistoryReady = false;
let dividendInflight: Promise<Map<string, TwStockDividend>> | null = null;

export function resetDividendMemory() {
  memoryByCode = new Map();
  memoryHistoryReady = false;
  dividendInflight = null;
}

async function fetchUpcomingExAnnouncements(): Promise<TwStockDividend[]> {
  const [twseEx, tpexEx] = await Promise.allSettled([
    fetchJson(TWSE_EX_URL).catch(() => fetchJson(TWSE_EX_RWD_URL)),
    fetchJson(TPEX_EX_URL),
  ]);
  return [
    ...(twseEx.status === "fulfilled"
      ? parseExRows(twseEx.value, ["股票代號", "Code", "證券代號"])
      : []),
    ...(tpexEx.status === "fulfilled"
      ? parseExRows(tpexEx.value, [
          "SecuritiesCompanyCode",
          "股票代號",
          "Code",
          "證券代號",
        ])
      : []),
  ];
}

export async function fetchMarketQuotes(): Promise<TwStockQuote[]> {
  const [twseQuotes, tpexQuotes] = await Promise.allSettled([
    fetchJson(TWSE_QUOTES_URL),
    fetchJson(TPEX_QUOTES_URL),
  ]);
  return [
    ...(twseQuotes.status === "fulfilled" ? parseTwseQuotes(twseQuotes.value) : []),
    ...(tpexQuotes.status === "fulfilled" ? parseTpexQuotes(tpexQuotes.value) : []),
  ];
}

async function loadDividendMarket(): Promise<Map<string, TwStockDividend>> {
  const [
    twseYield,
    tpexYield,
    upcomingResult,
    twsePolicy,
    tpexPolicy,
    historyResult,
  ] = await Promise.allSettled([
    fetchJson(TWSE_YIELD_URL),
    fetchJson(TPEX_YIELD_URL),
    fetchUpcomingExAnnouncements(),
    fetchJson(TWSE_POLICY_URL),
    fetchJson(TPEX_POLICY_URL),
    fetchStockExHistory(),
  ]);

  const yields = new Map<string, number>();
  if (twseYield.status === "fulfilled") {
    for (const [code, value] of parseYieldRows(
      twseYield.value,
      ["Code", "股票代號"],
      ["DividendYield", "殖利率"],
    )) {
      yields.set(code, value);
    }
  }
  if (tpexYield.status === "fulfilled") {
    for (const [code, value] of parseYieldRows(
      tpexYield.value,
      ["SecuritiesCompanyCode", "股票代號", "Code"],
      ["YieldRatio", "DividendYield", "殖利率", "股利殖利率"],
    )) {
      yields.set(code, value);
    }
  }

  const upcoming =
    upcomingResult.status === "fulfilled" ? upcomingResult.value : [];

  const periodsByCode = new Map<string, string[]>();
  if (twsePolicy.status === "fulfilled") {
    for (const [code, periods] of parsePolicyPeriods(twsePolicy.value)) {
      periodsByCode.set(code, periods);
    }
  }
  if (tpexPolicy.status === "fulfilled") {
    for (const [code, periods] of parsePolicyPeriods(tpexPolicy.value)) {
      const current = periodsByCode.get(code) ?? [];
      periodsByCode.set(code, [...current, ...periods]);
    }
  }

  const historyByCode =
    historyResult.status === "fulfilled"
      ? historyResult.value
      : new Map<string, ExHistorySummary>();

  const merged = mergeDividends(upcoming, yields, periodsByCode, historyByCode);
  const byCode = new Map(merged.map((item) => [item.code, item]));
  memoryByCode = byCode;
  memoryHistoryReady = historyByCode.size > 0;
  return byCode;
}

function sliceDividends(
  byCode: Map<string, TwStockDividend>,
  codes: string[],
): TwStockDividend[] {
  return codes.map((code) => byCode.get(code) ?? emptyDividend(code));
}

export async function fetchDividendSnapshot(
  focusCodes: string[],
): Promise<TwStockDividend[]> {
  const codes = [...new Set(focusCodes.map((code) => code.trim()).filter(Boolean))];
  if (!codes.length) return [];
  if (memoryHistoryReady) return sliceDividends(memoryByCode, codes);
  if (!dividendInflight) {
    const pending = loadDividendMarket().finally(() => {
      if (dividendInflight === pending && !memoryHistoryReady) {
        dividendInflight = null;
      }
    });
    dividendInflight = pending;
  }
  return sliceDividends(await dividendInflight, codes);
}

function misBaseUrl(): string {
  return stockApi("mis", "");
}

function parseMisLiveQuotes(payload: unknown): TwStockLiveQuote[] {
  const root = asRecord(payload);
  const rows = Array.isArray(root?.msgArray) ? root.msgArray : [];
  return rows.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const code = rowText(row, ["c"]);
    if (!code) return [];
    const last = parseTwNumber(rowText(row, ["z"]));
    const prev = parseTwNumber(rowText(row, ["y"]));
    const price = last ?? prev;
    const change = price != null && prev != null ? price - prev : null;
    const date = rowText(row, ["d"]);
    const isoDate = date
      ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
      : null;
    return [
      {
        code,
        price,
        priceText: price == null ? "—" : formatPrice(price),
        change,
        changePercent: changePercent(price, change),
        open: parseTwNumber(rowText(row, ["o"])),
        high: parseTwNumber(rowText(row, ["h"])),
        low: parseTwNumber(rowText(row, ["l"])),
        volume: (() => {
          const lots = parseTwNumber(rowText(row, ["v"]));
          return lots == null ? null : lots * 1000;
        })(),
        tradeDate: isoDate,
      },
    ];
  });
}

export async function fetchLiveQuotes(
  stocks: Array<Pick<FavoriteStock, "code" | "market">>,
): Promise<TwStockLiveQuote[]> {
  if (!stocks.length) return [];
  const chunks: Array<typeof stocks> = [];
  for (let i = 0; i < stocks.length; i += 20) {
    chunks.push(stocks.slice(i, i + 20));
  }
  const results = await Promise.allSettled(
    chunks.map(async (chunk) => {
      const ex = chunk
        .map(
          (stock) =>
            `${stock.market === "tpex" ? "otc" : "tse"}_${stock.code.toLowerCase()}.tw`,
        )
        .join("|");
      const url = `${misBaseUrl()}/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(ex)}&json=1&delay=0`;
      return parseMisLiveQuotes(await fetchJson(url));
    }),
  );
  return results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
}

export function searchTwStocks(
  quotes: TwStockQuote[],
  query: string,
  limit = 12,
): TwStockQuote[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const scored = quotes
    .map((stock) => {
      const code = stock.code.toLowerCase();
      const name = stock.name.toLowerCase();
      let score = 0;
      if (code === needle) score = 400;
      else if (code.startsWith(needle)) score = 300;
      else if (code.includes(needle)) score = 200;
      else if (name.startsWith(needle)) score = 180;
      else if (name.includes(needle)) score = 100;
      if (score > 0 && /^\d{4}$/.test(stock.code)) score += 20;
      return { stock, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.stock.code.localeCompare(b.stock.code));
  const seen = new Set<string>();
  const unique: TwStockQuote[] = [];
  for (const item of scored) {
    if (seen.has(item.stock.code)) continue;
    seen.add(item.stock.code);
    unique.push(item.stock);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function marketLabel(market: TwStockMarket): string {
  return market === "twse" ? "上市" : "上櫃";
}

export function dividendFrequencyLabel(frequency: DividendFrequency): string {
  switch (frequency) {
    case "monthly":
      return "月配息";
    case "quarterly":
      return "季配息";
    case "semiannual":
      return "半年配";
    case "annual":
      return "年配";
    case "none":
      return "無配息";
  }
}

export function formatChange(change: number | null): string {
  if (change == null) return "—";
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}`;
}

export function formatChangePercent(value: number | null): string {
  if (value == null) return "";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatVolume(volume: number | null): string {
  if (volume == null) return "—";
  if (volume >= 100_000_000) return `${(volume / 100_000_000).toFixed(2)} 億股`;
  if (volume >= 10_000) return `${Math.round(volume / 10_000)} 萬股`;
  return `${volume.toLocaleString("zh-TW")} 股`;
}

export function formatCashDividend(item: TwStockDividend | undefined): string {
  if (!item) return "—";
  if (item.cashDividend != null) return `${item.cashDividend.toFixed(2)} 元`;
  if (item.cashDividendText) return item.cashDividendText;
  if (item.lastCashDividend != null) return `${item.lastCashDividend.toFixed(2)} 元`;
  return "—";
}

export function formatStockDividend(item: TwStockDividend | undefined): string {
  if (!item?.stockDividendRatio) return "—";
  return item.stockDividendRatio.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatExDate(item: TwStockDividend | undefined): string {
  if (!item?.exDate) return "";
  return item.exType ? `${item.exDate}（${item.exType}）` : item.exDate;
}

export function hasAnnouncedExDate(
  item: TwStockDividend | null | undefined,
): boolean {
  return Boolean(item?.exDate);
}

export function formatDividendYield(
  item: TwStockDividend | undefined,
  price: number | null | undefined,
): string {
  if (item?.yieldPercent != null) return `${item.yieldPercent.toFixed(2)}%`;
  if (item?.trailingCash && price) {
    return `${((item.trailingCash / price) * 100).toFixed(2)}%`;
  }
  return "—";
}

export function formatHistoryAmount(value: number | null | undefined): string {
  if (value == null || value === 0) return "—";
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatHistoryStock(value: number | null | undefined): string {
  if (value == null || value === 0) return "—";
  return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatFillDays(event: TwStockExEvent | undefined): string {
  if (!event) return "—";
  if (!event.fillChecked) return "計算中…";
  if (!event.fillDate) return event.preClose == null ? "—" : "未回填";
  const start = new Date(`${event.exDate}T00:00:00`);
  const filled = new Date(`${event.fillDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(filled.getTime())) return "—";
  const days = Math.round((filled.getTime() - start.getTime()) / 86_400_000);
  if (days <= 0) return "當天";
  return `${days} 天`;
}

export function isExDateSoon(exDate: string | null, withinDays = 7): boolean {
  if (!exDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${exDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return false;
  const diff = (target.getTime() - today.getTime()) / 86_400_000;
  return diff >= 0 && diff <= withinDays;
}

export function normalizeFavoriteStocks(raw: unknown): FavoriteStock[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const list: FavoriteStock[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) continue;
    const code = String(row.code ?? "").trim();
    const name = String(row.name ?? "").trim();
    const market = row.market === "tpex" ? "tpex" : "twse";
    if (!code || seen.has(code)) continue;
    seen.add(code);
    list.push({
      code,
      name,
      market,
      addedAt: typeof row.addedAt === "string" ? row.addedAt : new Date().toISOString(),
      pinned: row.pinned === true,
    });
  }
  return list;
}
