<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  fetchHistory,
  fetchServer,
  initMonitor,
  monitor,
  registerVisibilityHandler,
  startServerSocket,
  stopAllSockets
} from '../stores/monitor'
import { locale, t } from '../utils/i18n'
import {
  axisTimeLabel,
  billingInfo,
  clampPercent,
  expireInfo,
  flagUrl,
  formatBytes,
  formatDate,
  formatDateTime,
  formatNumber,
  formatSpeed,
  isServerOnline,
  latencyRoutes,
  latencyState,
  monthTraffic,
  normalizeTimestamp,
  osIconUrl,
  osLabel,
  parseGpuInfo,
  priceInfo,
  regionLabel,
  serverDiskPercent,
  serverRamPercent,
  serverSwapPercent,
  serverTimestamp,
  tagsOf,
  trafficLimitBytes,
  trafficPercent as trafficUsagePercent,
  uptimeText
} from '../utils/format'
import AppHeader from '../components/AppHeader.vue'
import AppIcon from '../components/AppIcon.vue'
import MetricRing from '../components/MetricRing.vue'
import LineChart from '../components/LineChart.vue'
import FooterBar from '../components/FooterBar.vue'

const route = useRoute()
const server = ref(null)
const base = ref('')
const loading = ref(true)
const error = ref('')
const history = ref([])
const historyLoading = ref(false)
const historyError = ref('')
const range = ref(1)
let historyToken = 0
let unregisterVisibility = null

const ranges = [
  { hours: 0.167, key: 'range10m' },
  { hours: 0.5, key: 'range30m' },
  { hours: 1, key: 'range1h' },
  { hours: 6, key: 'range6h' },
  { hours: 12, key: 'range12h' },
  { hours: 24, key: 'range24h' }
]

const serverId = computed(() => String(route.params.id || ''))
const sys = computed(() => monitor.sysConfig)

const chartPalette = computed(() => (monitor.theme === 'dark'
  ? { strong: '#f5f5f5', mid: '#b5b5b5', soft: '#8a8a8a', faint: '#5f5f5f' }
  : { strong: '#1c1c1c', mid: '#6b6b6b', soft: '#a3a3a3', faint: '#c9c9c9' }))

const routeShades = { ct: 'strong', cu: 'mid', cm: 'soft', bd: 'faint' }

function routeColor(key) {
  return chartPalette.value[routeShades[key] || 'mid']
}
const online = computed(() => (server.value ? isServerOnline(server.value, monitor.now) : false))
const region = computed(() => (server.value ? regionLabel(server.value.region, locale.value) : ''))
const tags = computed(() => tagsOf(server.value))
const ramPercent = computed(() => serverRamPercent(server.value || {}))
const diskPercent = computed(() => serverDiskPercent(server.value || {}))
const swapPercent = computed(() => serverSwapPercent(server.value || {}))
const trafficUsed = computed(() => monthTraffic(server.value || {}))
const trafficLimit = computed(() => trafficLimitBytes(server.value || {}))
const trafficPercent = computed(() => trafficUsagePercent(server.value || {}))
const price = computed(() => priceInfo(server.value || {}))
const expiration = computed(() => expireInfo(server.value?.expire_date, locale.value, monitor.now))
const billing = computed(() => billingInfo(server.value?.billing_cycle, locale.value))
// `ping_bd` is a placeholder (1ms) on installs that do not run a BGP probe, so
// only show it when it carries a real measurement.
const routes = computed(() => {
  if (!server.value) return []
  return latencyRoutes(server.value).filter(
    (route) => route.key !== 'bd' || (route.state === 'ok' && Number(route.value) > 1)
  )
})
const autoRenewal = computed(() => {
  const value = server.value?.auto_renewal
  if (value === undefined || value === null) return ''
  return value ? t('yes') : t('no')
})
const lastReport = computed(() => (serverTimestamp(server.value)
  ? formatDateTime(serverTimestamp(server.value), locale.value)
  : '-'))

const wsLabel = computed(() => {
  if (monitor.wsStatus === 'online') return t('live')
  if (monitor.wsStatus === 'reconnecting' || monitor.wsStatus === 'connecting') return t('reconnecting')
  if (monitor.wsStatus === 'paused') return t('paused')
  if (monitor.wsStatus === 'timeout') return t('timeout')
  return t('wsOffline')
})

