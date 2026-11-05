<script setup>
import { computed } from 'vue'

const props = defineProps({
  series: { type: Array, default: () => [] },
  height: { type: Number, default: 34 },
  area: { type: Boolean, default: false }
})

const W = 200
const pad = 2

const prepared = computed(() => props.series
  .map((item) => ({
    name: item.name,
    color: item.color || 'var(--accent)',
    points: (item.points || [])
      .filter((point) => Number.isFinite(point.x))
      .sort((a, b) => a.x - b.x)
  }))
  .filter((item) => item.points.length > 0))

const hasData = computed(() => prepared.value.some((item) => item.points.some((point) => Number.isFinite(point.y))))

const domain = computed(() => {
  const xs = prepared.value.flatMap((item) => item.points.map((point) => point.x))
  const ys = prepared.value.flatMap((item) => item.points.filter((point) => Number.isFinite(point.y)).map((point) => point.y))
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys, 1)
  return {
    minX: minX === maxX ? minX - 1 : minX,
    maxX: minX === maxX ? maxX + 1 : maxX,
    maxY: maxY * 1.12
  }
})

function xPos(x) {
  const { minX, maxX } = domain.value
  return pad + ((x - minX) / (maxX - minX)) * (W - pad * 2)
}

function yPos(y) {
  return props.height - pad - (Number(y) / domain.value.maxY) * (props.height - pad * 2)
}

function splitSegments(points) {
  const segments = []
  let current = []
  for (const point of points) {
    if (Number.isFinite(point.y)) {
      current.push(point)
    } else if (current.length) {
      segments.push(current)
      current = []
    }
  }
  if (current.length) segments.push(current)
  return segments
}

function linePath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${xPos(point.x).toFixed(2)},${yPos(point.y).toFixed(2)}`).join(' ')
}

function areaPath(points) {
  if (points.length < 2) return ''
  const base = props.height - pad
  return `${linePath(points)} L${xPos(points[points.length - 1].x).toFixed(2)},${base} L${xPos(points[0].x).toFixed(2)},${base} Z`
}

const paths = computed(() => prepared.value.map((item) => ({
  name: item.name,
  color: item.color,
  lines: splitSegments(item.points).map((segment) => linePath(segment)),
  areas: props.area ? splitSegments(item.points).map((segment) => areaPath(segment)) : []
})))
</script>

<template>
  <div class="sparkline" :style="{ height: `${height}px` }">
    <svg v-if="hasData" :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none" aria-hidden="true">
      <g v-for="(item, index) in paths" :key="index">
        <path v-for="(area, areaIndex) in item.areas" :key="`a-${areaIndex}`" :d="area" :fill="item.color" fill-opacity="0.08" />
        <path
          v-for="(line, lineIndex) in item.lines"
          :key="`l-${lineIndex}`"
          :d="line"
          :stroke="item.color"
          stroke-width="1.4"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
          opacity="0.9"
        />
      </g>
    </svg>
    <svg v-else :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none" aria-hidden="true">
      <path :d="`M2,${height - 4} L${W - 2},${height - 4}`" stroke="var(--line-strong)" stroke-width="1" stroke-dasharray="3 4" fill="none" />
    </svg>
  </div>
</template>

<style scoped>
.sparkline {
  width: 100%;
  min-width: 0;
}

.sparkline svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
</style>
