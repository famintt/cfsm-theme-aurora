<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { initMonitor, monitor, retryMonitor, stopAllSockets } from '../stores/monitor'
import { locale, t } from '../utils/i18n'
import {
  flagUrl,
  formatBytes,
  formatClock,
  formatSpeed,
  isServerOnline,
  latencyRoutes,
  osLabel,
  regionLabel,
  serverDiskPercent,
  serverRamPercent
} from '../utils/format'
import { useClock } from '../composables/useClock'
import AppIcon from '../components/AppIcon.vue'

const clock = useClock(1000)
const retrying = ref(false)

const sys = computed(() => monitor.sysConfig)
const nodes = computed(() => monitor.servers.slice().sort((a, b) => {
  const statusDiff = Number(isServerOnline(b, monitor.now)) - Number(isServerOnline(a, monitor.now))
  if (statusDiff) return statusDiff
  return String(a.name || '').localeCompare(String(b.name || ''), locale.value === 'en' ? 'en' : 'zh-CN')
}))

const summary = computed(() => {
  if (!monitor.stats.offline) return t('summaryNormal')
  if (!monitor.stats.online) return t('summaryOffline')
  if (monitor.stats.offline === 1) return t('summaryDegradedOne')
  return t('summaryDegraded', { n: monitor.stats.offline })
})

function pingItems(server) {
  const routes = latencyRoutes(server)
  const names = {
    ct: sys.value.custom_ct_name || t('telecom'),
    cu: sys.value.custom_cu_name || t('unicom'),
    cm: sys.value.custom_cm_name || t('mobile')
  }
  return ['ct', 'cm', 'cu'].map((key) => {
    const route = routes.find((item) => item.key === key)
    const state = route?.state || 'off'
    const value = Number(route?.value)
    return {
      key,
      name: names[key],
      state,
      text: state === 'ok' && Number.isFinite(value) ? `${Math.round(value)}ms` : '—'
    }
  })
}

function showPings(server) {
  return Boolean(sys.value.show_three_net_details) && pingItems(server).some((item) => item.state !== 'off')
}

async function retry() {
  retrying.value = true
  await retryMonitor()
  retrying.value = false
}

function printPage() {
  window.print()
}

onMounted(() => {
  initMonitor()
})

onBeforeUnmount(() => {
  stopAllSockets()
})
</script>

