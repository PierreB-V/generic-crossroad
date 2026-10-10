import type { Junction, MovementRef, Phase, SignalPlan } from './types'

const HEADING_VECTORS: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: -1 },
  90: { x: 1, y: 0 },
  180: { x: 0, y: 1 },
  270: { x: -1, y: 0 },
}

/** Normalized travel vector for a movement leaving the junction. */
export function movementVector(junction: Junction, ref: MovementRef): { x: number; y: number } {
  const app = junction.approaches[ref.approach]
  const incoming = HEADING_VECTORS[((app.heading % 360) + 360) % 360] ?? { x: 0, y: 0 }
  const inv = { x: -incoming.x, y: -incoming.y }
  const turn = app.movements[ref.movement].turn
  if (turn === 'through') return inv
  // rotate inv by +/-90 degrees; right turn = clockwise in screen coords
  const s = turn === 'right' ? 1 : -1
  return { x: inv.y * s, y: -inv.x * s }
}

function crossing(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const dot = a.x * b.x + a.y * b.y
  return dot >= 0.99
}

/** Two movements conflict if their paths are not compatible (simplified). */
export function conflicts(junction: Junction, a: MovementRef, b: MovementRef): boolean {
  if (a.approach === b.approach) return true
  const va = movementVector(junction, a)
  const vb = movementVector(junction, b)
  const straightA = junction.approaches[a.approach].movements[a.movement].turn === 'through'
  const straightB = junction.approaches[b.approach].movements[b.movement].turn === 'through'
  if (straightA && straightB) {
    // opposing straights never conflict
    if (Math.abs(va.x * vb.x + va.y * vb.y + 1) < 0.01) return false
    return true
  }
  return !crossing(va, vb)
}

/** Greedy build of conflict-free phases from all movements. */
export function buildPhases(junction: Junction): Phase[] {
  const all: MovementRef[] = []
  junction.approaches.forEach((app, ai) =>
    app.movements.forEach((_, mi) => all.push({ approach: ai, movement: mi })),
  )
  const remaining = [...all]
  const phases: Phase[] = []
  while (remaining.length > 0) {
    const phase: MovementRef[] = []
    const used = new Set<number>()
    let progress = true
    while (progress) {
      progress = false
      for (let i = 0; i < remaining.length; i++) {
        if (used.has(i)) continue
        const candidate = remaining[i]
        if (phase.every((p) => !conflicts(junction, p, candidate))) {
          phase.push(candidate)
          used.add(i)
          progress = true
        }
      }
    }
    phases.push({ movements: phase })
    for (let i = remaining.length - 1; i >= 0; i--) if (used.has(i)) remaining.splice(i, 1)
  }
  return phases
}

export function planFromGenome(phases: Phase[], order: number[], green: number[]): SignalPlan {
  return {
    phases: order.map((i) => phases[i]),
    greenSec: order.map((_, i) => green[i]),
  }
}

export function planCycleLength(plan: SignalPlan, amberSec: number): number {
  return plan.greenSec.reduce((s, g) => s + g + amberSec, 0)
}
