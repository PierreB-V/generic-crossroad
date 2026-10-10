import type { Junction, Phase, SignalPlan } from '../model/types'
import { LANE_PX, type JunctionGeom } from './canvasGeometry'

const TURN_COLORS: Record<string, string> = {
  left: '#38bdf8',
  through: '#a3e635',
  right: '#f472b6',
}

const RED = '#ef4444'
const GREEN = '#4ade80'
const GRAY = '#64748b'
const ASPHALT = '#0b1220'
const MARKING = '#475569'

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

  // roads: one wide band per approach, sized to its lane count
  junction.approaches.forEach((app, ai) => {
    const lane = geom.lanes[ai]
    const half = lane.width / 2
    const far = 400
    const corners = [
      { x: lane.stop.x + lane.lateral.x * half + lane.inbound.x * far, y: lane.stop.y + lane.lateral.y * half + lane.inbound.y * far },
      { x: lane.stop.x - lane.lateral.x * half + lane.inbound.x * far, y: lane.stop.y - lane.lateral.y * half + lane.inbound.y * far },
      { x: lane.stop.x - lane.lateral.x * half - lane.inbound.x * 22, y: lane.stop.y - lane.lateral.y * half - lane.inbound.y * 22 },
      { x: lane.stop.x + lane.lateral.x * half - lane.inbound.x * 22, y: lane.stop.y + lane.lateral.y * half - lane.inbound.y * 22 },
    ]
    ctx.fillStyle = ASPHALT
    ctx.beginPath()
    ctx.moveTo(corners[0].x, corners[0].y)
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y)
    ctx.closePath()
    ctx.fill()

    // lane divider dashes
    ctx.strokeStyle = MARKING
    ctx.lineWidth = 1
    ctx.setLineDash([6, 6])
    for (let l = 1; l < app.lanes; l++) {
      const off = l * LANE_PX - half
      ctx.beginPath()
      ctx.moveTo(lane.stop.x + lane.lateral.x * off + lane.inbound.x * far, lane.stop.y + lane.lateral.y * off + lane.inbound.y * far)
      ctx.lineTo(lane.stop.x + lane.lateral.x * off, lane.stop.y + lane.lateral.y * off)
      ctx.stroke()
    }
    ctx.setLineDash([])
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

    // stop bar across the road = traffic light
    const half = lane.width / 2
    ctx.strokeStyle = green ? GREEN : RED
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(lane.stop.x - lane.lateral.x * half, lane.stop.y - lane.lateral.y * half)
    ctx.lineTo(lane.stop.x + lane.lateral.x * half, lane.stop.y + lane.lateral.y * half)
    ctx.stroke()

    // per-turn arrow painted on each movement's own lane
    app.movements.forEach((m, mi) => {
      const ml = geom.movementLanes.get(`${ai}:${mi}`)
      if (!ml) return
      const cx = ml.origin.x + lane.inbound.x * 26
      const cy = ml.origin.y + lane.inbound.y * 26
      const active = phase.movements.some((x) => x.approach === ai && x.movement === mi)
      drawTurnGlyph(ctx, m.turn, cx, cy, lane.inbound, active ? TURN_COLORS[m.turn] : GRAY)
    })

    // queued cars stacked inside their own lane
    app.movements.forEach((m, mi) => {
      const ml = geom.movementLanes.get(`${ai}:${mi}`)
      if (!ml) return
      const active = phase.movements.some((x) => x.approach === ai && x.movement === mi)
      const demand = m.demandVph / 3600
      const queueLen = active
        ? Math.max(0, Math.round(demand * (30 - greenLeft) * 0.3))
        : Math.round(demand * (t % 40) * 0.5)
      for (let q = 0; q < Math.min(queueLen, 10); q++) {
        const px = ml.origin.x + lane.inbound.x * (14 + q * 13)
        const py = ml.origin.y + lane.inbound.y * (14 + q * 13)
        ctx.fillStyle = active ? TURN_COLORS[m.turn] : '#fbbf24'
        ctx.fillRect(px - 5, py - 6, 10, 12)
      }
    })
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
  const north = { x: 0, y: -1 }
  const legendGlyphs: [string, string][] = [
    ['left', 'left turn'],
    ['through', 'through'],
    ['right', 'right turn'],
  ]
  legendGlyphs.forEach(([turn, label], i) => {
    const y = 520 + i * 22
    drawTurnGlyph(ctx, turn, lx + 10, y, north, TURN_COLORS[turn])
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(label, lx + 28, y + 4)
  })
  ctx.fillStyle = '#fbbf24'
  ctx.fillRect(lx + 6, 584, 10, 12)
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('queued car (its lane color = moving)', lx + 24, 594)
  ctx.fillStyle = GREEN
  ctx.fillRect(lx + 2, 602, 16, 4)
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('stop bar = light', lx + 28, 606)
}

function drawTurnGlyph(
  ctx: CanvasRenderingContext2D,
  turn: string,
  x: number,
  y: number,
  inbound: { x: number; y: number },
  colorOverride?: string,
) {
  // rotate: glyph drawn assuming traffic flows upward (inbound = (0,-1))
  const angle = Math.atan2(inbound.y, inbound.x) - Math.atan2(-1, 0)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  const color = colorOverride ?? ctx.strokeStyle
  ctx.strokeStyle = color as string
  ctx.lineWidth = 2
  ctx.beginPath()
  if (turn === 'through') {
    ctx.moveTo(0, 5)
    ctx.lineTo(0, -5)
    ctx.moveTo(-3, -2)
    ctx.lineTo(0, -5)
    ctx.lineTo(3, -2)
  } else {
    const dx = turn === 'right' ? 1 : -1
    ctx.moveTo(0, 5)
    ctx.lineTo(0, -2)
    ctx.lineTo(dx * 5, -4)
    ctx.moveTo(dx * 1, -1)
    ctx.lineTo(dx * 5, -4)
    ctx.moveTo(-dx * 2, -4)
    ctx.lineTo(dx * 5, -4)
  }
  ctx.stroke()
  ctx.restore()
}
