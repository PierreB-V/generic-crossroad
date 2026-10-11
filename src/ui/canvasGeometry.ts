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
  /** direction from stop line outward, toward waiting cars */
  inbound: { x: number; y: number }
  /** lateral direction toward the incoming lanes (driver's right) */
  lateral: { x: number; y: number }
  heading: number
  /** full road width in px: lanes in + lanes out */
  width: number
}

export interface MovementLaneGeom {
  /** center line of this movement's lane, at the stop line */
  origin: { x: number; y: number }
  laneIndex: number
  laneWidth: number
}

export interface JunctionGeom {
  center: { x: number; y: number }
  box: number
  lanes: LaneGeom[]
  /** movement lane geometry keyed by `${approach}:${movement}` */
  movementLanes: Map<string, MovementLaneGeom>
}

export const LANE_PX = 16
/** road length from stop line outward */
export const ROAD_LEN = 230

export function layout(junction: Junction): JunctionGeom {
  const center = { x: 320, y: 320 }
  const box = 90
  const lanes: LaneGeom[] = junction.approaches.map((app) => {
    const v = HEADING_VEC[((app.heading % 360) + 360) % 360] ?? { x: 0, y: 1 }
    return {
      stop: { x: center.x + v.x * (box / 2), y: center.y + v.y * (box / 2) },
      inbound: { x: v.x, y: v.y },
      // driver travels along -inbound; driver's right side is this lateral
      lateral: { x: v.y, y: -v.x },
      heading: app.heading,
      width: app.lanes * LANE_PX * 2,
    }
  })
  const movementLanes = new Map<string, MovementLaneGeom>()
  junction.approaches.forEach((app, ai) => {
    const lane = lanes[ai]
    const halfW = lane.width / 2
    app.movements.forEach((_, mi) => {
      const laneIndex = Math.min(Math.floor((mi * app.lanes) / app.movements.length), app.lanes - 1)
      // incoming half spans lateral offsets [0, halfW]; lane centers inside it
      const offset = (laneIndex + 0.5) * LANE_PX
      movementLanes.set(`${ai}:${mi}`, {
        origin: {
          x: lane.stop.x + lane.lateral.x * offset,
          y: lane.stop.y + lane.lateral.y * offset,
        },
        laneIndex,
        laneWidth: LANE_PX,
      })
    })
    void halfW
  })
  return { center, box, lanes, movementLanes }
}