const wsTone = computed(() => (monitor.wsStatus === 'online' ? 'good' : monitor.wsStatus === 'reconnecting' || monitor.wsStatus === 'connecting' ? 'warn' : 'bad'))

const gpuText = computed(() => {
  const raw = server.value?.gpu_info
  if (!raw) return ''
  const list = parseGpuInfo(raw)
  if (list.length) {
    return list
      .map((item) => (typeof item === 'string' ? item : item.name || item.model || item.type || ''))
      .filter(Boolean)
      .join(', ')
  }
  if (typeof raw === 'string' && raw.trim() && raw.trim() !== '[]') return raw.trim()
  return ''
})

const infoRows = computed(() => {
  if (!server.value) return []
  const rows = []
  if (server.value.os) rows.push({ label: t('os'), value: osLabel(server.value.os) })
  if (server.value.arch) rows.push({ label: t('arch'), value: server.value.arch })
  if (server.value.kernel) rows.push({ label: t('kernel'), value: server.value.kernel })
  if (server.value.cpu_info) rows.push({ label: t('cpuModel'), value: server.value.cpu_info })
  if (server.value.cpu_cores) rows.push({ label: t('cpuCores'), value: `${server.value.cpu_cores} ${t('core')}` })
  if (server.value.virtualization) rows.push({ label: t('virtualization'), value: server.value.virtualization })
  if (gpuText.value) rows.push({ label: t('gpu'), value: gpuText.value })
  if (server.value.uptime) rows.push({ label: t('uptime'), value: uptimeText(server.value.uptime) })
  return rows
})

const liveStats = computed(() => {
  if (!server.value) return []
  return [
    { label: t('load'), value: (Number(server.value.load_1) || 0).toFixed(2) },
    { label: t('processes'), value: formatNumber(server.value.process_count ?? server.value.processes ?? 0) },
    { label: t('tcp'), value: formatNumber(server.value.tcp_conn_count ?? server.value.tcp_conn ?? 0) },
    { label: t('udp'), value: formatNumber(server.value.udp_conn_count ?? server.value.udp_conn ?? 0) }
  ]
})

function historyNumber(row, key) {
  const raw = row?.[key]
  if (raw === null || raw === undefined || raw === '') return null
  const number = Number(raw)
  return Number.isFinite(number) ? number : null
}

function historyPercent(row, percentKey, usedKey, totalKey) {
  const direct = historyNumber(row, percentKey)
  if (direct !== null) return clampPercent(direct)
  const used = historyNumber(row, usedKey)
  const total = historyNumber(row, totalKey)
  if (used === null || !total) return null
  return clampPercent((used / total) * 100)
}

function pointsOf(rows, valueGetter) {
  return rows.map((row) => ({
    x: row.timestamp,
    y: valueGetter(row)
  }))
}

const usageSeries = computed(() => {
  const rows = history.value
  return [
    {
      name: t('cpu'),
      color: chartPalette.value.strong,
      points: pointsOf(rows, (row) => {
        const value = historyNumber(row, 'cpu')
        return value === null ? null : clampPercent(value)
      })
    },
    {
      name: t('memory'),
      color: chartPalette.value.mid,
      points: pointsOf(rows, (row) => historyPercent(row, 'ram_percent', 'ram_used', 'ram_total'))
    },
    {
      name: t('disk'),
      color: chartPalette.value.soft,
      points: pointsOf(rows, (row) => historyPercent(row, 'disk_percent', 'disk_used', 'disk_total'))
    }
  ]
})

const networkSeries = computed(() => {
  const rows = history.value
  return [
    { name: t('download'), color: chartPalette.value.strong, points: pointsOf(rows, (row) => historyNumber(row, 'net_in_speed')) },
    { name: t('upload'), color: chartPalette.value.mid, points: pointsOf(rows, (row) => historyNumber(row, 'net_out_speed')) }
  ]
})

const latencySeries = computed(() => {
  const rows = history.value
  return routes.value.map((route) => ({
    name: route.label,
    color: routeColor(route.key),
    points: pointsOf(rows, (row) => {
      const value = row?.[route.ping]
      return latencyState(value) === 'ok' ? Number(value) : null
    })
  }))
})

function percentLabel(value) {
  return `${Math.round(value)}%`
}

