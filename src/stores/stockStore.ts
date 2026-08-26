import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type {
  FavoriteStock,
  TwStockDividend,
  TwStockQuote,
} from "@/types";
import {
  loadFromStorage,
  saveToStorage,
  STOCK_FAVORITES_KEY,
} from "@/utils/storage";
import {
  fetchLiveQuotes,
  fetchStockExHistory,
  fetchTwStockSnapshot,
  normalizeFavoriteStocks,
  overlayDividendHistory,
  searchTwStocks,
} from "@/utils/twStock";

const REFRESH_MS = 60_000;

export const useStockStore = defineStore("stock", () => {
  const favorites = ref<FavoriteStock[]>(
    normalizeFavoriteStocks(loadFromStorage(STOCK_FAVORITES_KEY, [])),
  );
  const quotesByCode = ref<Record<string, TwStockQuote>>({});
  const dividendsByCode = ref<Record<string, TwStockDividend>>({});
  const catalog = ref<TwStockQuote[]>([]);
  const loading = ref(false);
  const refreshing = ref(false);
  const error = ref("");
  const lastUpdatedAt = ref<string | null>(null);
  let pollTimer: number | null = null;

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
    saveToStorage(STOCK_FAVORITES_KEY, favorites.value);
  }

  function applySnapshot(quotes: TwStockQuote[], dividends: TwStockDividend[]) {
    const nextQuotes: Record<string, TwStockQuote> = {};
    for (const quote of quotes) {
      nextQuotes[quote.code] = quote;
    }
    quotesByCode.value = nextQuotes;
    catalog.value = quotes;

    const nextDividends: Record<string, TwStockDividend> = {};
    for (const item of dividends) {
      nextDividends[item.code] = item;
    }
    dividendsByCode.value = nextDividends;

    let favoritesChanged = false;
    favorites.value = favorites.value.map((stock) => {
      const quote = nextQuotes[stock.code];
      if (!quote) return stock;
      if (
        quote.name === stock.name &&
        quote.market === stock.market
      ) {
        return stock;
      }
      favoritesChanged = true;
      return { ...stock, name: quote.name, market: quote.market };
    });
    if (favoritesChanged) persistFavorites();
  }

  function applyLiveQuotes(
    live: Awaited<ReturnType<typeof fetchLiveQuotes>>,
  ) {
    if (!live.length) return;
    const next = { ...quotesByCode.value };
    for (const item of live) {
      const current = next[item.code];
      if (!current || item.price == null) continue;
      next[item.code] = {
        ...current,
        price: item.price,
        priceText: item.priceText,
        change: item.change,
        changePercent: item.changePercent,
        open: item.open ?? current.open,
        high: item.high ?? current.high,
        low: item.low ?? current.low,
        volume: item.volume ?? current.volume,
        tradeDate: item.tradeDate ?? current.tradeDate,
      };
    }
    quotesByCode.value = next;
  }

  async function refresh() {
    if (loading.value || refreshing.value) return;
    const hasData = Object.keys(quotesByCode.value).length > 0;
    if (hasData) refreshing.value = true;
    else loading.value = true;
    error.value = "";
    try {
      const snapshot = await fetchTwStockSnapshot();
      applySnapshot(snapshot.quotes, snapshot.dividends);
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
  }

  function search(query: string) {
    return searchTwStocks(catalog.value, query);
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

  async function enrichFavoriteDividends(code: string) {
    const current = dividendsByCode.value[code];
    if (current && current.frequency !== "none") return;
    try {
      const history = await fetchStockExHistory();
      dividendsByCode.value = overlayDividendHistory(
        dividendsByCode.value,
        history,
      );
    } catch {
      // 除權息歷史查無資料時維持現況，不擋行情
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
    try {
      const live = await fetchLiveQuotes(favorites.value);
      applyLiveQuotes(live);
    } catch {
      // ignore
    }
  }

  function removeFavorite(code: string) {
    favorites.value = favorites.value.filter((stock) => stock.code !== code);
    persistFavorites();
  }

  function toggleFavorite(stock: Pick<FavoriteStock, "code" | "name" | "market">) {
    if (isFavorite(stock.code)) removeFavorite(stock.code);
    else addFavorite(stock);
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(() => {
      void refresh();
    }, REFRESH_MS);
  }

  function stopPolling() {
    if (pollTimer != null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function clearAll() {
    favorites.value = [];
    quotesByCode.value = {};
    dividendsByCode.value = {};
    catalog.value = [];
    error.value = "";
    lastUpdatedAt.value = null;
    persistFavorites();
  }

  return {
    favorites,
    favoriteCards,
    catalog,
    loading,
    refreshing,
    error,
    lastUpdatedAt,
    refresh,
    search,
    isFavorite,
    addFavorite,
    pinFavorite,
    removeFavorite,
    toggleFavorite,
    startPolling,
    stopPolling,
    clearAll,
  };
});
