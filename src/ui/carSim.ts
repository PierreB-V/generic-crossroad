import type { Junction } from '../model/types'
import { HEADING_VEC, movementVector } from '../model/phases'
import { LANE_PX, type JunctionGeom } from './canvasGeometry'

export interface CarPos {
  x: number
  y: number
  /** radians, direction of travel */
  heading: number
  crossing: boolean
  /** `${approach}:${movement}` */
  key: string
}

interface Car {
  /** distance to stop line while inbound, px */
  dist: number
  /** distance travelled along crossing path, px */
  cross: number
}

interface Path {
  pts: { x: number; y: number }[]
  cum: number[]
  total: number
}

const SPEED = 55
const CROSS_SPEED = 70
const SPACING = 13
const SPAWN_DIST = 330
const MAX_QUEUE = 22

/**
 * Lightweight per-movement car animation: spawn by demand, drive down the
 * lane, queue at the stop line, discharge on green at saturation headway,
 * then cross the junction along a turn-specific curved path.
 */
export class CarSim {
  private inbound = new Map<string, Car[]>()
  private crossing = new Map<string, Car[]>()
  private spawnAcc = new Map<string, number>()
  private release = new Map<string, number>()
  private paths = new Map<string, Path>()
  private clearedPerKey = new Map<string, number>()
  cleared = 0
  simTime = 0

  constructor(
    private junction: Junction,
    private geom: JunctionGeom,
  ) {
    junction.approaches.forEach((app, ai) => {
      app.movements.forEach((_, mi) => {
        const key = `${ai}:${mi}`
        const lane = this.geom.lanes[ai]
        const ml = this.geom.movementLanes.get(key)!
        const laneIndex = ml.laneIndex
        const exit = movementVector(this.junction, { approach: ai, movement: mi })
        // destination approach: the one whose inbound matches the exit direction
        const destAi = this.junction.approaches.findIndex((app) => {
          const v = HEADING_VEC[((app.heading % 360) + 360) % 360]
          return v.x === exit.x && v.y === exit.y
        })
        // exit lane center: mirrored across the road center line (outgoing half)
        const exitLaneOffset = -(laneIndex + 0.5) * LANE_PX
        void destAi
        const exitEdgeStart = {
          x: this.geom.center.x + exit.x * (this.geom.box / 2) + this.geom.lanes[ai].lateral.x * exitLaneOffset,
          y: this.geom.center.y + exit.y * (this.geom.box / 2) + this.geom.lanes[ai].lateral.y * exitLaneOffset,
        }
        // quadratic curve from stop line through the box center to the exit lane start
        const pts: { x: number; y: number }[] = []
        const ctrl = {
          x: (ml.origin.x + exitEdgeStart.x) / 2,
          y: (ml.origin.y + exitEdgeStart.y) / 2,
        }
        for (let s = 0; s <= 16; s++) {
          const u = s / 16
          const a = 1 - u
          pts.push({
            x: a * a * ml.origin.x + 2 * a * u * ctrl.x + u * u * exitEdgeStart.x,
            y: a * a * ml.origin.y + 2 * a * u * ctrl.y + u * u * exitEdgeStart.y,
          })
        }
        // straight exit lane away from the junction
        const steps = Math.ceil(SPAWN_DIST / 30)
        for (let s = 1; s <= steps; s++) {
          const u = s / steps
          pts.push({
            x: exitEdgeStart.x + exit.x * SPAWN_DIST * u,
            y: exitEdgeStart.y + exit.y * SPAWN_DIST * u,
          })
        }
        const cum = [0]
        for (let i = 1; i < pts.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
        }
        this.paths.set(key, { pts, cum, total: cum[cum.length - 1] })
        this.inbound.set(key, [])
        this.crossing.set(key, [])
        this.spawnAcc.set(key, 0)
        this.release.set(key, 0)
        this.clearedPerKey.set(key, 0)
        void lane
      })
    })
  }