function msLabel(value) {
  return `${Math.round(value)}ms`
}

function chartTime(timestamp) {
  return axisTimeLabel(timestamp, range.value)
}

function chartTooltipTime(timestamp) {
  return formatDateTime(timestamp, locale.value)
}

function lossText(route) {
  const value = server.value?.[route.loss]
  if (value === false || value === undefined || value === null) return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return `${number.toFixed(number >= 10 ? 0 : 1)}%`
}

function startDetailSocket() {
  if (!serverId.value || !base.value) return
  startServerSocket(base.value, serverId.value, {
    onUpdate: (id, data, ts) => {
      if (String(id) !== serverId.value || !server.value) return
      for (const [key, value] of Object.entries(data || {})) {
        if (value !== undefined) server.value[key] = value
      }
      server.value.last_updated = Date.now()
      server.value.report_timestamp = normalizeTimestamp(ts) || Date.now()
    }
  })
}

async function loadHistory() {
  if (!serverId.value || !base.value) return
  const token = ++historyToken
  historyLoading.value = true
  historyError.value = ''
  try {
    const rows = await fetchHistory(base.value, serverId.value, range.value)
    if (token === historyToken) history.value = rows
  } catch (err) {
    if (token === historyToken && err?.status !== 401 && err?.status !== 403) {
      historyError.value = err?.message || t('loadFailed')
    }
  } finally {
    if (token === historyToken) historyLoading.value = false
  }
}

async function fetchDetail() {
  const id = serverId.value
  if (!id) return
  loading.value = !server.value
  error.value = ''
  try {
    const result = await fetchServer(id)
    if (serverId.value !== id) return
    server.value = result.server
    base.value = result.base
    startDetailSocket()
    loadHistory()
  } catch (err) {
    if (err?.status === 401 || err?.status === 403) return
    if (err?.status === 404) error.value = t('notFoundHint')
    else error.value = err?.message || t('loadFailedHint')
  } finally {
    loading.value = false
  }
}

async function loadDetail() {
  const id = serverId.value
  if (!id) return
  error.value = ''
  history.value = []
  historyError.value = ''
  historyToken += 1

  if (String(server.value?.id || '') !== id) {
    server.value = null
    base.value = ''
  }

  const cached = monitor.servers.find((item) => String(item.id) === id)
  if (cached) {
    server.value = { ...cached }
    base.value = cached.source || ''
    loading.value = false
  } else {
    loading.value = true
  }

  const ok = await initMonitor()
  if (monitor.turnstileRequired) {
    loading.value = false
    return
  }
  if (!ok && !monitor.config) {
    error.value = monitor.error || t('loadFailedHint')
    loading.value = false
    return
  }
  await fetchDetail()
}

async function selectRange(hours) {
  if (range.value === hours) return
  range.value = hours
  await loadHistory()
}

async function retryDetail() {
  await fetchDetail()
}

function retryHistory() {
  loadHistory()
}

watch(() => route.params.id, (id, previous) => {
  if (String(id) === String(previous)) return
  stopAllSockets()
  loadDetail()
})

watch(() => monitor.turnstileRequired, (required, previous) => {
  if (previous && !required && !server.value) loadDetail()
})

onMounted(() => {
  unregisterVisibility = registerVisibilityHandler(async () => {
    if (!monitor.config || monitor.wsTimeout || monitor.wsTimeoutDismissed) return
    await fetchDetail()
  })
  loadDetail()
})

onBeforeUnmount(() => {
  unregisterVisibility?.()
  stopAllSockets()
  historyToken += 1
})
</script>

