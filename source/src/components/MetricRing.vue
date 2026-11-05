<script setup>
import { computed } from 'vue'
import { clampPercent, usageTone } from '../utils/format'

const props = defineProps({
  value: { type: Number, default: 0 },
  label: { type: String, default: '' },
  detail: { type: String, default: '' },
  size: { type: Number, default: 58 },
  stroke: { type: Number, default: 5.5 }
})

const radius = 42
const circumference = 2 * Math.PI * radius
const safeValue = computed(() => clampPercent(props.value))
const tone = computed(() => usageTone(safeValue.value))
const offset = computed(() => circumference * (1 - safeValue.value / 100))
</script>

<template>
  <div class="metric-ring" :class="`tone-${tone}`" :style="{ '--ring-size': `${size}px` }">
    <div class="ring-visual">
      <svg viewBox="0 0 100 100" role="img" :aria-label="`${label} ${safeValue.toFixed(0)}%`">
        <circle class="ring-track" cx="50" cy="50" :r="radius" :stroke-width="stroke" />
        <circle
          class="ring-progress"
          cx="50"
          cy="50"
          :r="radius"
          :stroke-width="stroke"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="offset"
        />
      </svg>
      <span class="ring-value">
        {{ Math.round(safeValue) }}<em>%</em>
      </span>
    </div>
    <span class="ring-label">{{ label }}</span>
    <span v-if="detail" class="ring-detail">{{ detail }}</span>
  </div>
</template>

<style scoped>
.metric-ring {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  color: var(--text);
}

.metric-ring.tone-warn {
  color: var(--warn);
}

.metric-ring.tone-bad {
  color: var(--bad);
}

.ring-visual {
  position: relative;
  width: var(--ring-size);
  height: var(--ring-size);
}

.ring-visual svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track {
  fill: none;
  stroke: var(--track);
}

.ring-progress {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.25s ease;
}

.ring-value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
}

html[data-density="comfortable"] .ring-value {
  font-size: 13px;
}

.ring-value em {
  margin-left: 1px;
  color: var(--faint);
  font-size: 7px;
  font-style: normal;
  font-weight: 500;
}

.ring-label {
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 8px;
  font-weight: 650;
  letter-spacing: 0.1em;
}

.ring-detail {
  overflow: hidden;
  max-width: 78px;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 8.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
