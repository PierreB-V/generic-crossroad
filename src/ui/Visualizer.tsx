import { useEffect, useRef, useState } from 'react'
import type { Junction, Phase, SignalPlan } from '../model/types'
import { layout } from './canvasGeometry'
import { drawJunction } from './canvasRender'
import { CarSim } from './carSim'

interface Props {
  junction: Junction
  phases: Phase[]
  optimizedPlan: SignalPlan | null
  baselinePlan: SignalPlan
}

export function Visualizer({ junction, phases, optimizedPlan, baselinePlan }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<'optimized' | 'baseline'>(optimizedPlan ? 'optimized' : 'baseline')
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const timeRef = useRef(0)
  const rafRef = useRef(0)
  const lastRef = useRef(0)

  const plan = mode === 'optimized' && optimizedPlan ? optimizedPlan : baselinePlan
  const cycleSec = plan.greenSec.reduce((s, g) => s + g + junction.amberSec, 0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const geom = layout(junction)
    const carSim = new CarSim(junction, geom)

    const frame = (ts: number) => {
      const dt = lastRef.current ? Math.min((ts - lastRef.current) / 1000, 0.1) : 0
      lastRef.current = ts
      if (playing) {
        timeRef.current = (timeRef.current + dt * speed) % (cycleSec || 1)
      }
      const t = timeRef.current
      const { phaseIdx, greenLeft } = phaseAt(plan, junction.amberSec, t)
      if (playing) {
        const green = new Set<string>()
        plan.phases[phaseIdx].movements.forEach((m) => green.add(`${m.approach}:${m.movement}`))
        carSim.step(dt * speed, green)
      }
      drawJunction(ctx, junction, geom, phases, phaseIdx, greenLeft, plan, t, carSim.positions(), carSim)
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [junction, phases, plan, playing, speed, cycleSec])

  return (
    <div className="visualizer">
      <section className="panel controls">
        <h2>Signal plan</h2>
        <div className="row">
          <button className={mode === 'optimized' ? 'toggle active' : 'toggle'}
            disabled={!optimizedPlan}
            onClick={() => setMode('optimized')}>Optimized</button>
          <button className={mode === 'baseline' ? 'toggle active' : 'toggle'}
            onClick={() => setMode('baseline')}>Baseline (equal split)</button>
        </div>
        <div className="row">
          <button className="toggle active" onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
          <label>Speed
            <input type="range" min={0.25} max={4} step={0.25} value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))} />
          </label>
        </div>
        <div className="plan">
          {plan.phases.map((p, i) => (
            <div key={i} className="phase">
              <strong>Ph {i + 1}</strong> {plan.greenSec[i]}s
              <div className="movements">
                {p.movements.map((m, j) => (
                  <span className="tag" key={j}>{label(junction, m)}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="hint">Cycle: {cycleSec}s. Amber: {junction.amberSec}s between phases.</p>
      </section>
      <canvas ref={canvasRef} width={640} height={640} />
    </div>
  )
}

function label(junction: Junction, m: { approach: number; movement: number }): string {
  const app = junction.approaches[m.approach]
  const heading = ['N', 'E', 'S', 'W'][Math.round(((app.heading % 360) + 360) % 360 / 90) % 4]
  return `${heading}${app.movements[m.movement].turn[0].toUpperCase()}`
}

export function phaseAt(plan: SignalPlan, amberSec: number, t: number): { phaseIdx: number; greenLeft: number } {
  let remaining = t
  for (let i = 0; i < plan.phases.length; i++) {
    const green = plan.greenSec[i]
    if (remaining < green) return { phaseIdx: i, greenLeft: green - remaining }
    remaining -= green + amberSec
  }
  return { phaseIdx: 0, greenLeft: plan.greenSec[0] }
}
