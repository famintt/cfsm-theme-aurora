<script setup>
import { monitor } from '../stores/monitor'
import { locale, t } from '../utils/i18n'
import { timeAgo } from '../utils/format'
import AppIcon from './AppIcon.vue'
</script>

<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <span class="brand-dot"></span>
        <strong>{{ monitor.config?.site_title || t('siteFallback') }}</strong>
        <span v-if="monitor.version" class="footer-version mono">v{{ monitor.version }}</span>
      </div>

      <div class="footer-meta">
        <span v-if="monitor.lastUpdate" class="footer-item">
          <AppIcon name="clock" :size="12" />
          {{ t('lastUpdate') }} {{ timeAgo(monitor.lastUpdate, locale, monitor.now) }}
        </span>
        <a
          class="footer-item footer-link"
          href="https://github.com/huilang-me/CF-Server-Monitor"
          target="_blank"
          rel="noreferrer"
        >
          {{ t('poweredBy') }}
          <AppIcon name="external" :size="11" />
        </a>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  margin-top: 24px;
  padding: 20px 0 28px;
  border-top: 1px solid var(--line);
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  color: var(--faint);
  font-size: 11px;
}

.footer-brand,
.footer-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.footer-brand strong {
  overflow: hidden;
  max-width: 240px;
  color: var(--muted);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text);
}

.footer-sep {
  color: var(--line-strong);
}

.footer-version {
  padding: 1px 6px;
  border: 1px solid var(--line);
  border-radius: 5px;
  font-size: 9px;
}

.footer-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.footer-link {
  transition: color 0.18s ease;
}

.footer-link:hover {
  color: var(--text-soft);
}

@media (max-width: 700px) {
  .footer-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .footer-meta {
    flex-wrap: wrap;
  }
}
</style>
