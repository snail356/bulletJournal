import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type {
  FavoriteStock,
  TwStockDividend,
  TwStockMarket,
  TwStockQuote,
} from "@/types";
import {
  createDebouncedSaver,
  loadStockCatalog,
  loadStockFavorites,
  saveStockCatalog,
  saveStockFavorites,
} from "@/utils/appData";
import {
  attachFillDates,
  fetchDividendSnapshot,
  fetchDividendHistoryOverlay,
  fetchLiveQuotes,
  fetchMarketQuotes,
  fetchStockDirectory,
  keepFillDates,
  mergeStockCatalog,
  normalizeFavoriteStocks,
  normalizeStockCatalog,
  resetDividendMemory,
  searchTwStocks,
  stockCatalogQuote,
} from "@/utils/twStock";

const PRICE_POLL_MS = 10_000;

export const useStockStore = defineStore("stock", () => {
  const favorites = ref<FavoriteStock[]>([]);
  const quotesByCode = ref<Record<string, TwStockQuote>>({});
  const dividendsByCode = ref<Record<string, TwStockDividend>>({});
  const catalog = ref<TwStockQuote[]>([]);
  const loading = ref(false);
  const refreshing = ref(false);
  const error = ref("");
  const lastUpdatedAt = ref<string | null>(null);
  const fillLoading = ref<Record<string, boolean>>({});
  let pollTimer: number | null = null;
  let liveRefreshing = false;
  let initialized = false;
  let initPromise: Promise<void> | null = null;

  const favoritesSaver = createDebouncedSaver(() =>
    saveStockFavorites(favorites.value),
  );

  const favoriteCards = computed(() => {
    const pinned = favorites.value.filter((stock) => stock.pinned);
    const rest = favorites.value.filter((stock) => !stock.pinned);
    return [...pinned, ...rest].map((stock) => ({
      ...stock,
      quote: quotesByCode.value[stock.code] ?? null,
      dividend: dividendsByCode.value[stock.code] ?? null,
    }));
  });

  function persistFavorites() {
    favoritesSaver.schedule();
  }

  async function init() {
    if (initialized) return;
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const [stored, storedCatalog] = await Promise.all([
        loadStockFavorites(),
        loadStockCatalog(),
      ]);
      favorites.value = normalizeFavoriteStocks(stored ?? []);
      const cached = normalizeStockCatalog(storedCatalog ?? []);
      if (cached.length) {
        catalog.value = cached.map((item) =>
          stockCatalogQuote(item.code, item.name, item.market),
        );
      }
      initialized = true;
      favoritesSaver.enable();
    })();
    return initPromise;
  }

  async function flushFavorites() {
    await favoritesSaver.flush();
  }

  function persistCatalog(stocks: TwStockQuote[]) {
    if (!stocks.length) return;
    void saveStockCatalog(
      stocks.map(({ code, name, market }) => ({ code, name, market })),
    );
  }

  function syncFavoriteMeta(
    byCode: Record<string, { name: string; market: TwStockMarket }>,
  ) {
    let favoritesChanged = false;
    favorites.value = favorites.value.map((stock) => {
      const meta = byCode[stock.code];
      if (!meta) return stock;
      if (meta.name === stock.name && meta.market === stock.market) {
        return stock;
      }
      favoritesChanged = true;
      return { ...stock, name: meta.name, market: meta.market };
    });
    if (favoritesChanged) persistFavorites();
  }

  function applyMarketData(directory: TwStockQuote[], quotes: TwStockQuote[]) {
    const merged = mergeStockCatalog(catalog.value, [...directory, ...quotes]);
    catalog.value = merged;
    if (quotes.length) {
      const nextQuotes = { ...quotesByCode.value };
      for (const quote of quotes) {
        nextQuotes[quote.code] = quote;
      }
      quotesByCode.value = nextQuotes;
    }
    const meta: Record<string, { name: string; market: TwStockMarket }> = {};
    for (const stock of merged) {
      meta[stock.code] = stock;
    }
    syncFavoriteMeta(meta);
    persistCatalog(merged);
  }

  function applyDividends(dividends: TwStockDividend[]) {
    if (!dividends.length) return;
    const nextDividends = { ...dividendsByCode.value };
    for (const item of dividends) {
      nextDividends[item.code] = {
        ...item,
        history: keepFillDates(
          dividendsByCode.value[item.code]?.history,
          item.history ?? [],
        ),
      };
    }
    dividendsByCode.value = nextDividends;
  }

  function applyLiveQuotes(
    live: Awaited<ReturnType<typeof fetchLiveQuotes>>,
  ) {
    if (!live.length) return;
    const next = { ...quotesByCode.value };
    const catalogByCode = new Map(
      catalog.value.map((stock) => [stock.code, stock]),
    );
    for (const item of live) {
      const current = next[item.code];
      if (item.price == null && !current) continue;
      const catalogItem = catalogByCode.get(item.code);
      const favorite = favorites.value.find((stock) => stock.code === item.code);
      const fallback = current ?? catalogItem;
      next[item.code] = {
        code: item.code,
        name: fallback?.name ?? favorite?.name ?? item.code,
        market: fallback?.market ?? favorite?.market ?? "twse",
        price: item.price ?? current?.price ?? null,
        priceText:
          item.price != null
            ? item.priceText
            : (current?.priceText ?? "—"),
        change: item.change ?? current?.change ?? null,
        changePercent: item.changePercent ?? current?.changePercent ?? null,
        open: item.open ?? current?.open ?? null,
        high: item.high ?? current?.high ?? null,
        low: item.low ?? current?.low ?? null,
        volume: item.volume ?? current?.volume ?? null,
        tradeDate: item.tradeDate ?? current?.tradeDate ?? null,
      };
    }
    quotesByCode.value = next;
  }

  async function refresh(options?: { withDividends?: boolean }) {
    await init();
    if (loading.value || refreshing.value) return;
    const hasCatalog = catalog.value.length > 0;
    const hasQuotes = Object.keys(quotesByCode.value).length > 0;
    if (hasCatalog || hasQuotes) refreshing.value = true;
    else loading.value = true;
    error.value = "";
    const withDividends = options?.withDividends === true;
    const favoriteCodes = () => favorites.value.map((stock) => stock.code);
    const dividendPromise = withDividends
      ? fetchDividendSnapshot(favoriteCodes())
      : null;
    const historyPromise = withDividends
      ? fetchDividendHistoryOverlay(favoriteCodes)
      : null;
    try {
      const quotesPromise = fetchMarketQuotes().catch(() => [] as TwStockQuote[]);
      const directoryPromise = fetchStockDirectory().catch(
        () => [] as TwStockQuote[],
      );
      void directoryPromise.then((directory) => {
        if (directory.length) applyMarketData(directory, []);
      });
      const [quotes, directory] = await Promise.all([
        quotesPromise,
        directoryPromise,
      ]);
      applyMarketData(directory, quotes);
      if (!catalog.value.length) {
        throw new Error("目前無法取得台股清單，請稍後再試");
      }
      try {
        const live = await fetchLiveQuotes(favorites.value);
        applyLiveQuotes(live);
      } catch {
        // 盤中即時行情可能受 CORS 限制，靜默退回公開資料行情
      }
      lastUpdatedAt.value = new Date().toISOString();
    } catch (err) {
      error.value =
        err instanceof Error && err.message
          ? err.message
          : "讀取台股資料失敗，請稍後再試";
    } finally {
      loading.value = false;
      refreshing.value = false;
    }
    if (dividendPromise) {
      void dividendPromise.then(applyDividends).catch(() => {
        // 配息來源較慢或失敗時保留已顯示的行情
      });
    }
    if (historyPromise) {
      void historyPromise.then(applyDividends).catch(() => {
        // 歷史除權息較慢，不阻擋清單與配息摘要
      });
    }
  }

  function search(query: string) {
    return searchTwStocks(catalog.value, query).map(
      (stock) => quotesByCode.value[stock.code] ?? stock,
    );
  }

  function isFavorite(code: string) {
    return favorites.value.some((stock) => stock.code === code);
  }

  function addFavorite(stock: Pick<FavoriteStock, "code" | "name" | "market">) {
    if (isFavorite(stock.code)) {
      pinFavorite(stock.code);
      return;
    }
    favorites.value = [
      ...favorites.value,
      {
        code: stock.code,
        name: stock.name,
        market: stock.market,
        addedAt: new Date().toISOString(),
        pinned: false,
      },
    ];
    persistFavorites();
    void refreshLiveForFavorites();
    void enrichFavoriteDividends(stock.code);
  }

  async function ensureFillDates(code: string) {
    const current = dividendsByCode.value[code];
    const favorite = favorites.value.find((stock) => stock.code === code);
    if (!current?.history.length || !favorite) return;
    if (current.history.every((event) => event.fillChecked)) return;
    if (fillLoading.value[code]) return;
    fillLoading.value = { ...fillLoading.value, [code]: true };
    try {
      const history = await attachFillDates(
        code,
        favorite.market,
        current.history,
      );
      const latest = dividendsByCode.value[code];
      if (!latest) return;
      dividendsByCode.value = {
        ...dividendsByCode.value,
        [code]: { ...latest, history },
      };
    } catch {
      dividendsByCode.value = {
        ...dividendsByCode.value,
        [code]: {
          ...current,
          history: current.history.map((event) => ({
            ...event,
            fillChecked: true,
          })),
        },
      };
    } finally {
      fillLoading.value = { ...fillLoading.value, [code]: false };
    }
  }

  async function enrichFavoriteDividends(code: string) {
    const current = dividendsByCode.value[code];
    if (current && (current.frequency !== "none" || current.history.length)) {
      return;
    }
    try {
      const items = await fetchDividendSnapshot([code]);
      const item = items.find((row) => row.code === code);
      if (!item) return;
      dividendsByCode.value = {
        ...dividendsByCode.value,
        [code]: {
          ...item,
          history: keepFillDates(current?.history, item.history),
        },
      };
    } catch {
      // 新加入自選時補配息失敗可等下次整頁更新
    }
  }

  function pinFavorite(code: string) {
    const index = favorites.value.findIndex((stock) => stock.code === code);
    if (index < 0) return;
    const current = favorites.value[index];
    const next = [...favorites.value];
    next.splice(index, 1);
    if (current.pinned) {
      next.push({ ...current, pinned: false });
    } else {
      next.unshift({ ...current, pinned: true });
    }
    favorites.value = next;
    persistFavorites();
  }

  async function refreshLiveForFavorites() {
    if (liveRefreshing || !favorites.value.length) return;
    liveRefreshing = true;
    try {
      const live = await fetchLiveQuotes(favorites.value);
      applyLiveQuotes(live);
      if (live.length) lastUpdatedAt.value = new Date().toISOString();
    } catch {
      // ignore
    } finally {
      liveRefreshing = false;
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(() => {
      void refreshLiveForFavorites();
    }, PRICE_POLL_MS);
  }

  function stopPolling() {
    if (pollTimer != null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function leavePage() {
    stopPolling();
    resetDividendMemory();
  }

  function removeFavorite(code: string) {
    favorites.value = favorites.value.filter((stock) => stock.code !== code);
    persistFavorites();
  }

  function toggleFavorite(stock: Pick<FavoriteStock, "code" | "name" | "market">) {
    if (isFavorite(stock.code)) removeFavorite(stock.code);
    else addFavorite(stock);
  }

  async function mergeFavorites(incoming: FavoriteStock[]) {
    const normalized = normalizeFavoriteStocks(incoming);
    let added = 0;
    let skipped = 0;
    const codes = new Set(favorites.value.map((stock) => stock.code));
    const next = [...favorites.value];
    for (const stock of normalized) {
      if (codes.has(stock.code)) {
        skipped += 1;
        continue;
      }
      next.push(stock);
      codes.add(stock.code);
      added += 1;
    }
    if (added) {
      favorites.value = next;
      persistFavorites();
      await flushFavorites();
    }
    return { added, skipped };
  }

  async function clearAll() {
    favorites.value = [];
    quotesByCode.value = {};
    dividendsByCode.value = {};
    catalog.value = [];
    error.value = "";
    lastUpdatedAt.value = null;
    await favoritesSaver.flush();
    resetDividendMemory({ includeHistory: true });
  }

  return {
    favorites,
    favoriteCards,
    catalog,
    loading,
    refreshing,
    error,
    lastUpdatedAt,
    fillLoading,
    init,
    flushFavorites,
    refresh,
    search,
    isFavorite,
    addFavorite,
    pinFavorite,
    removeFavorite,
    toggleFavorite,
    ensureFillDates,
    startPolling,
    stopPolling,
    leavePage,
    refreshLiveForFavorites,
    mergeFavorites,
    clearAll,
  };
});
