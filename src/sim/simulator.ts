import type { Junction, MovementRef, SimMetrics } from '../model/types'

interface QueueState {
  queue: number
  arrivals: number
  cleared: number
  totalWaitSec: number
  maxQueue: number
}

export interface SimOptions {
  /** simulated time horizon, seconds */
  horizonSec: number
  /** fixed RNG seed for repeatable fitness */
  seed: number
}

export interface SimResult {
  metrics: SimMetrics
  /** queue length per movement over time, sampled per step */
  queueHistory: number[][]
  /** movement refs aligned with queueHistory rows */
  movements: MovementRef[]
  /** green windows per phase: [start, end] in seconds */
  greenWindows: { phase: number; start: number; end: number }[]
  cycleSec: number
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Queue-based mesoscopic simulation with per-second steps.
 * Poisson arrivals per movement, saturation-flow discharge while green.
 */
export function simulate(
  junction: Junction,
  plan: { phases: { movements: MovementRef[] }[]; greenSec: number[] },
  opts: SimOptions,
): SimResult {
  const movements: MovementRef[] = []
  junction.approaches.forEach((app, ai) =>
    app.movements.forEach((_, mi) => movements.push({ approach: ai, movement: mi })),
  )
  const idxOf = new Map<string, number>()
  movements.forEach((m, i) => idxOf.set(`${m.approach}:${m.movement}`, i))

  const states: QueueState[] = movements.map(() => ({
    queue: 0,
    arrivals: 0,
    cleared: 0,
    totalWaitSec: 0,
    maxQueue: 0,
  }))

  const greenWindows: SimResult['greenWindows'] = []
  const queueHistory: number[][] = movements.map(() => [])

  const rng = mulberry32(opts.seed)
  const rates = movements.map((m) => {
    const mov = junction.approaches[m.approach].movements[m.movement]
    return mov.demandVph / 3600
  })
  const caps = movements.map((m) => {
    const app = junction.approaches[m.approach]
    const mov = app.movements[m.movement]
    return mov.saturationVph * app.lanes / 3600
  })

  const phaseOf = new Map<string, number>()
  plan.phases.forEach((ph, pi) =>
    ph.movements.forEach((m) => phaseOf.set(`${m.approach}:${m.movement}`, pi)),
  )

  let t = 0
  let phaseIdx = 0
  let phaseT = 0

  while (t < opts.horizonSec) {
    const green = plan.greenSec[phaseIdx]
    if (phaseT === 0) greenWindows.push({ phase: phaseIdx, start: t, end: t + green })
    const isGreen = phaseT < green

    for (let i = 0; i < movements.length; i++) {
      const rate = rates[i]
      if (rng() < rate) {
        states[i].queue += 1
        states[i].arrivals += 1
      }
      const key = `${movements[i].approach}:${movements[i].movement}`
      if (isGreen && phaseOf.get(key) === phaseIdx && states[i].queue > 0 && rng() < caps[i]) {
        states[i].queue -= 1
        states[i].cleared += 1
      }
      states[i].totalWaitSec += states[i].queue
      if (states[i].queue > states[i].maxQueue) states[i].maxQueue = states[i].queue
      queueHistory[i].push(states[i].queue)
    }

    t += 1
    phaseT += 1
    if (phaseT >= green + (phaseIdx < plan.phases.length - 1 ? junction.amberSec : 0)) {
      phaseIdx = (phaseIdx + 1) % plan.phases.length
      phaseT = 0
    }
  }

  const arrived = states.reduce((s, q) => s + q.arrivals, 0)
  const cleared = states.reduce((s, q) => s + q.cleared, 0)
  const leftover = states.reduce((s, q) => s + q.queue, 0)
  const totalDelay = states.reduce((s, q) => s + q.totalWaitSec, 0)

  return {
    metrics: {
      arrived,
      cleared,
      totalDelaySec: totalDelay,
      avgDelaySec: cleared > 0 ? totalDelay / cleared : 0,
      maxQueue: states.reduce((m, q) => Math.max(m, q.maxQueue), 0),
      leftover,
    },
    queueHistory,
    movements,
    greenWindows,
    cycleSec: plan.greenSec.reduce((s, g) => s + g + junction.amberSec, 0),
  }
}
