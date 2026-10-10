import type { Junction, Phase, SignalPlan } from '../model/types'
import type { JunctionGeom } from './canvasGeometry'

const TURN_COLORS: Record<string, string> = {
  left: '#38bdf8',
  through: '#a3e635',
  right: '#f472b6',
}

const RED = '#ef4444'
const GREEN = '#4ade80'
const GRAY = '#64748b'

export function drawJunction(
  ctx: CanvasRenderingContext2D,
  junction: Junction,
  geom: JunctionGeom,
  phases: Phase[],
  activePhase: number,
  greenLeft: number,
  plan: SignalPlan,
  t: number,
) {
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(0, 0, 640, 640)

  // roads
  ctx.strokeStyle = '#475569'
  ctx.lineWidth = 60
  junction.approaches.forEach((app) => {
    const lane = geom.lanes.find((l) => l.heading === app.heading)
    if (!lane) return
    ctx.beginPath()
    ctx.moveTo(lane.stop.x + lane.inbound.x * 400, lane.stop.y + lane.inbound.y * 400)
    ctx.lineTo(geom.center.x - lane.inbound.x * 20, geom.center.y - lane.inbound.y * 20)
    ctx.stroke()
  })

  // junction box
  ctx.fillStyle = '#334155'
  ctx.fillRect(geom.center.x - geom.box / 2, geom.center.y - geom.box / 2, geom.box, geom.box)

  junction.approaches.forEach((app, ai) => {
    const lane = geom.lanes[ai]
    const phase = phases[activePhase]
    const green = app.movements.some((_, mi) =>
      phase.movements.some((m) => m.approach === ai && m.movement === mi),
    )

    // stop bar: thick line across the road, this is the traffic light
    const barX = -lane.inbound.y
    const barY = lane.inbound.x
    ctx.strokeStyle = green ? GREEN : RED
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(lane.stop.x - barX * 26, lane.stop.y - barY * 26)
    ctx.lineTo(lane.stop.x + barX * 26, lane.stop.y + barY * 26)
    ctx.stroke()

    // per-turn arrows stacked along the road before the stop bar
    app.movements.forEach((m, mi) => {
      const active = phase.movements.some((x) => x.approach === ai && x.movement === mi)
      const dist = 46 + mi * 26
      const cx = lane.stop.x + lane.inbound.x * dist + barX * 16
      const cy = lane.stop.y + lane.inbound.y * dist + barY * 16
      ctx.fillStyle = active ? TURN_COLORS[m.turn] : GRAY
      ctx.beginPath()
      ctx.arc(cx, cy, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, 11, 0, Math.PI * 2)
      ctx.stroke()
      drawTurnGlyph(ctx, m.turn, cx, cy, active ? '#0f172a' : GRAY)
    })

    // queue rectangles behind the stop bar
    const demand = app.movements.reduce((s, m) => s + m.demandVph, 0) / 3600
    const isGreen = green
    const queueLen = isGreen
      ? Math.max(0, Math.round(demand * (30 - greenLeft) * 0.3))
      : Math.round(demand * (t % 40) * 0.5)
    for (let q = 0; q < Math.min(queueLen, 12); q++) {
      const px = lane.stop.x + lane.inbound.x * (18 + q * 16)
      const py = lane.stop.y + lane.inbound.y * (18 + q * 16)
      ctx.fillStyle = '#fbbf24'
      ctx.fillRect(px - 4, py - 7, 8, 14)
    }
  })

  // HUD
  ctx.fillStyle = '#e2e8f0'
  ctx.font = '14px sans-serif'
  ctx.fillText(`t = ${t.toFixed(1)}s`, 12, 24)
  ctx.fillText(`Phase ${activePhase + 1} green left: ${greenLeft.toFixed(0)}s`, 12, 44)
  ctx.fillText(`Cycle plan: ${plan.greenSec.join('/')}s`, 12, 64)

  // legend
  const lx = 470
  ctx.font = '12px sans-serif'
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('Legend', lx, 500)
  drawTurnGlyph(ctx, 'left', lx + 10, 520, TURN_COLORS.left)
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('left turn', lx + 28, 524)
  drawTurnGlyph(ctx, 'through', lx + 10, 542, TURN_COLORS.through)
  ctx.fillText('through', lx + 28, 546)
  drawTurnGlyph(ctx, 'right', lx + 10, 564, TURN_COLORS.right)
  ctx.fillText('right turn', lx + 28, 568)
  ctx.fillStyle = '#fbbf24'
  ctx.fillRect(lx + 6, 578, 8, 12)
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('queued car', lx + 28, 588)
  ctx.fillStyle = GREEN
  ctx.fillRect(lx + 2, 598, 16, 4)
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('stop bar = light', lx + 28, 604)
  ctx.fillStyle = RED
  ctx.fillRect(lx + 2, 612, 16, 4)
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('(green/red)', lx + 28, 616)
}

function drawTurnGlyph(
  ctx: CanvasRenderingContext2D,
  turn: string,
  x: number,
  y: number,
  color: string,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  if (turn === 'through') {
    ctx.moveTo(x, y + 4)
    ctx.lineTo(x, y - 4)
    ctx.moveTo(x - 3, y - 1)
    ctx.lineTo(x, y - 4)
    ctx.lineTo(x + 3, y - 1)
  } else {
    const dx = turn === 'right' ? 1 : -1
    ctx.moveTo(x, y + 4)
    ctx.lineTo(x, y - 2)
    ctx.lineTo(x + dx * 4, y - 4)
    ctx.moveTo(x + dx * 1, y - 1)
    ctx.lineTo(x + dx * 4, y - 4)
    ctx.moveTo(x - dx * 2, y - 4)
    ctx.lineTo(x + dx * 4, y - 4)
  }
  ctx.stroke()
}