<template>
  <div class="detail-page">
    <AppHeader />

    <main class="container detail-main">
      <div class="detail-nav">
        <RouterLink to="/" class="back-link">
          <AppIcon name="arrowLeft" :size="15" />
          {{ t('detailBack') }}
        </RouterLink>
        <div class="detail-nav-right">
          <span class="ws-badge" :class="`tone-${wsTone}`">
            <i></i>
            {{ wsLabel }}
          </span>
          <RouterLink to="/epaper" class="btn btn-ghost">
            <AppIcon name="printer" :size="14" />
            {{ t('epaper') }}
          </RouterLink>
        </div>
      </div>

      <div v-if="loading && !server" class="detail-skeleton">
        <div class="skeleton-hero glass">
          <div class="skeleton sk-flag"></div>
          <div class="sk-copy">
            <div class="skeleton sk-line sk-lg"></div>
            <div class="skeleton sk-line sk-sm"></div>
            <div class="skeleton sk-line sk-xs"></div>
          </div>
          <div class="skeleton sk-ring"></div>
        </div>
        <div class="skeleton-grid">
          <div v-for="n in 3" :key="n" class="skeleton-chart glass"></div>
        </div>
      </div>

      <div v-else-if="error && !server" class="detail-error glass">
        <span class="error-mark"><AppIcon name="alert" :size="24" /></span>
        <h1>{{ t('notFound') }}</h1>
        <p>{{ error }}</p>
        <div class="error-actions">
          <button class="btn btn-primary" type="button" @click="retryDetail">
            <AppIcon name="refresh" :size="14" />
            {{ t('retry') }}
          </button>
          <RouterLink to="/" class="btn">
            <AppIcon name="arrowLeft" :size="14" />
            {{ t('detailBack') }}
          </RouterLink>
        </div>
      </div>

      <template v-else-if="server">
        <div v-if="error" class="inline-banner">
          <AppIcon name="alert" :size="15" />
          <span>{{ error }}</span>
          <button type="button" @click="retryDetail">{{ t('retry') }}</button>
        </div>

        <section class="detail-hero glass">
          <div class="hero-head">
            <div class="hero-identity">
              <span class="flag-large">
                <img v-if="flagUrl(server.region)" :src="flagUrl(server.region)" :alt="server.region" />
                <AppIcon v-else name="globe" :size="22" />
              </span>
              <div class="hero-title">
                <div class="eyebrow">
                  {{ region }}
                  <span v-if="server.server_group"> / {{ server.server_group }}</span>
                </div>
                <h1>{{ server.name || server.id }}</h1>
                <div class="meta-row">
                  <span class="status-chip" :class="online ? 'is-online' : 'is-offline'">
                    <i></i>
                    {{ online ? t('online') : t('offline') }}
                  </span>
                  <span class="os-chip">
                    <img :src="osIconUrl(server.os)" :alt="osLabel(server.os)" />
                    {{ osLabel(server.os) }}
                  </span>
                  <span v-if="server.arch" class="meta-text mono">{{ server.arch }}</span>
                  <span v-if="server.uptime" class="meta-text">{{ t('uptime') }} {{ uptimeText(server.uptime) }}</span>
                </div>
                <div v-if="tags.length" class="tag-row">
                  <span v-for="tag in tags" :key="tag" class="tag">{{ tag }}</span>
                </div>
              </div>
            </div>
            <div class="hero-side">
              <div class="hero-report">
                <span>{{ t('lastReport') }}</span>
                <strong class="mono">{{ lastReport }}</strong>
              </div>
              <span class="ws-badge" :class="`tone-${wsTone}`">
                <i></i>
                {{ wsLabel }}
              </span>
            </div>
          </div>

          <div class="hero-metrics">
            <div class="hero-metric">
              <MetricRing
                :value="Number(server.cpu) || 0"
                :label="t('cpu')"
                :detail="`${t('load')} ${(Number(server.load_1) || 0).toFixed(2)}`"
                :size="72"
              />
            </div>
            <div class="hero-metric">
              <MetricRing
                :value="ramPercent"
                :label="t('memory')"
                :detail="`${formatBytes((Number(server.ram_used) || 0) * 1048576)} / ${formatBytes((Number(server.ram_total) || 0) * 1048576)}`"
                :size="72"
              />
            </div>
            <div class="hero-metric">
              <MetricRing
                :value="diskPercent"
                :label="t('disk')"
                :detail="`${formatBytes((Number(server.disk_used) || 0) * 1048576)} / ${formatBytes((Number(server.disk_total) || 0) * 1048576)}`"
                :size="72"
              />
            </div>
            <div class="hero-traffic">
              <div class="traffic-head">
                <span>{{ t('monthTraffic') }}</span>
                <strong class="mono">{{ formatBytes(trafficUsed) }}</strong>
              </div>
              <div v-if="trafficLimit" class="traffic-track">
                <i :style="{ width: `${trafficPercent}%` }"></i>
              </div>
              <div class="traffic-foot">
                <span v-if="trafficLimit">{{ t('limit') }} {{ formatBytes(trafficLimit) }}</span>
                <span v-else>{{ t('noLimit') }}</span>
                <b v-if="trafficLimit" class="mono">{{ Math.round(trafficPercent) }}%</b>
              </div>
              <div class="traffic-split">
                <span><AppIcon name="arrowDown" :size="10" />{{ formatSpeed(server.net_in_speed) }}</span>
                <span><AppIcon name="arrowUp" :size="10" />{{ formatSpeed(server.net_out_speed) }}</span>
              </div>
            </div>
          </div>
        </section>

        <div class="detail-layout">
          <div class="charts-column">
            <div class="charts-toolbar">
              <div class="charts-copy">
                <div class="eyebrow">PERFORMANCE</div>
                <h2>{{ t('history') }}</h2>
              </div>
              <div class="range-tabs" role="group">
                <button
                  v-for="item in ranges"
                  :key="item.hours"
                  type="button"
                  :class="{ active: range === item.hours }"
                  @click="selectRange(item.hours)"
                >
                  {{ t(item.key) }}
                </button>
              </div>
            </div>

            <div v-if="historyError" class="inline-banner compact">
              <AppIcon name="alert" :size="14" />
              <span>{{ historyError }}</span>
              <button type="button" @click="retryHistory">{{ t('retry') }}</button>
            </div>

            <section class="chart-card glass">
              <div class="chart-head">
                <h3><AppIcon name="cpu" :size="14" />{{ t('chartCpu') }}</h3>
                <span v-if="historyLoading" class="chart-loading"><i></i>{{ t('loading') }}</span>
                <span v-else class="chart-count mono">{{ history.length }} pts</span>
              </div>
              <LineChart
                :series="usageSeries"
                :y-max="100"
                :format-value="percentLabel"
                :format-time="chartTime"
                :format-tooltip-time="chartTooltipTime"
                :empty-text="t('noHistory')"
              />
            </section>

            <section class="chart-card glass">
              <div class="chart-head">
                <h3><AppIcon name="network" :size="14" />{{ t('chartNetwork') }}</h3>
              </div>
              <LineChart
                :series="networkSeries"
                :format-value="formatSpeed"
                :format-time="chartTime"
                :format-tooltip-time="chartTooltipTime"
                :empty-text="t('noHistory')"
              />
            </section>

            <section class="chart-card glass">
              <div class="chart-head">
                <h3><AppIcon name="activity" :size="14" />{{ t('chartLatency') }}</h3>
              </div>
              <LineChart
                :series="latencySeries"
                :format-value="msLabel"
                :format-time="chartTime"
                :format-tooltip-time="chartTooltipTime"
                :empty-text="t('noHistory')"
              />
            </section>
          </div>

          <aside class="detail-side">
            <section class="side-card glass">
              <div class="side-head">
                <h2>{{ t('system') }}</h2>
                <AppIcon name="terminal" :size="15" />
              </div>
              <dl class="info-list">
                <div v-for="row in infoRows" :key="row.label" class="info-row">
                  <dt>{{ row.label }}</dt>
                  <dd :title="row.value">{{ row.value }}</dd>
                </div>
              </dl>
            </section>

            <section class="side-card glass">
              <div class="side-head">
                <h2>{{ t('trafficUsage') }}</h2>
                <span class="side-badge mono">{{ trafficLimit ? `${Math.round(trafficPercent)}%` : t('noLimit') }}</span>
              </div>
              <div class="traffic-large">
                <strong class="mono">{{ formatBytes(trafficUsed) }}</strong>
                <span v-if="trafficLimit">/ {{ formatBytes(trafficLimit) }}</span>
              </div>
              <div v-if="trafficLimit" class="traffic-track large">
                <i :style="{ width: `${trafficPercent}%` }"></i>
              </div>
              <div class="traffic-detail-grid">
                <div>
                  <span>{{ t('download') }}</span>
                  <b class="mono">{{ formatBytes(server.net_rx_monthly) }}</b>
                </div>
                <div>
                  <span>{{ t('upload') }}</span>
                  <b class="mono">{{ formatBytes(server.net_tx_monthly) }}</b>
                </div>
              </div>
            </section>

            <section class="side-card glass">
              <div class="side-head">
                <h2>{{ t('threeNet') }}</h2>
                <AppIcon name="activity" :size="15" />
              </div>
              <div class="route-grid">
                <div
                  v-for="route in routes"
                  :key="route.key"
                  class="route-box"
                  :class="`tone-${route.tone}`"
                >
                  <div class="route-head">
                    <i :style="{ background: routeColor(route.key) }"></i>
                    <span>{{ route.label }}</span>
                  </div>
                  <strong v-if="route.state === 'ok'" class="mono">
                    {{ Math.round(Number(route.value)) }}<small>ms</small>
                  </strong>
                  <strong v-else-if="route.state === 'timeout'" class="route-timeout">{{ t('timeout') }}</strong>
                  <strong v-else class="route-off">—</strong>
                  <small v-if="route.state === 'ok' && lossText(route)" class="route-loss">
                    {{ t('packetLoss') }} {{ lossText(route) }}
                  </small>
                </div>
              </div>
            </section>

            <section class="side-card glass">
              <div class="side-head">
                <h2>{{ t('realtime') }}</h2>
                <span class="side-badge mono">{{ t('swap') }} {{ Math.round(swapPercent) }}%</span>
              </div>
              <div class="stat-grid">
                <div v-for="stat in liveStats" :key="stat.label">
                  <span>{{ stat.label }}</span>
                  <b class="mono">{{ stat.value }}</b>
                </div>
              </div>
            </section>

            <section
              v-if="(sys.show_price && price) || (sys.show_expire && expiration)"
              class="side-card glass"
            >
              <div class="side-head">
                <h2>{{ t('billing') }}</h2>
                <AppIcon name="gauge" :size="15" />
              </div>
              <div v-if="sys.show_price && price" class="price-row">
                <strong class="mono">{{ price.text }}</strong>
                <span>{{ billing.label }}</span>
              </div>
              <dl class="info-list">
                <div v-if="sys.show_expire && expiration" class="info-row">
                  <dt>{{ t('expiryDate') }}</dt>
                  <dd :class="`tone-${expiration.tone}`">
                    {{ formatDate(server.expire_date, locale) }} · {{ expiration.text }}
                  </dd>
                </div>
                <div v-if="server.billing_cycle" class="info-row">
                  <dt>{{ t('billingCycle') }}</dt>
                  <dd>{{ billing.label }}</dd>
                </div>
                <div v-if="server.auto_renewal !== undefined" class="info-row">
                  <dt>{{ t('autoRenew') }}</dt>
                  <dd>{{ autoRenewal }}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>

        <FooterBar />
      </template>
    </main>
  </div>
