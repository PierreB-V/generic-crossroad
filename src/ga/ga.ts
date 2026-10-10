import type { Genome, Junction } from '../model/types'
import { fitness, type FitnessOptions } from './fitness'

export interface GAOptions {
  populationSize: number
  generations: number
  tournamentSize: number
  mutationRate: number
  eliteCount: number
}

export interface GAProgress {
  generation: number
  bestScore: number
  avgScore: number
}

function clampGreen(junction: Junction, v: number): number {
  return Math.max(junction.minGreenSec, Math.min(junction.maxGreenSec, Math.round(v)))
}

export function randomGenome(junction: Junction, phaseCount: number, rng: () => number): Genome {
  const range = junction.maxGreenSec - junction.minGreenSec
  const green = Array.from({ length: phaseCount }, () =>
    clampGreen(junction, junction.minGreenSec + rng() * range),
  )
  const order = Array.from({ length: phaseCount }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return { green, order }
}

function tournament(scores: number[], size: number, rng: () => number): number {
  let best = -1
  let bestScore = Infinity
  for (let k = 0; k < size; k++) {
    const i = Math.floor(rng() * scores.length)
    if (scores[i] < bestScore) {
      bestScore = scores[i]
      best = i
    }
  }
  return best
}

function crossover(a: Genome, b: Genome, rng: () => number): Genome {
  // uniform crossover on green durations
  const green = a.green.map((g, i) => (rng() < 0.5 ? g : b.green[i]))
  // order crossover (OX) on phase order
  const n = a.order.length
  const start = Math.floor(rng() * n)
  const end = start + Math.floor(rng() * (n - start))
  const childOrder: number[] = Array.from({ length: n }, () => -1)
  for (let i = start; i <= end; i++) childOrder[i] = a.order[i]
  let bi = 0
  for (let i = 0; i < n; i++) {
    if (childOrder[i] === -1) {
      while (childOrder.includes(b.order[bi])) bi++
      childOrder[i] = b.order[bi]
    }
  }
  return { green, order: childOrder }
}

function mutate(junction: Junction, g: Genome, rate: number, rng: () => number): Genome {
  const green = g.green.map((v) =>
    rng() < rate ? clampGreen(junction, v + (rng() - 0.5) * 20) : v,
  )
  const order = [...g.order]
  if (rng() < rate && order.length > 1) {
    const i = Math.floor(rng() * order.length)
    const j = Math.floor(rng() * order.length)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return { green, order }
}

/**
 * Runs the GA synchronously, calling onGeneration after each generation.
 */
export function runGA(
  junction: Junction,
  phases: { movements: { approach: number; movement: number }[] }[],
  fitOpts: FitnessOptions,
  gaOpts: GAOptions,
  seed = 42,
  onGeneration?: (progress: GAProgress, best: Genome) => void,
): { best: Genome; history: GAProgress[] } {
  let a = seed >>> 0
  const rng = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const population: Genome[] = Array.from({ length: gaOpts.populationSize }, () =>
    randomGenome(junction, phases.length, rng),
  )
  const history: GAProgress[] = []

  for (let gen = 0; gen < gaOpts.generations; gen++) {
    const scores = population.map((g) => fitness(junction, phases, g, fitOpts))
    const indexed = scores.map((s, i) => ({ s, i })).sort((x, y) => x.s - y.s)

    const bestScore = indexed[0].s
    const avgScore = scores.reduce((x, y) => x + y, 0) / scores.length
    history.push({ generation: gen, bestScore, avgScore })
    onGeneration?.({ generation: gen, bestScore, avgScore }, population[indexed[0].i])

    const next: Genome[] = []
    for (let e = 0; e < gaOpts.eliteCount && e < indexed.length; e++) {
      next.push({ ...population[indexed[e].i], green: [...population[indexed[e].i].green], order: [...population[indexed[e].i].order] })
    }
    while (next.length < gaOpts.populationSize) {
      const ai = tournament(scores, gaOpts.tournamentSize, rng)
      const bi = tournament(scores, gaOpts.tournamentSize, rng)
      const child = crossover(population[ai], population[bi], rng)
      next.push(mutate(junction, child, gaOpts.mutationRate, rng))
    }
    population.splice(0, population.length, ...next)
  }

  const scores = population.map((g) => fitness(junction, phases, g, fitOpts))
  let bestIdx = 0
  for (let i = 1; i < scores.length; i++) if (scores[i] < scores[bestIdx]) bestIdx = i
  return { best: population[bestIdx], history }
}