<template>
  <div class="epaper-page">
    <div class="paper-sheet">
      <div class="screen-actions">
        <RouterLink to="/" class="paper-link">
          <AppIcon name="arrowLeft" :size="14" />
          {{ t('detailBack') }}
        </RouterLink>
        <button class="paper-link" type="button" @click="printPage">
          <AppIcon name="printer" :size="14" />
          {{ t('save') }}
        </button>
      </div>

      <header class="paper-head">
        <div class="paper-title">
          <div class="paper-kicker">CF-SERVER-MONITOR / E-INK</div>
          <h1>{{ monitor.config?.site_title || t('siteFallback') }}</h1>
          <p>{{ t('epaperTitle') }} · {{ t('epaperHint') }}</p>
        </div>
        <div class="paper-stamp">
          <strong class="mono">{{ formatClock(clock, locale) }}</strong>
          <span>{{ t('generated') }} · {{ formatClock(clock, locale) }}</span>
        </div>
      </header>

      <div class="paper-rule"></div>

      <template v-if="monitor.loading && !monitor.ready">
        <div class="paper-loading">
          <div v-for="n in 6" :key="n" class="paper-skeleton"></div>
        </div>
      </template>

      <template v-else-if="monitor.error && !monitor.ready">
        <div class="paper-message">
          <h2>{{ t('loadFailed') }}</h2>
          <p>{{ monitor.error }}</p>
          <button type="button" :disabled="retrying" @click="retry">{{ t('retry') }}</button>
        </div>
      </template>

      <template v-else>
        <section class="paper-summary" aria-label="summary">
          <div class="summary-main">
            <span class="summary-label">{{ t('status') }}</span>
            <strong>{{ summary }}</strong>
          </div>
          <div class="summary-cell">
            <span>{{ t('totalNodes') }}</span>
            <b class="mono">{{ monitor.stats.total }}</b>
          </div>
          <div class="summary-cell">
            <span>{{ t('onlineNodes') }}</span>
            <b class="mono">{{ monitor.stats.online }}</b>
          </div>
          <div class="summary-cell">
            <span>{{ t('offlineNodes') }}</span>
            <b class="mono">{{ monitor.stats.offline }}</b>
          </div>
          <div class="summary-cell">
            <span>{{ t('lastUpdate') }}</span>
            <b class="mono">{{ formatClock(new Date(monitor.lastUpdate || Date.now()), locale) }}</b>
          </div>
        </section>

        <div class="paper-rule"></div>

        <div v-if="nodes.length" class="paper-grid">
          <article
            v-for="server in nodes"
            :key="server.id"
            class="paper-node"
            :class="{ 'is-offline': !isServerOnline(server, monitor.now) }"
          >
            <header class="node-head">
              <span class="node-flag">
                <img v-if="flagUrl(server.region)" :src="flagUrl(server.region)" :alt="server.region" />
              </span>
              <div class="node-title">
                <strong>{{ server.name || server.id }}</strong>
                <span>
                  {{ regionLabel(server.region, locale) }}
                  <template v-if="server.server_group"> · {{ server.server_group }}</template>
                  <template v-if="server.os"> · {{ osLabel(server.os) }}</template>
                </span>
              </div>
              <span class="node-status">
                {{ isServerOnline(server, monitor.now) ? t('online') : t('offline') }}
              </span>
            </header>

            <div class="node-bars">
              <div class="node-bar">
                <span>CPU <b class="mono">{{ (Number(server.cpu) || 0).toFixed(1) }}%</b></span>
                <i><em :style="{ width: `${Math.min(100, Number(server.cpu) || 0)}%` }"></em></i>
              </div>
              <div class="node-bar">
                <span>{{ t('memory') }} <b class="mono">{{ serverRamPercent(server).toFixed(0) }}%</b></span>
                <i><em :style="{ width: `${serverRamPercent(server)}%` }"></em></i>
              </div>
              <div class="node-bar">
                <span>{{ t('disk') }} <b class="mono">{{ serverDiskPercent(server).toFixed(0) }}%</b></span>
                <i><em :style="{ width: `${serverDiskPercent(server)}%` }"></em></i>
              </div>
            </div>

            <div class="node-net">
              <span>↓ <b class="mono">{{ formatSpeed(server.net_in_speed) }}</b></span>
              <span>↑ <b class="mono">{{ formatSpeed(server.net_out_speed) }}</b></span>
              <span v-if="sys.show_tf" class="net-total">累计 <b class="mono">{{ formatBytes(server.net_rx) }} / {{ formatBytes(server.net_tx) }}</b></span>
            </div>

            <div v-if="showPings(server)" class="node-ping">
              <span
                v-for="item in pingItems(server)"
                :key="item.key"
                class="ping-chip"
                :class="{ 'is-empty': item.state !== 'ok' }"
              >
                {{ item.name }} <b class="mono">{{ item.text }}</b>
              </span>
            </div>
          </article>
        </div>

        <div v-else class="paper-message">
          <h2>{{ t('noNodes') }}</h2>
          <p>{{ t('noNodesHint') }}</p>
        </div>

        <footer class="paper-foot">
          <span>{{ t('poweredBy') }}</span>
          <span class="mono">{{ monitor.version ? `v${monitor.version}` : '' }} · {{ formatClock(clock, locale) }}</span>
        </footer>
      </template>
    </div>
  </div>
</template>

<style scoped>
.epaper-page {
  min-height: 100vh;
  background: #e9e6dc;
  color: #111;
  font-family: "Segoe UI", Arial, sans-serif;
  padding: 26px 18px;
}

.paper-sheet {
  max-width: 1240px;
  margin: 0 auto;
  padding: 30px 34px 24px;
  border: 1px solid #111;
  background: #f6f3e9;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.08);
}

.screen-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.paper-link {
  display: inline-flex;
  height: 28px;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border: 1px solid #111;
  background: transparent;
  color: #111;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.paper-link:hover {
  background: #111;
  color: #f6f3e9;
}

.paper-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.paper-kicker {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.paper-title h1 {
  margin: 7px 0 4px;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 42px;
  font-weight: 400;
  letter-spacing: -0.045em;
  line-height: 1;
}

.paper-title p {
  margin: 0;
  color: #4d4a43;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.paper-stamp {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  text-align: right;
}

.paper-stamp strong {
  font-size: 26px;
  font-weight: 400;
  letter-spacing: -0.04em;
}

.paper-stamp span {
  color: #5c584f;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.paper-rule {
  height: 1px;
  margin: 20px 0;
  background: #111;
}

.paper-summary {
  display: grid;
  grid-template-columns: minmax(220px, 1.4fr) repeat(4, minmax(90px, 0.6fr));
  gap: 0;
  border: 1px solid #111;
}

.summary-main {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 15px 16px;
  background: #111;
  color: #f6f3e9;
}

.summary-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.72;
}

.summary-main strong {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.summary-cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 15px 16px;
  border-left: 1px solid #111;
}

.summary-cell span {
  color: #615d54;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.summary-cell b {
  font-size: 21px;
  font-weight: 500;
  letter-spacing: -0.04em;
}

.paper-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(255px, 1fr));
  gap: 14px;
}