</template>

<style scoped>
.detail-main {
  padding-top: 18px;
}

.detail-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.back-link {
  display: inline-flex;
  height: 30px;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 10.5px;
  font-weight: 560;
  transition: color 0.16s ease;
}

.back-link:hover {
  color: var(--accent);
}

.detail-nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ws-badge {
  display: inline-flex;
  height: 26px;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 99px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.ws-badge i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}

.ws-badge.tone-good {
  border-color: rgba(var(--good-rgb), 0.2);
  background: rgba(var(--good-rgb), 0.05);
  color: var(--good);
}

.ws-badge.tone-warn {
  border-color: rgba(var(--warn-rgb), 0.2);
  background: rgba(var(--warn-rgb), 0.05);
  color: var(--warn);
}

.ws-badge.tone-bad {
  border-color: rgba(var(--bad-rgb), 0.16);
  background: rgba(var(--bad-rgb), 0.04);
  color: var(--bad);
}

.detail-hero {
  padding: 22px 24px 20px;
}

.hero-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.hero-identity {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 15px;
}

.flag-large {
  display: grid;
  width: 50px;
  height: 35px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  background: rgba(148, 163, 184, 0.06);
  color: var(--faint);
  box-shadow: var(--shadow-soft);
}

.flag-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-title {
  min-width: 0;
}

