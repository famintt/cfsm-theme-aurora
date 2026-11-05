<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { monitor, toggleTheme } from '../stores/monitor'
import { adminUrl } from '../utils/config'
import { t } from '../utils/i18n'
import AppIcon from './AppIcon.vue'
import ThemeMenu from './ThemeMenu.vue'

const adminHref = adminUrl()

const title = computed(() => monitor.config?.site_title || t('siteFallback'))
const authed = computed(() => monitor.config?.authorization === true || monitor.config?.authorization === 'true')
const adminLabel = computed(() => (authed.value ? t('adminPanel') : t('login')))
</script>

<template>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand" :title="title">{{ title }}</RouterLink>

      <nav class="header-nav" aria-label="Primary">
        <RouterLink to="/epaper" class="header-link">
          <AppIcon name="printer" :size="16" />
          <span class="link-label">{{ t('epaper') }}</span>
        </RouterLink>

        <a class="header-link" :href="adminHref">
          <AppIcon name="admin" :size="16" />
          <span class="link-label">{{ adminLabel }}</span>
        </a>

        <ThemeMenu />

        <button
          class="theme-toggle"
          type="button"
          :aria-label="monitor.theme === 'dark' ? t('themeLight') : t('themeDark')"
          :title="monitor.theme === 'dark' ? t('themeLight') : t('themeDark')"
          @click="toggleTheme"
        >
          <AppIcon :name="monitor.theme === 'dark' ? 'sun' : 'moon'" :size="17" />
        </button>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.header-inner {
  display: flex;
  height: var(--header-h);
  align-items: center;
  gap: 10px;
}

.brand {
  overflow: hidden;
  max-width: min(52vw, 360px);
  color: var(--text);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

.header-link {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--text);
  font-size: 14px;
  font-weight: 400;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}

.header-link:hover {
  background: var(--surface-hover);
}

.header-link.router-link-active {
  background: var(--surface-hover);
}

.theme-toggle {
  display: inline-grid;
  width: 34px;
  height: 34px;
  margin-left: 4px;
  place-items: center;
  border-radius: 8px;
  background: var(--surface-hover);
  color: var(--text);
  transition: background 0.15s ease, color 0.15s ease;
}

.theme-toggle:hover {
  background: var(--line);
  color: var(--text);
}

@media (max-width: 640px) {
  .brand {
    max-width: 40vw;
    font-size: 15px;
  }

  .header-link {
    padding: 0 8px;
    font-size: 13px;
  }
}

@media (max-width: 460px) {
  .header-link:first-child .link-label {
    display: none;
  }
}
</style>
