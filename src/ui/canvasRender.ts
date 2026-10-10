import type { Junction, Phase, SignalPlan } from '../model/types'
import type { JunctionGeom } from './canvasGeometry'

const TURN_COLORS: Record<string, string> = {
  left: '#38bdf8',
  through: '#a3e635',
  right: '#f472b6',
}

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

  // per-approach lights and queue bars
  junction.approaches.forEach((app, ai) => {
    const lane = geom.lanes[ai]
    const phase = phases[activePhase]
    const green = app.movements.some((_, mi) =>
      phase.movements.some((m) => m.approach === ai && m.movement === mi),
    )
    const lightX = lane.stop.x + lane.inbound.x * 12
    const lightY = lane.stop.y + lane.inbound.y * 12
    ctx.fillStyle = green ? '#4ade80' : '#ef4444'
    ctx.beginPath()
    ctx.arc(lightX, lightY, 8, 0, Math.PI * 2)
    ctx.fill()

    // movement arrows with per-turn colors
    app.movements.forEach((m, mi) => {
      const active = phase.movements.some((x) => x.approach === ai && x.movement === mi)
      const ox = lane.stop.x - lane.inbound.x * 20 + lane.inbound.y * 14 * mi
      const oy = lane.stop.y - lane.inbound.y * 20 - lane.inbound.x * 14 * mi
      ctx.fillStyle = active ? TURN_COLORS[m.turn] : '#64748b'
      ctx.beginPath()
      ctx.arc(ox, oy, 5, 0, Math.PI * 2)
      ctx.fill()
    })
  })

  // queue dots along each approach, driven by plan timing
  junction.approaches.forEach((app, ai) => {
    const lane = geom.lanes[ai]
    const isGreen = app.movements.some((_, mi) =>
      phases[activePhase].movements.some((m) => m.approach === ai && m.movement === mi),
    )
    const demand = app.movements.reduce((s, m) => s + m.demandVph, 0) / 3600
    const queueLen = isGreen
      ? Math.max(0, Math.round(demand * (30 - greenLeft) * 0.3))
      : Math.round(demand * (t % 40) * 0.5)
    for (let q = 0; q < Math.min(queueLen, 12); q++) {
      const px = lane.stop.x + lane.inbound.x * (18 + q * 14) + lane.inbound.y * 20
      const py = lane.stop.y + lane.inbound.y * (18 + q * 14) - lane.inbound.x * 20
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
}
