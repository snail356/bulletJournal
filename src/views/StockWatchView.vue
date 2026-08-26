<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import DeleteIconButton from '@/components/DeleteIconButton.vue'
import { useStockStore } from '@/stores/stockStore'
import {
  dividendFrequencyLabel,
  formatCashDividend,
  formatChange,
  formatChangePercent,
  formatDividendYield,
  formatExDate,
  formatStockDividend,
  formatVolume,
  isExDateSoon,
  marketLabel,
} from '@/utils/twStock'

const store = useStockStore()
const keyword = ref('')
const searchOpen = ref(false)
const activeIndex = ref(0)
const searchRoot = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const matches = computed(() => store.search(keyword.value))

watch(matches, (list) => {
  activeIndex.value = list.length ? 0 : -1
})

watch(keyword, (value) => {
  searchOpen.value = value.trim().length > 0
})

const lastUpdatedText = computed(() => {
  if (!store.lastUpdatedAt) return '尚未更新'
  const date = new Date(store.lastUpdatedAt)
  if (Number.isNaN(date.getTime())) return '尚未更新'
  return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
})

function changeClass(change: number | null | undefined) {
  if (change == null || change === 0) return 'flat'
  return change > 0 ? 'up' : 'down'
}

function selectStock(code: string) {
  const stock = matches.value.find((item) => item.code === code)
  if (!stock) return
  store.addFavorite(stock)
  keyword.value = ''
  searchOpen.value = false
  nextTick(() => inputRef.value?.focus())
}

function onSearchKeydown(event: KeyboardEvent) {
  if (!searchOpen.value || !matches.value.length) {
    if (event.key === 'Escape') {
      searchOpen.value = false
      keyword.value = ''
    }
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % matches.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value =
      (activeIndex.value - 1 + matches.value.length) % matches.value.length
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const stock = matches.value[activeIndex.value]
    if (stock) selectStock(stock.code)
  } else if (event.key === 'Escape') {
    searchOpen.value = false
  }
}

function onDocumentClick(event: MouseEvent) {
  if (!searchRoot.value?.contains(event.target as Node)) {
    searchOpen.value = false
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    void store.refresh()
    store.startPolling()
  } else {
    store.stopPolling()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('visibilitychange', onVisibilityChange)
  void store.refresh().then(() => store.startPolling())
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  store.stopPolling()
})
</script>

<template>
  <div class="stock-view">
    <header class="page-header">
      <div>
        <h1>小股力</h1>
        <p class="subtitle">查找台股、加入清單，並追蹤股價、配息與除權息日</p>
      </div>
      <button
        type="button"
        class="refresh-btn"
        :disabled="store.loading || store.refreshing"
        @click="store.refresh()"
      >
        <AppIcon name="rotate-left" />
        {{ store.refreshing || store.loading ? '更新中…' : '重新整理' }}
      </button>
    </header>

    <div class="toolbar">
      <div ref="searchRoot" class="search-wrap">
        <span class="search-icon">
          <AppIcon name="search" />
        </span>
        <input
          ref="inputRef"
          v-model="keyword"
          type="text"
          class="search"
          placeholder="輸入代號或名稱，例如 2330、台積電"
          autocomplete="off"
          @focus="searchOpen = keyword.trim().length > 0"
          @keydown="onSearchKeydown"
        />
        <div v-if="searchOpen" class="search-menu" role="listbox">
          <p v-if="store.loading && !matches.length" class="search-empty">行情載入中…</p>
          <p v-else-if="!matches.length" class="search-empty">找不到符合的台股</p>
          <button
            v-for="(stock, index) in matches"
            :key="stock.code"
            type="button"
            class="search-item"
            :class="{ active: index === activeIndex, favorited: store.isFavorite(stock.code) }"
            role="option"
            @mousedown.prevent="selectStock(stock.code)"
          >
            <span class="code">{{ stock.code }}</span>
            <span class="name">{{ stock.name }}</span>
            <span class="market">{{ marketLabel(stock.market) }}</span>
            <span class="quote" :class="changeClass(stock.change)">
              {{ stock.priceText }}
            </span>
            <span class="fav-hint">
              {{ store.isFavorite(stock.code) ? '已加入' : '加入清單' }}
            </span>
          </button>
        </div>
      </div>
      <span class="meta">
        清單 {{ store.favorites.length }} 檔
        · 更新於 {{ lastUpdatedText }}
      </span>
    </div>

    <p v-if="store.error" class="error">{{ store.error }}</p>

    <div v-if="store.loading && !store.favoriteCards.length" class="empty">
      正在載入台股行情…
    </div>

    <div v-else-if="!store.favoriteCards.length" class="empty">
      輸入代號或名稱加入清單，星號可置頂，垃圾桶可移除
    </div>

    <div v-else class="card-grid">
      <article
        v-for="card in store.favoriteCards"
        :key="card.code"
        class="stock-card"
      >
        <header class="card-head">
          <div>
            <div class="title-row">
              <span class="badge">{{ marketLabel(card.market) }}</span>
              <span
                class="badge freq"
                :class="`freq-${card.dividend?.frequency ?? 'none'}`"
              >
                {{ dividendFrequencyLabel(card.dividend?.frequency ?? 'none') }}
              </span>
            </div>
            <p class="stock-title">
              <span class="code">{{ card.code }}</span>
              <span class="name">{{ card.name }}</span>
            </p>
            <p class="trade-date" v-if="card.quote?.tradeDate">
              行情日 {{ card.quote.tradeDate }}
            </p>
          </div>
          <div class="card-actions">
            <button
              type="button"
              class="star-btn"
              :class="{ pinned: card.pinned }"
              :aria-label="card.pinned ? '取消置頂' : '置頂'"
              @click="store.pinFavorite(card.code)"
            >
              <AppIcon name="star" />
            </button>
            <DeleteIconButton
              title="移出清單"
              :message="`確定將「${card.code} ${card.name}」移出清單？`"
              label="移出清單"
              @confirm="store.removeFavorite(card.code)"
            />
          </div>
        </header>

        <div class="price-row">
          <span class="price" :class="changeClass(card.quote?.change)">
            {{ card.quote?.priceText ?? '—' }}
          </span>
          <span class="change" :class="changeClass(card.quote?.change)">
            {{ formatChange(card.quote?.change ?? null) }}
            {{ formatChangePercent(card.quote?.changePercent ?? null) }}
          </span>
        </div>

        <dl class="ohlc">
          <div>
            <dt>開</dt>
            <dd>{{ card.quote?.open?.toFixed(2) ?? '—' }}</dd>
          </div>
          <div>
            <dt>高</dt>
            <dd>{{ card.quote?.high?.toFixed(2) ?? '—' }}</dd>
          </div>
          <div>
            <dt>低</dt>
            <dd>{{ card.quote?.low?.toFixed(2) ?? '—' }}</dd>
          </div>
          <div>
            <dt>量</dt>
            <dd>{{ formatVolume(card.quote?.volume ?? null) }}</dd>
          </div>
        </dl>

        <dl class="dividend">
          <div>
            <dt>配息</dt>
            <dd>{{ formatCashDividend(card.dividend ?? undefined) }}</dd>
          </div>
          <div>
            <dt>配股</dt>
            <dd>{{ formatStockDividend(card.dividend ?? undefined) }}</dd>
          </div>
          <div>
            <dt>殖利率</dt>
            <dd>{{ formatDividendYield(card.dividend ?? undefined, card.quote?.price) }}</dd>
          </div>
          <div class="ex-date" :class="{ soon: isExDateSoon(card.dividend?.exDate ?? null) }">
            <dt>除權息日</dt>
            <dd>{{ formatExDate(card.dividend ?? undefined) }}</dd>
          </div>
        </dl>
      </article>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.stock-view {
  min-width: 0;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;

  h1 {
    font-size: 24px;
    font-weight: 700;
  }
}