  step(dt: number, green: Set<string>) {
    this.simTime += dt
    this.junction.approaches.forEach((app, ai) => {
      app.movements.forEach((m, mi) => {
        const key = `${ai}:${mi}`
        const cars = this.inbound.get(key)!

        // Poisson-ish spawning from demand
        const acc = this.spawnAcc.get(key)! + (m.demandVph / 3600) * dt
        if (acc >= 1 && cars.length < MAX_QUEUE) {
          cars.push({ dist: SPAWN_DIST, cross: 0 })
          this.spawnAcc.set(key, acc - 1)
        } else {
          this.spawnAcc.set(key, Math.min(acc, 1))
        }

        // front of queue = smallest distance
        cars.sort((a, b) => a.dist - b.dist)

        // discharge while green at saturation headway
        const rel = Math.max(0, this.release.get(key)! - dt)
        if (green.has(key) && cars.length > 0 && cars[0].dist <= 0.5 && rel <= 0) {
          const car = cars.shift()!
          car.cross = 0
          this.crossing.get(key)!.push(car)
          this.release.set(key, 3600 / Math.max(m.saturationVph, 1))
          this.clearedPerKey.set(key, this.clearedPerKey.get(key)! + 1)
        } else {
          this.release.set(key, rel)
        }

        // car following: stop at the line or behind the car ahead
        for (let i = 0; i < cars.length; i++) {
          const limit = i === 0 ? 0 : cars[i - 1].dist + SPACING
          cars[i].dist = Math.max(cars[i].dist - SPEED * dt, limit)
        }

        // crossing and exiting
        const cr = this.crossing.get(key)!
        const path = this.paths.get(key)!
        for (let i = cr.length - 1; i >= 0; i--) {
          cr[i].cross += CROSS_SPEED * dt
          if (cr[i].cross >= path.total) {
            cr.splice(i, 1)
            this.cleared++
          }
        }
      })
    })
  }

  /** Live stats per movement: queue length, measured outflow vs demand. */
  stats(): {
    key: string
    turn: string
    queued: number
    demandVph: number
    actualVph: number
  }[] {
    const out: {
      key: string
      turn: string
      queued: number
      demandVph: number
      actualVph: number
    }[] = []
    this.junction.approaches.forEach((app, ai) => {
      app.movements.forEach((m, mi) => {
        const key = `${ai}:${mi}`
        const cleared = this.clearedPerKey.get(key) ?? 0
        out.push({
          key,
          turn: m.turn,
          queued: this.inbound.get(key)?.length ?? 0,
          demandVph: m.demandVph,
          actualVph: this.simTime > 5 ? (cleared / this.simTime) * 3600 : 0,
        })
      })
    })
    return out
  }

  positions(): CarPos[] {
    const out: CarPos[] = []
    this.inbound.forEach((cars, key) => {
      const [ai] = key.split(':').map(Number)
      const lane = this.geom.lanes[ai]
      const ml = this.geom.movementLanes.get(key)!
      cars.forEach((c) =>
        out.push({
          x: ml.origin.x + lane.inbound.x * c.dist,
          y: ml.origin.y + lane.inbound.y * c.dist,
          heading: Math.atan2(lane.inbound.y, lane.inbound.x),
          crossing: false,
          key,
        }),
      )
    })
    this.crossing.forEach((cars, key) => {
      const path = this.paths.get(key)!
      cars.forEach((c) => {
        const p = sample(path, c.cross)
        const q = sample(path, Math.min(c.cross + 6, path.total))
        out.push({
          x: p.x,
          y: p.y,
          heading: Math.atan2(q.y - p.y, q.x - p.x),
          crossing: true,
          key,
        })
      })
    })
    return out
  }
}

function sample(path: Path, d: number): { x: number; y: number } {
  const target = Math.max(0, Math.min(d, path.total))
  for (let i = 1; i < path.cum.length; i++) {
    if (path.cum[i] >= target) {
      const seg = path.cum[i] - path.cum[i - 1] || 1
      const u = (target - path.cum[i - 1]) / seg
      const a = path.pts[i - 1]
      const b = path.pts[i]
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }
    }
  }
  return path.pts[path.pts.length - 1]
}