.hero-title h1 {
  margin: 3px 0 7px;
  overflow: hidden;
  color: var(--text);
  font-size: 27px;
  font-weight: 680;
  letter-spacing: -0.04em;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px 10px;
}

.status-chip {
  display: inline-flex;
  height: 21px;
  align-items: center;
  gap: 5px;
  padding: 0 7px;
  border: 1px solid var(--line);
  border-radius: 5px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 560;
}

.status-chip i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}

.status-chip.is-online {
  border-color: rgba(var(--good-rgb), 0.18);
  background: rgba(var(--good-rgb), 0.05);
  color: var(--good);
}

.status-chip.is-offline {
  border-color: rgba(var(--bad-rgb), 0.16);
  background: rgba(var(--bad-rgb), 0.04);
  color: var(--bad);
}

.os-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 9.5px;
}

.os-chip img {
  width: 12px;
  height: 12px;
  object-fit: contain;
}

.meta-text {
  color: var(--faint);
  font-size: 9.5px;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}

.tag {
  padding: 1px 6px;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 8px;
}

.hero-side {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.hero-report {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.hero-report span {
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-report strong {
  color: var(--muted);
  font-size: 9px;
  font-weight: 500;
  white-space: nowrap;
}

.hero-metrics {
  display: grid;
  grid-template-columns: 0.75fr 0.75fr 0.75fr 1.45fr;
  gap: 0;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.hero-metric {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
}

.hero-metric + .hero-metric {
  border-left: 1px solid var(--line);
}

.hero-traffic {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
  padding-left: 22px;
  border-left: 1px solid var(--line);
}

.traffic-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.traffic-head span {
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 650;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.traffic-head strong {
  color: var(--text);
  font-size: 15px;
  font-weight: 650;
  white-space: nowrap;
}

.traffic-track {
  height: 4px;
  overflow: hidden;
  border-radius: 99px;
  background: rgba(148, 163, 184, 0.13);
}

.traffic-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  box-shadow: 0 0 8px rgba(var(--accent-rgb), 0.35);
  transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}

.traffic-track.large {
  height: 5px;
  margin: 10px 0 12px;
}

.traffic-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--faint);
  font-size: 8.5px;
}

.traffic-foot b {
  color: var(--text-soft);
  font-weight: 600;
}

.traffic-split {
  display: flex;
  gap: 12px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 8.5px;
}

.traffic-split span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.traffic-split span:first-child {
  color: var(--accent);
}

.traffic-split span:last-child {
  color: var(--accent-2);
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.75fr) minmax(280px, 0.8fr);
  gap: 16px;
  margin-top: 16px;
}

.charts-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 13px;
}

