import type { Junction } from '../model/types'

export const HEADING_VEC: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: -1 },
  90: { x: 1, y: 0 },
  180: { x: 0, y: 1 },
  270: { x: -1, y: 0 },
}

export interface LaneGeom {
  /** point where road meets junction box */
  stop: { x: number; y: number }
  /** direction from outside toward junction */
  inbound: { x: number; y: number }
  heading: number
}

export interface JunctionGeom {
  center: { x: number; y: number }
  box: number
  lanes: LaneGeom[]
}

export function layout(junction: Junction): JunctionGeom {
  const center = { x: 320, y: 320 }
  const box = 90
  const lanes: LaneGeom[] = junction.approaches.map((app) => {
    const v = HEADING_VEC[((app.heading % 360) + 360) % 360] ?? { x: 0, y: 1 }
    return {
      stop: { x: center.x + v.x * (box / 2), y: center.y + v.y * (box / 2) },
      inbound: { x: v.x, y: v.y },
      heading: app.heading,
    }
  })
  return { center, box, lanes }
}
