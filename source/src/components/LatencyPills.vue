<script setup>
import { computed } from 'vue'
import { latencyRoutes } from '../utils/format'
import { t } from '../utils/i18n'

const props = defineProps({
  server: { type: Object, required: true },
  compact: { type: Boolean, default: false },
  showLoss: { type: Boolean, default: false }
})

const routes = computed(() => latencyRoutes(props.server).filter((route) => route.state !== 'off'))

function lossText(route) {
  const value = props.server?.[route.loss]
  if (value === false || value === undefined || value === null) return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return `${number.toFixed(number >= 10 ? 0 : 1)}%`
}
</script>

<template>
  <div v-if="routes.length" class="latency-pills" :class="{ compact }">
    <span
      v-for="route in routes"
      :key="route.key"
      class="latency-chip"
      :class="[`tone-${route.tone}`, { timeout: route.state === 'timeout' }]"
      :title="`${route.label} ${route.state === 'timeout' ? t('timeout') : `${route.value}ms`}`"
    >
      <i class="route-dot" :style="{ background: route.color }"></i>
      <span class="route-label">{{ route.label }}</span>
      <strong>{{ route.state === 'timeout' ? t('timeout') : `${Math.round(Number(route.value))}ms` }}</strong>
      <small v-if="showLoss && lossText(route)">{{ lossText(route) }}</small>
    </span>
  </div>
</template>

<style scoped>
.latency-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.latency-chip {
  display: inline-flex;
  height: 25px;
  align-items: center;
  gap: 5px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: rgba(148, 163, 184, 0.045);
  color: var(--text-soft);
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 550;
  white-space: nowrap;
}

.latency-chip.compact {
  height: 23px;
}

.route-dot {
  width: 4px;
  height: 4px;
  flex: 0 0 auto;
  border-radius: 50%;
  box-shadow: 0 0 5px currentColor;
}

.route-label {
  color: var(--faint);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.latency-chip strong {
  color: var(--text-soft);
  font-size: 9.5px;
  font-weight: 600;
}

.latency-chip small {
  color: var(--faint);
  font-size: 8px;
}

.latency-chip.tone-good strong {
  color: var(--good);
}

.latency-chip.tone-warn strong {
  color: var(--warn);
}

.latency-chip.tone-bad strong,
.latency-chip.timeout strong {
  color: var(--bad);
}

.latency-chip.timeout {
  border-color: rgba(var(--bad-rgb), 0.18);
  background: rgba(var(--bad-rgb), 0.05);
}

.latency-chip.timeout .route-dot {
  background: var(--bad) !important;
}
</style>