.paper-node {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 11px;
  padding: 13px;
  border: 1px solid #111;
  break-inside: avoid;
  background: transparent;
}

.paper-node.is-offline {
  background-image: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 7px,
    rgba(17, 17, 17, 0.045) 7px,
    rgba(17, 17, 17, 0.045) 8px
  );
}

.node-head {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}

.node-flag {
  display: block;
  width: 25px;
  height: 17px;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid #111;
}

.node-flag img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1) contrast(1.15);
}

.node-title {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.node-title strong {
  overflow: hidden;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-title span {
  overflow: hidden;
  color: #5d594f;
  font-family: var(--font-mono);
  font-size: 9.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-status {
  flex: 0 0 auto;
  padding: 1px 5px;
  border: 1px solid #111;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.paper-node.is-offline .node-status {
  border-style: dashed;
  color: #5d594f;
}

.node-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.node-bar {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.node-bar > span {
  display: flex;
  justify-content: space-between;
  color: #4f4b43;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.node-bar b {
  color: #111;
  font-weight: 600;
}

.node-bar > i {
  display: block;
  height: 4px;
  overflow: hidden;
  border: 1px solid #111;
}

.node-bar em {
  display: block;
  height: 100%;
  background: #111;
}

.paper-node.is-offline .node-bar em {
  background: #77736a;
}

.node-net {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 7px;
  border-top: 1px solid #111;
  color: #4f4b43;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.node-net span {
  display: inline-flex;
  min-width: 0;
  align-items: baseline;
  gap: 3px;
}

.node-net b {
  color: #111;
  font-weight: 600;
}

.node-net .net-total {
  overflow: hidden;
  text-overflow: ellipsis;
  color: #6b675e;
}

.node-ping {
  display: flex;
  align-items: stretch;
  gap: 6px;
}

.ping-chip {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 3px 4px;
  border: 1px solid #111;
  color: #4f4b43;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.ping-chip b {
  color: #111;
  font-weight: 700;
}

.ping-chip.is-empty {
  background: #111;
  color: #f6f3e9;
}

.ping-chip.is-empty b {
  color: #f6f3e9;
}

.paper-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 24px;
  padding-top: 10px;
  border-top: 1px solid #111;
  color: #555149;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.paper-message {
  padding: 46px 18px;
  border: 1px solid #111;
  text-align: center;
}

.paper-message h2 {
  margin: 0 0 6px;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 25px;
  font-weight: 400;
}

.paper-message p {
  margin: 0 0 14px;
  color: #555149;
  font-size: 13px;
}

.paper-message button {
  padding: 5px 12px;
  border: 1px solid #111;
  background: transparent;
  color: #111;
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  cursor: pointer;
}

.paper-message button:hover {
  background: #111;
  color: #f6f3e9;
}

.paper-loading {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(255px, 1fr));
  gap: 14px;
}

.paper-skeleton {
  height: 170px;
  border: 1px solid #b8b3a8;
  background-image: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 20px,
    rgba(17, 17, 17, 0.06) 20px,
    rgba(17, 17, 17, 0.06) 21px
  );
  animation: paper-pulse 1.8s ease-in-out infinite;
}

@keyframes paper-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 900px) {
  .paper-sheet {
    padding: 22px 20px 18px;
  }

  .paper-summary {
    grid-template-columns: 1fr 1fr;
  }

  .summary-main {
    grid-column: 1 / -1;
  }

  .summary-cell:nth-child(2) {
    border-left: 0;
  }

  .summary-cell:nth-child(3),
  .summary-cell:nth-child(5) {
    border-left: 1px solid #111;
  }

  .summary-cell:nth-child(3) {
    border-top: 1px solid #111;
  }

  .summary-cell:nth-child(5) {
    border-top: 1px solid #111;
  }
}

@media (max-width: 600px) {
  .epaper-page {
    padding: 10px;
  }

  .paper-sheet {
    padding: 16px 13px 14px;
  }

  .paper-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .paper-title h1 {
    font-size: 31px;
  }

  .paper-stamp {
    align-items: flex-start;
    text-align: left;
  }

  .paper-grid {
    grid-template-columns: 1fr;
  }

  .paper-summary {
    grid-template-columns: 1fr 1fr;
  }
}

@media print {
  :global(body) {
    background: #fff !important;
  }

  :global(.app-background) {
    display: none !important;
  }

  .epaper-page {
    min-height: auto;
    padding: 0;
    background: #fff;
  }

  .paper-sheet {
    max-width: none;
    padding: 0;
    border: 0;
    box-shadow: none;
    background: #fff;
  }

  .screen-actions {
    display: none;
  }

  .paper-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .paper-node {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .paper-skeleton {
    display: none;
  }

  @page {
    margin: 9mm;
  }
}
</style>
