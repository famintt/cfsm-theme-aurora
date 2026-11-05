<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  changeLocale,
  monitor,
  setAccent,
  setDensity,
  setSparkline,
  setThemeMode
} from '../stores/monitor'
import { locale, t } from '../utils/i18n'
import AppIcon from './AppIcon.vue'

const open = ref(false)
const root = ref(null)

const accents = [
  { value: 'aurora', labelKey: 'accentAurora', colors: ['#4dd7ff', '#8b7cff'] },
  { value: 'emerald', labelKey: 'accentEmerald', colors: ['#34d399', '#22d3ee'] },
  { value: 'sakura', labelKey: 'accentSakura', colors: ['#fb7185', '#e879f9'] },
  { value: 'amber', labelKey: 'accentAmber', colors: ['#fbbf24', '#fb923c'] }
]

const themes = [
  { value: 'dark', labelKey: 'themeDark' },
  { value: 'light', labelKey: 'themeLight' },
  { value: 'auto', labelKey: 'themeAuto' }
]

function onPointerDown(event) {
  if (!open.value) return
  if (root.value && !root.value.contains(event.target)) open.value = false
}

function onKeydown(event) {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="theme-menu">
    <button
      class="icon-btn"
      type="button"
      :aria-expanded="open"
      aria-haspopup="dialog"
      :aria-label="t('theme')"
      @click="open = !open"
    >
      <AppIcon name="palette" :size="18" />
    </button>

    <Transition name="menu">
      <div v-if="open" class="menu-panel glass" role="dialog" :aria-label="t('theme')">
        <div class="menu-head">
          <div>
            <div class="eyebrow">APPEARANCE</div>
            <h3>{{ t('theme') }}</h3>
          </div>
          <button class="menu-close" type="button" :aria-label="t('close')" @click="open = false">
            <AppIcon name="close" :size="15" />
          </button>
        </div>

        <div class="menu-group">
          <div class="segmented">
            <button
              v-for="item in themes"
              :key="item.value"
              type="button"
              :class="{ active: monitor.themeMode === item.value }"
              @click="setThemeMode(item.value)"
            >
              {{ t(item.labelKey) }}
            </button>
          </div>
        </div>

        <div class="menu-group">
          <span class="menu-label">{{ t('accent') }}</span>
          <div class="accent-grid">
            <button
              v-for="item in accents"
              :key="item.value"
              class="accent-option"
              :class="{ active: monitor.accent === item.value }"
              type="button"
              @click="setAccent(item.value)"
            >
              <span class="accent-swatch" :style="{ background: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})` }">
                <AppIcon v-if="monitor.accent === item.value" name="check" :size="11" />
              </span>
              <span>{{ t(item.labelKey) }}</span>
            </button>
          </div>
        </div>

        <div class="menu-row">
          <div class="row-copy">
            <span class="menu-label">{{ t('density') }}</span>
            <small>{{ monitor.density === 'compact' ? t('compact') : t('comfortable') }}</small>
          </div>
          <div class="segmented compact">
            <button
              type="button"
              :class="{ active: monitor.density === 'comfortable' }"
              @click="setDensity('comfortable')"
            >
              {{ t('comfortable') }}
            </button>
            <button
              type="button"
              :class="{ active: monitor.density === 'compact' }"
              @click="setDensity('compact')"
            >
              {{ t('compact') }}
            </button>
          </div>
        </div>

        <div class="menu-row">
          <span class="menu-label">{{ t('miniChart') }}</span>
          <button
            class="switch"
            type="button"
            role="switch"
            :aria-checked="monitor.sparkline"
            :class="{ on: monitor.sparkline }"
            @click="setSparkline(!monitor.sparkline)"
          >
            <span></span>
          </button>
        </div>

        <div class="menu-row">
          <span class="menu-label">{{ t('language') }}</span>
          <div class="segmented compact">
            <button type="button" :class="{ active: locale === 'zh' }" @click="changeLocale('zh')">中文</button>
            <button type="button" :class="{ active: locale === 'en' }" @click="changeLocale('en')">EN</button>
          </div>
        </div>

        <div v-if="monitor.settingsMessage" class="menu-note">
          <AppIcon name="check" :size="13" />
          <span>{{ monitor.settingsMessage }}</span>
        </div>
        <div v-else-if="!monitor.config?.authorization" class="menu-note">
          <AppIcon name="eye" :size="13" />
          <span>{{ t('settingsLocal') }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.theme-menu {
  position: relative;
}

.menu-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 80;
  width: 310px;
  padding: 18px;
  border-color: var(--line-strong);
  background: var(--surface-strong);
  box-shadow: var(--shadow);
}

.menu-panel::before {
  content: "";
  position: absolute;
  top: -5px;
  right: 14px;
  width: 9px;
  height: 9px;
  border-top: 1px solid var(--line-strong);
  border-left: 1px solid var(--line-strong);
  background: var(--surface-strong);
  transform: rotate(45deg);
}

.menu-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.menu-head h3 {
  margin: 3px 0 0;
  font-size: 16px;
  letter-spacing: -0.01em;
}

.menu-close {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--muted);
}

.menu-close:hover {
  color: var(--text);
  border-color: var(--line-strong);
}

.menu-group {
  margin-bottom: 16px;
}

.menu-label {
  display: block;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.segmented {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 3px;
  margin-top: 7px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.05);
}

.segmented button {
  height: 29px;
  padding: 0 8px;
  border-radius: 7px;
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 560;
  white-space: nowrap;
  transition: background 0.18s ease, color 0.18s ease;
}

.segmented button:hover {
  color: var(--text-soft);
}

.segmented button.active {
  background: var(--surface-hover);
  color: var(--text);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.16);
}

.segmented.compact {
  display: inline-grid;
  margin-top: 0;
}

.segmented.compact button {
  height: 26px;
  font-size: 10.5px;
}

.accent-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 7px;
  margin-top: 7px;
}

.accent-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 9px;
  color: var(--muted);
  font-size: 11.5px;
  text-align: left;
  transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
}

.accent-option:hover,
.accent-option.active {
  border-color: var(--line-strong);
  background: rgba(148, 163, 184, 0.05);
  color: var(--text);
}

.accent-swatch {
  display: grid;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 7px;
  color: #fff;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  border-top: 1px solid var(--line);
}

.row-copy small {
  display: block;
  margin-top: 1px;
  color: var(--faint);
  font-size: 10px;
}

.switch {
  position: relative;
  width: 38px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.1);
  transition: background 0.18s ease, border-color 0.18s ease;
}

.switch span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--muted);
  transition: transform 0.18s ease, background 0.18s ease;
}

.switch.on {
  border-color: rgba(var(--accent-rgb), 0.4);
  background: rgba(var(--accent-rgb), 0.18);
}

.switch.on span {
  background: var(--accent);
  transform: translateX(16px);
}

.menu-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  color: var(--faint);
  font-size: 10.5px;
  line-height: 1.5;
}

.menu-note :deep(svg) {
  flex: 0 0 auto;
  margin-top: 1px;
  color: var(--accent);
}

.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
  transform-origin: top right;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-5px) scale(0.98);
}

@media (max-width: 520px) {
  .menu-panel {
    position: fixed;
    top: 74px;
    right: 12px;
    left: 12px;
    width: auto;
  }

  .menu-panel::before {
    display: none;
  }
}
</style>
