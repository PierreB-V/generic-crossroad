import type { Junction, Phase, SignalPlan } from '../model/types'
import { LANE_PX, ROAD_LEN, type JunctionGeom } from './canvasGeometry'
import type { CarPos, CarSim } from './carSim'

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
const CENTER_LINE = '#94a3b8'

export function drawJunction(
  ctx: CanvasRenderingContext2D,
  junction: Junction,
  geom: JunctionGeom,
  phases: Phase[],
  activePhase: number,
  greenLeft: number,
  plan: SignalPlan,
  t: number,
  cars: CarPos[],
  carSim: CarSim,
) {
  ctx.fillStyle = '#1e293b'
  ctx.fillRect(0, 0, 640, 640)

  // two-way roads: full width covers incoming + outgoing lanes
  junction.approaches.forEach((app, ai) => {
    const lane = geom.lanes[ai]
    const half = lane.width / 2
    const corners = [
      { x: lane.stop.x + lane.lateral.x * half + lane.inbound.x * ROAD_LEN, y: lane.stop.y + lane.lateral.y * half + lane.inbound.y * ROAD_LEN },
      { x: lane.stop.x - lane.lateral.x * half + lane.inbound.x * ROAD_LEN, y: lane.stop.y - lane.lateral.y * half + lane.inbound.y * ROAD_LEN },
      { x: lane.stop.x - lane.lateral.x * half - lane.inbound.x * 22, y: lane.stop.y - lane.lateral.y * half - lane.inbound.y * 22 },
      { x: lane.stop.x + lane.lateral.x * half - lane.inbound.x * 22, y: lane.stop.y + lane.lateral.y * half - lane.inbound.y * 22 },
    ]
    ctx.fillStyle = ASPHALT
    ctx.beginPath()
    ctx.moveTo(corners[0].x, corners[0].y)
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y)
    ctx.closePath()
    ctx.fill()

    // center line separating incoming and outgoing halves
    ctx.strokeStyle = CENTER_LINE
    ctx.lineWidth = 2
    ctx.setLineDash([10, 8])
    ctx.beginPath()
    ctx.moveTo(lane.stop.x + lane.inbound.x * ROAD_LEN, lane.stop.y + lane.inbound.y * ROAD_LEN)
    ctx.lineTo(lane.stop.x - lane.inbound.x * 22, lane.stop.y - lane.inbound.y * 22)
    ctx.stroke()
    ctx.setLineDash([])

    // dashed lane dividers within each half
    ctx.strokeStyle = MARKING
    ctx.lineWidth = 1
    ctx.setLineDash([6, 6])
    for (let l = 1; l < app.lanes; l++) {
      const off = l * LANE_PX
      ctx.beginPath()
      ctx.moveTo(lane.stop.x + lane.lateral.x * off + lane.inbound.x * ROAD_LEN, lane.stop.y + lane.lateral.y * off + lane.inbound.y * ROAD_LEN)
      ctx.lineTo(lane.stop.x + lane.lateral.x * off - lane.inbound.x * 22, lane.stop.y + lane.lateral.y * off - lane.inbound.y * 22)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(lane.stop.x - lane.lateral.x * off + lane.inbound.x * ROAD_LEN, lane.stop.y - lane.lateral.y * off + lane.inbound.y * ROAD_LEN)
      ctx.lineTo(lane.stop.x - lane.lateral.x * off - lane.inbound.x * 22, lane.stop.y - lane.lateral.y * off - lane.inbound.y * 22)
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

    // stop bar spans only the incoming half of the road
    const inW = app.lanes * LANE_PX
    ctx.strokeStyle = green ? GREEN : RED
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(lane.stop.x, lane.stop.y)
    ctx.lineTo(lane.stop.x + lane.lateral.x * inW, lane.stop.y + lane.lateral.y * inW)
    ctx.stroke()

    // traffic light head beside the road, facing incoming traffic:
    // a post with a red/green lens, placed on the incoming side
    const lx = lane.stop.x + lane.lateral.x * (inW + 14) + lane.inbound.x * 10
    const ly = lane.stop.y + lane.lateral.y * (inW + 14) + lane.inbound.y * 10
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.lineTo(lx - lane.inbound.x * 10, ly - lane.inbound.y * 10)
    ctx.stroke()
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.arc(lx, ly, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = green ? GREEN : RED
    ctx.beginPath()
    ctx.arc(lx, ly, 5, 0, Math.PI * 2)
    ctx.fill()

    // per-turn arrow painted on each movement's own lane
    app.movements.forEach((m, mi) => {
      const ml = geom.movementLanes.get(`${ai}:${mi}`)
      if (!ml) return
      const cx = ml.origin.x + lane.inbound.x * 24
      const cy = ml.origin.y + lane.inbound.y * 24
      const active = phase.movements.some((x) => x.approach === ai && x.movement === mi)
      drawTurnGlyph(ctx, m.turn, cx, cy, lane.inbound, active ? TURN_COLORS[m.turn] : GRAY)
    })
  })

  // moving cars
  cars.forEach((c) => {
    const [ai, mi] = c.key.split(':').map(Number)
    const m = junction.approaches[ai].movements[mi]
    ctx.save()
    ctx.translate(c.x, c.y)
    ctx.rotate(c.heading)
    ctx.fillStyle = c.crossing ? TURN_COLORS[m.turn] : '#fbbf24'
    ctx.fillRect(-6, -4, 12, 8)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 1
    ctx.strokeRect(-6, -4, 12, 8)
    ctx.restore()
  })

  // HUD and stats in a side panel, away from the roads
  const px = 470
  ctx.fillStyle = '#0f172acc'
  ctx.fillRect(px - 8, 10, 172, 200)
  ctx.fillStyle = '#e2e8f0'
  ctx.font = '13px sans-serif'
  ctx.fillText(`t = ${t.toFixed(1)}s`, px, 30)
  ctx.fillText(`Phase ${activePhase + 1}, green left ${greenLeft.toFixed(0)}s`, px, 50)
  ctx.fillText(`Cycle: ${plan.greenSec.join('/')}s`, px, 70)

  // live stats per movement
  const stats = carSim.stats()
  const labelOf = (key: string) => {
    const [ai, mi] = key.split(':').map(Number)
    const app = junction.approaches[ai]
    const heading = ['N', 'E', 'S', 'W'][Math.round(((app.heading % 360) + 360) % 360 / 90) % 4]
    const turn = app.movements[mi].turn[0].toUpperCase()
    return `${heading}${turn}`
  }
  ctx.font = '11px sans-serif'
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('Mov', px, 92)
  ctx.fillText('Queue', px + 42, 92)
  ctx.fillText('Flow/Demand', px + 90, 92)
  stats.forEach((s, i) => {
    const y = 106 + i * 15
    ctx.fillStyle = TURN_COLORS[s.turn] ?? '#e2e8f0'
    ctx.fillText(labelOf(s.key), px, y)
    ctx.fillStyle = '#e2e8f0'
    ctx.fillText(String(s.queued), px + 48, y)
    const ratio = s.demandVph > 0 ? Math.min(s.actualVph / s.demandVph, 1) : 0
    ctx.fillStyle = ratio >= 0.99 ? '#4ade80' : ratio >= 0.7 ? '#fbbf24' : '#f87171'
    ctx.fillRect(px + 90, y - 8, 60 * ratio, 8)
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    ctx.strokeRect(px + 90, y - 8, 60, 8)
  })

  // legend bottom-left, away from roads
  const lx2 = 14
  ctx.font = '11px sans-serif'
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('Legend', lx2, 596)
  const north = { x: 0, y: -1 }
  const legendGlyphs: [string, string][] = [
    ['left', 'left'],
    ['through', 'through'],
    ['right', 'right'],
  ]
  legendGlyphs.forEach(([turn, label], i) => {
    const y = 610 + i * 12
    drawTurnGlyph(ctx, turn, lx2 + 8, y, north, TURN_COLORS[turn])
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(label, lx2 + 22, y + 4)
  })
  ctx.fillStyle = '#fbbf24'
  ctx.fillRect(lx2 + 80, 606, 10, 8)
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('waiting car', lx2 + 96, 614)
}

function drawTurnGlyph(
  ctx: CanvasRenderingContext2D,
  turn: string,
  x: number,
  y: number,
  inbound: { x: number; y: number },
  color: string,
) {
  // glyph drawn assuming traffic flows upward (inbound = (0,-1))
  const angle = Math.atan2(inbound.y, inbound.x) - Math.atan2(-1, 0)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.strokeStyle = color
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
