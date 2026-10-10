export type TurnDirection = 'left' | 'through' | 'right'

export interface Movement {
  turn: TurnDirection
  /** incoming demand, vehicles per hour */
  demandVph: number
  /** saturation flow, vehicles per hour per lane */
  saturationVph: number
}

export interface Approach {
  /** compass heading of the incoming direction, degrees; 0=N, 90=E */
  heading: number
  lanes: number
  /** which movements are allowed from this approach */
  movements: Movement[]
}

export interface Junction {
  approaches: Approach[]
  /** amber time between phases, seconds */
  amberSec: number
  minGreenSec: number
  maxGreenSec: number
  /** fixed cycle length target, seconds */
  cycleSec: number
}

/** A movement reference: approach index + movement index inside it. */
export interface MovementRef {
  approach: number
  movement: number
}

/** A phase is a set of movements that may run simultaneously. */
export interface Phase {
  movements: MovementRef[]
}

export interface SignalPlan {
  /** phases in order */
  phases: Phase[]
  /** green duration per phase, seconds, same length as phases */
  greenSec: number[]
}

export interface SimMetrics {
  /** total vehicles that cleared the junction */
  cleared: number
  /** total vehicles that arrived */
  arrived: number
  /** sum of delay over all vehicles, vehicle-seconds */
  totalDelaySec: number
  /** average delay per cleared vehicle, seconds */
  avgDelaySec: number
  /** worst queue length observed per movement */
  maxQueue: number
  /** vehicles still waiting at the end */
  leftover: number
}

export interface Genome {
  /** green durations per phase */
  green: number[]
  /** permutation of phase indices */
  order: number[]
}