.charts-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  padding: 2px 2px 0;
}

.charts-copy h2 {
  margin: 3px 0 0;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.025em;
}

.range-tabs {
  display: flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.04);
}

.range-tabs button {
  height: 26px;
  padding: 0 9px;
  border-radius: 5px;
  color: var(--muted);
  font-size: 9.5px;
  font-weight: 560;
  white-space: nowrap;
}

.range-tabs button:hover {
  color: var(--text-soft);
}

.range-tabs button.active {
  background: var(--surface-hover);
  color: var(--accent);
}

.chart-card {
  padding: 15px 18px 12px;
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 2px;
}

.chart-head h3 {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: var(--text-soft);
  font-size: 11.5px;
  font-weight: 600;
}

.chart-head h3 :deep(svg) {
  color: var(--faint);
}

.chart-count {
  color: var(--faint);
  font-size: 8px;
}

.chart-loading {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 8px;
}

.chart-loading i {
  width: 8px;
  height: 8px;
  border: 1.5px solid var(--line-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.detail-side {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 13px;
}

.side-card {
  padding: 15px 16px;
}

.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 11px;
  color: var(--faint);
}

.side-head h2 {
  margin: 0;
  color: var(--text-soft);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.side-badge {
  padding: 1px 5px;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--faint);
  font-size: 8px;
  white-space: nowrap;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 0;
}

.info-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 14px;
  padding: 5px 0;
  border-bottom: 1px solid var(--line);
}

.info-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.info-row dt {
  flex: 0 0 auto;
  color: var(--faint);
  font-size: 9px;
}

.info-row dd {
  overflow: hidden;
  max-width: 72%;
  margin: 0;
  color: var(--text-soft);
  font-family: var(--font-mono);
  font-size: 9px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-row dd.tone-warn {
  color: var(--warn);
}

.info-row dd.tone-bad {
  color: var(--bad);
}

.traffic-large {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.traffic-large strong {
  color: var(--text);
  font-size: 23px;
  font-weight: 650;
  letter-spacing: -0.04em;
}

.traffic-large span {
  color: var(--faint);
  font-size: 9px;
}

.traffic-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.traffic-detail-grid div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(148, 163, 184, 0.035);
}

.traffic-detail-grid span {
  color: var(--faint);
  font-size: 8px;
}

.traffic-detail-grid b {
  color: var(--text-soft);
  font-size: 9.5px;
  font-weight: 600;
}

.route-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: 7px;
}