.subtitle {
  color: $text-muted;
  font-size: 13px;
  margin-top: 4px;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text;
  font-weight: 600;
  background: $surface;

  &:hover:not(:disabled) {
    border-color: $primary;
    color: $primary;
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 240px;
}

.search-icon {
  position: absolute;
  top: 50%;
  left: 12px;
  transform: translateY(-50%);
  color: $text-muted;
  pointer-events: none;
}

.search {
  width: 100%;
  padding: 10px 12px 10px 38px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background: $surface;

  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 3px $primary-light;
  }
}

.search-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 320px;
  overflow-y: auto;
  background: $surface;
  border: 1px solid $border;
  border-radius: $radius-sm;
  box-shadow: $shadow-lg;
}

.search-empty {
  padding: 14px 16px;
  color: $text-muted;
  font-size: 13px;
}

.search-item {
  width: 100%;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  text-align: left;

  &:hover,
  &.active {
    background: $bg;
  }

  .code {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .market,
  .fav-hint {
    font-size: 12px;
    color: $text-muted;
  }

  .quote {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  &.favorited .fav-hint {
    color: $primary;
  }
}

.meta {
  font-size: 13px;
  color: $text-muted;
  white-space: nowrap;
}

.error {
  margin-bottom: 16px;
  padding: 10px 12px;
  border-radius: $radius-sm;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 13px;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: $text-muted;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.stock-card {
  background: $surface;
  border-radius: $radius;
  box-shadow: $shadow;
  padding: 16px;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.stock-title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  margin-top: 8px;
  line-height: 1.3;
}

.code {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.name {
  font-size: 18px;
  font-weight: 700;
  color: $text;
}

.badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  background: $primary-light;
  color: $primary;

  &.freq-monthly {
    background: #ccfbf1;
    color: #0f766e;
  }

  &.freq-quarterly {
    background: #dbeafe;
    color: #1d4ed8;
  }

  &.freq-semiannual {
    background: #ede9fe;
    color: #6d28d9;
  }

  &.freq-annual {
    background: #e0f2fe;
    color: #0369a1;
  }

  &.freq-none {
    background: #f3f4f6;
    color: #6b7280;
  }
}

.trade-date {
  margin-top: 4px;
  font-size: 12px;
  color: $text-muted;
}

.card-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.star-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: #9ca3af;

  &:hover {
    color: #6b7280;
    background: $bg;
  }

  &.pinned {
    color: #f59e0b;
    background: #fffbeb;
  }
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}

.price {
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.change {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.up {
  color: #dc2626;
}

.down {
  color: #16a34a;
}

.flat {
  color: $text-muted;
}

.ohlc,
.dividend {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}

.ohlc {
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid $border;
}

dt {
  font-size: 12px;
  color: $text-muted;
}

dd {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.ex-date {
  grid-column: 1 / -1;

  &.soon dd {
    color: $primary;
  }
}

@media (max-width: $breakpoint-xs) {
  .page-header {
    flex-direction: column;
  }

  .search-item {
    grid-template-columns: 56px minmax(0, 1fr) auto;
    grid-template-rows: auto auto;

    .quote,
    .fav-hint {
      display: none;
    }
  }
}
</style>
