<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import MiniCalendar from "./MiniCalendar.vue";
import SidebarCarousel from "./SidebarCarousel.vue";
import TodayProgress from "./TodayProgress.vue";
import AppIcon from "./AppIcon.vue";
import { useTaskStore } from "@/stores/taskStore";
import { todayString } from "@/utils/date";

const route = useRoute();
const store = useTaskStore();
const menuOpen = ref(false);

const navItems = computed(() =>
  store.orderedNavFeatures.filter(
    (item) =>
      item.showInSidebar !== false && store.isNavFeatureEnabled(item.id),
  ),
);

const progress = computed(() => store.todayProgress);

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + "/");
}

function closeMenu() {
  menuOpen.value = false;
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function onNavClick(path: string) {
  closeMenu();
  if (path === "/today") {
    store.setSelectedDate(todayString());
  }
}

function openMigrationReview() {
  closeMenu();
  store.openMigrationReview();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") closeMenu();
}

watch(
  () => route.fullPath,
  () => closeMenu(),
);

watch(menuOpen, (open) => {
  document.body.classList.toggle("nav-menu-open", open);
});

watch(
  () => store.selectedDate,
  () => {
    if (window.innerWidth <= 768) closeMenu();
  },
);

onMounted(() => {
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", onResize);
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", onResize);
  document.body.classList.remove("nav-menu-open");
});

function onResize() {
  if (window.innerWidth > 768) closeMenu();
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-head">
      <div class="brand-row">
        <button
          type="button"
          class="menu-toggle"
          :aria-expanded="menuOpen"
          aria-controls="app-sidebar-nav"
          :aria-label="menuOpen ? '關閉選單' : '開啟選單'"
          @click="toggleMenu"
        >
          <AppIcon :name="menuOpen ? 'xmark' : 'bars'" />
        </button>
        <div class="brand">
          <span class="brand-icon">
            <AppIcon name="book" size="lg" />
          </span>
          <div>
            <h1>Bullet Journal</h1>
            <p>工作狀態紀錄</p>
          </div>
        </div>
      </div>

      <nav
        id="app-sidebar-nav"
        class="nav"
        :class="{ open: menuOpen }"
      >
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
          @click="onNavClick(item.path)"
        >
          <span class="nav-icon">
            <AppIcon :name="item.icon" />
          </span>
          {{ item.label }}
        </RouterLink>
        <button
          v-if="store.overdueTaskCount > 0"
          type="button"
          class="nav-item migration-btn"
          @click="openMigrationReview"
        >
          <span class="nav-icon">
            <AppIcon name="arrow-right" />
          </span>
          處理延期任務
          <span class="badge">{{ store.overdueTaskCount }}</span>
        </button>
        <div class="menu-calendar">
          <MiniCalendar />
        </div>
      </nav>
    </div>

    <div class="sidebar-widgets">
      <SidebarCarousel v-if="store.sidebarCarousel.enabled" />
      <MiniCalendar />
      <TodayProgress
        v-if="false"
        :completed="progress.completed"
        :total="progress.total"
        :percentage="progress.percentage"
      />
    </div>
  </aside>

  <Teleport to="body">
    <div
      v-if="menuOpen"
      class="nav-backdrop"
      @click="closeMenu"
    />
  </Teleport>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.sidebar {
  width: $sidebar-width;
  min-width: $sidebar-width;
  height: 100vh;
  background: $surface;
  border-right: 1px solid $border;
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  position: sticky;
  top: 0;
  overflow-y: auto;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.menu-toggle {
  display: none;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  color: $text;
  align-items: center;
  justify-content: center;

  &:hover {
    background: $primary-light;
    color: $primary;
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
  padding: 0 8px;

  h1 {
    font-size: 16px;
    font-weight: 700;
    color: $primary;
  }

  p {
    font-size: 11px;
    color: $text-muted;
  }
}

.brand-icon {
  color: $primary;
  display: flex;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: $radius-sm;
  color: $text-muted;
  font-weight: 500;
  transition: all 0.15s;

  &:hover {
    background: $primary-light;
    color: $primary;
  }

  &.active {
    background: $primary-light;
    color: $primary;
    font-weight: 600;
  }
}

.migration-btn {
  width: 100%;
  text-align: left;
  border: 1px dashed rgba($primary, 0.35);
  margin-top: 4px;

  &:hover {
    border-color: $primary;
  }
}

.badge {
  margin-left: auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: $primary;
  color: white;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon {
  width: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-calendar {
  display: none;
}

.sidebar-widgets {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 20px;
  flex-shrink: 0;
}

@media (max-width: $breakpoint-md) {
  .sidebar {
    display: contents;
  }

  .sidebar-head {
    order: 1;
    position: sticky;
    top: 0;
    z-index: 1210;
    width: 100%;
    padding: 10px 12px;
    background: $surface;
    border-bottom: 1px solid $border;
  }

  .menu-toggle {
    display: flex;
  }

  .brand {
    margin-bottom: 0;
    padding: 0;
    min-width: 0;

    p {
      display: none;
    }
  }

  .nav {
    position: fixed;
    z-index: 1200;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(280px, 86vw);
    margin: 0;
    padding: 64px 12px 24px;
    background: $surface;
    border-right: 1px solid $border;
    box-shadow: $shadow-lg;
    flex-direction: column;
    flex-wrap: nowrap;
    gap: 4px;
    overflow-y: auto;
    transform: translateX(-100%);
    visibility: hidden;
    pointer-events: none;
    transition:
      transform 0.2s ease,
      visibility 0.2s;

    &.open {
      transform: translateX(0);
      visibility: visible;
      pointer-events: auto;
    }
  }

  .nav-item {
    flex: none;
    width: 100%;
    min-width: 0;
    padding: 10px 12px;
    font-size: 14px;
    white-space: nowrap;
    justify-content: flex-start;
  }

  .migration-btn {
    flex: none;
    margin-top: 8px;
  }

  .menu-calendar {
    display: block;
    margin-top: auto;
    padding-top: 16px;
  }

  .sidebar-widgets {
    display: none;
  }
}

@media (max-width: $breakpoint-xs) {
  .sidebar-head {
    padding: 8px 10px;
  }
}
</style>

<style lang="scss">
@use "@/styles/variables" as *;

.nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1190;
  background: rgba(17, 24, 39, 0.4);
}

body.nav-menu-open {
  overflow: hidden;
}
</style>
