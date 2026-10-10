import type { Genome, Junction, Phase } from '../model/types'
import { simulate } from '../sim/simulator'
import type { SimResult } from '../sim/simulator'

export interface FitnessOptions {
  horizonSec: number
  seed: number
  /** penalty per leftover vehicle at horizon end */
  leftoverPenalty: number
}

/** Lower is better. */
export function fitness(
  junction: Junction,
  phases: Phase[],
  genome: Genome,
  opts: FitnessOptions,
): number {
  const plan = {
    phases: genome.order.map((i) => phases[i]),
    greenSec: genome.green,
  }
  const res = simulate(junction, plan, { horizonSec: opts.horizonSec, seed: opts.seed })
  return (
    res.metrics.avgDelaySec + res.metrics.leftover * opts.leftoverPenalty
  )
}

export function bestOfPopulation(
  junction: Junction,
  phases: Phase[],
  population: Genome[],
  opts: FitnessOptions,
): { genome: Genome; score: number } {
  let best = { genome: population[0], score: Infinity }
  for (const g of population) {
    const s = fitness(junction, phases, g, opts)
    if (s < best.score) best = { genome: g, score: s }
  }
  return best
}

export function resultForGenome(
  junction: Junction,
  phases: Phase[],
  genome: Genome,
  opts: FitnessOptions,
): { score: number; result: SimResult } {
  const plan = {
    phases: genome.order.map((i) => phases[i]),
    greenSec: genome.green,
  }
  const result = simulate(junction, plan, { horizonSec: opts.horizonSec, seed: opts.seed })
  return { score: result.metrics.avgDelaySec + result.metrics.leftover * opts.leftoverPenalty, result }
}
