<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { monitor } from '../stores/monitor'
import { locale, t } from '../utils/i18n'
import {
  expireInfo,
  flagUrl,
  formatBytes,
  formatSpeed,
  isServerOnline,
  latencyRoutes,
  monthTraffic,
  regionLabel,
  serverDiskPercent,
  serverRamPercent,
  trafficLimitBytes,
  trafficPercent,
  uptimeText
} from '../utils/format'
import AppIcon from './AppIcon.vue'
import LatencyPills from './LatencyPills.vue'

const props = defineProps({
  servers: { type: Array, default: () => [] }
})

const router = useRouter()
const sys = computed(() => monitor.sysConfig)

function openServer(server) {
  router.push(`/server/${encodeURIComponent(server.id)}`)
}

function onRowKey(event, server) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openServer(server)
  }
}

function expiry(server) {
  return sys.value.show_expire ? expireInfo(server.expire_date, locale.value, monitor.now) : null
}

function limit(server) {
  return trafficLimitBytes(server)
}

function trafficPct(server) {
  return trafficPercent(server)
}

function latencyCount(server) {
  return latencyRoutes(server).filter((route) => route.state !== 'off').length
}
</script>

<template>
  <div class="table-shell glass">
    <div class="table-scroll">
      <table class="server-table">
        <thead>
          <tr>
            <th>{{ t('name') }}</th>
            <th>{{ t('status') }}</th>
            <th>CPU</th>
            <th>{{ t('memory') }}</th>
            <th>{{ t('disk') }}</th>
            <th v-if="sys.show_tf">{{ t('monthTraffic') }}</th>
            <th>{{ t('network') }}</th>
            <th v-if="sys.show_three_net_details">{{ t('latency') }}</th>
            <th v-if="sys.show_expire">{{ t('expire') }}</th>
            <th class="col-arrow"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="server in servers"
            :key="server.id"
            tabindex="0"
            :class="{ 'is-offline': !isServerOnline(server, monitor.now) }"
            @click="openServer(server)"
            @keydown="onRowKey($event, server)"
          >
            <td>
              <div class="node-cell">
                <span class="flag-box">
                  <img v-if="flagUrl(server.region)" :src="flagUrl(server.region)" :alt="server.region" loading="lazy" />
                  <AppIcon v-else name="globe" :size="13" />
                </span>
                <div class="node-name">
                  <strong>{{ server.name || server.id }}</strong>
                  <span>{{ regionLabel(server.region, locale) }}<template v-if="server.server_group"> · {{ server.server_group }}</template></span>
                </div>
                <span class="uptime-tag mono">{{ uptimeText(server.uptime) }}</span>
              </div>
            </td>
            <td>
              <span class="status-pill" :class="isServerOnline(server, monitor.now) ? 'is-online' : 'is-offline'">
                <i></i>
                {{ isServerOnline(server, monitor.now) ? t('online') : t('offline') }}
              </span>
            </td>
            <td>
              <div class="metric-cell">
                <span class="metric-value mono">{{ (Number(server.cpu) || 0).toFixed(1) }}%</span>
                <span class="metric-track"><i :style="{ width: `${Math.min(100, Number(server.cpu) || 0)}%` }"></i></span>
              </div>
            </td>
            <td>
              <div class="metric-cell">
                <span class="metric-value mono">{{ serverRamPercent(server).toFixed(0) }}%</span>
                <span class="metric-detail">{{ formatBytes((Number(server.ram_used) || 0) * 1024 * 1024) }}</span>
              </div>
            </td>
            <td>
              <div class="metric-cell">
                <span class="metric-value mono">{{ serverDiskPercent(server).toFixed(0) }}%</span>
                <span class="metric-detail">{{ formatBytes((Number(server.disk_used) || 0) * 1024 * 1024) }}</span>
              </div>
            </td>
            <td v-if="sys.show_tf">
              <div class="metric-cell">
                <span class="metric-value mono">{{ formatBytes(monthTraffic(server)) }}</span>
                <span v-if="limit(server)" class="metric-track">
                  <i :style="{ width: `${Math.min(100, trafficPct(server))}%` }"></i>
                </span>
                <span v-else class="metric-detail">∞</span>
              </div>
            </td>
            <td>
              <div class="net-cell mono">
                <span class="net-in"><AppIcon name="arrowDown" :size="10" />{{ formatSpeed(server.net_in_speed) }}</span>
                <span class="net-out"><AppIcon name="arrowUp" :size="10" />{{ formatSpeed(server.net_out_speed) }}</span>
              </div>
            </td>
            <td v-if="sys.show_three_net_details">
              <LatencyPills v-if="latencyCount(server)" :server="server" compact />
              <span v-else class="empty-cell">—</span>
            </td>
            <td v-if="sys.show_expire">
              <span v-if="expiry(server)" class="expire-cell" :class="`tone-${expiry(server).tone}`">
                {{ expiry(server).text }}
              </span>
              <span v-else class="empty-cell">—</span>
            </td>
            <td class="col-arrow">
              <AppIcon name="arrowRight" :size="14" class="row-arrow" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.table-shell {
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

.server-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
}

th {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 650;
  letter-spacing: 0.11em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  color: var(--text-soft);
  font-size: 11px;
  vertical-align: middle;
}

tbody tr {
  cursor: pointer;
  transition: background 0.16s ease;
}

tbody tr:hover {
  background: rgba(148, 163, 184, 0.045);
}

tbody tr:focus-visible {
  outline: 2px solid rgba(var(--accent-rgb), 0.55);
  outline-offset: -2px;
}

tbody tr:last-child td {
  border-bottom: 0;
}

tr.is-offline {
  opacity: 0.66;
}

.node-cell {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 190px;
}

.flag-box {
  display: grid;
  width: 26px;
  height: 18px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.06);
  color: var(--faint);
}

.flag-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.node-name {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.node-name strong {
  overflow: hidden;
  max-width: 170px;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-name span {
  overflow: hidden;
  max-width: 170px;
  color: var(--faint);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.uptime-tag {
  margin-left: 3px;
  padding: 1px 5px;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--faint);
  font-size: 8px;
  white-space: nowrap;
}

.metric-cell {
  display: flex;
  min-width: 58px;
  flex-direction: column;
  gap: 3px;
}

.metric-value {
  color: var(--text-soft);
  font-size: 10.5px;
  white-space: nowrap;
}

.metric-detail {
  color: var(--faint);
  font-size: 8.5px;
  white-space: nowrap;
}

.metric-track {
  display: block;
  width: 54px;
  height: 3px;
  overflow: hidden;
  border-radius: 99px;
  background: rgba(148, 163, 184, 0.1);
}

.metric-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
}

.net-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 9px;
  white-space: nowrap;
}

.net-in,
.net-out {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.net-in {
  color: var(--accent);
}

.net-out {
  color: var(--accent-2);
}

.expire-cell {
  font-size: 9.5px;
  white-space: nowrap;
}

.empty-cell {
  color: var(--faint);
}

.col-arrow {
  width: 34px;
  padding-left: 0;
}

.row-arrow {
  color: var(--faint);
  transition: color 0.16s ease, transform 0.16s ease;
}

tbody tr:hover .row-arrow {
  color: var(--accent);
  transform: translateX(2px);
}
</style>