.route-box {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  padding: 8px 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.035);
}

.route-head {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 650;
  letter-spacing: 0.05em;
}

.route-head i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
}

.route-box > strong {
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.route-box > strong small {
  margin-left: 1px;
  color: var(--faint);
  font-size: 7px;
  font-weight: 500;
}

.route-box.tone-good > strong,
.route-box.tone-warn > strong,
.route-box.tone-bad > strong {
  color: var(--text);
}

.route-timeout {
  color: var(--bad);
}

.route-off {
  color: var(--faint) !important;
}

.route-loss {
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 7.5px;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--line);
}

.stat-grid div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 9px;
  background: var(--surface);
}

.stat-grid span {
  color: var(--faint);
  font-size: 8px;
}

.stat-grid b {
  color: var(--text-soft);
  font-size: 11.5px;
  font-weight: 600;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
}

.price-row strong {
  color: var(--accent);
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.04em;
}

.price-row span {
  color: var(--faint);
  font-size: 9px;
}

.inline-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 9px 12px;
  border: 1px solid rgba(var(--warn-rgb), 0.2);
  border-radius: 9px;
  background: rgba(var(--warn-rgb), 0.05);
  color: var(--warn);
  font-size: 10.5px;
}

.inline-banner.compact {
  margin: 0;
  padding: 7px 10px;
}

.inline-banner span {
  flex: 1;
}

.inline-banner button {
  color: var(--text-soft);
  font-size: 9.5px;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.detail-skeleton {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.skeleton-hero {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 26px;
}

.sk-flag {
  width: 50px;
  height: 50px;
  border-radius: 12px;
}

.sk-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.sk-copy .sk-lg {
  width: 180px;
  height: 22px;
}

.sk-copy .sk-sm {
  width: 120px;
}

.sk-copy .sk-xs {
  width: 80px;
}

.sk-ring {
  width: 72px;
  height: 72px;
  border-radius: 50%;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.skeleton-chart {
  height: 260px;
}

.detail-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px 24px;
  text-align: center;
}

.error-mark {
  display: grid;
  width: 54px;
  height: 54px;
  margin-bottom: 15px;
  place-items: center;
  border: 1px solid rgba(var(--bad-rgb), 0.24);
  border-radius: 15px;
  background: rgba(var(--bad-rgb), 0.07);
  color: var(--bad);
}

.detail-error h1 {
  margin: 0 0 6px;
  font-size: 20px;
  letter-spacing: -0.03em;
}

.detail-error p {
  max-width: 380px;
  margin: 0 0 18px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

@media (max-width: 1100px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .detail-side {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 860px) {
  .hero-head {
    flex-direction: column;
    gap: 14px;
  }

  .hero-side {
    width: 100%;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .hero-report {
    align-items: flex-start;
  }

  .hero-metrics {
    grid-template-columns: 1fr 1fr;
    gap: 14px 0;
  }

  .hero-metric:nth-child(3) {
    border-left: 0;
  }

  .hero-traffic {
    grid-column: auto;
    padding-left: 14px;
  }
}

@media (max-width: 700px) {
  .detail-side {
    grid-template-columns: 1fr;
  }

  .charts-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .range-tabs {
    max-width: 100%;
    overflow-x: auto;
  }

  .chart-card {
    padding: 14px 12px 8px;
  }
}

@media (max-width: 540px) {
  .detail-hero {
    padding: 17px 15px 16px;
  }

  .hero-title h1 {
    font-size: 22px;
  }

  .flag-large {
    width: 42px;
    height: 29px;
  }

  .hero-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px 0;
  }

  .hero-metric {
    justify-content: center;
    padding: 6px 0;
  }

  .hero-metric + .hero-metric {
    border-top: 0;
    border-left: 1px solid var(--line);
  }

  .hero-traffic {
    grid-column: 1 / -1;
    padding: 12px 2px 2px;
    border-top: 1px solid var(--line);
    border-left: 0;
  }
}
</style>
