import { useState } from 'react'
import type { Junction, Phase, SignalPlan } from '../model/types'
import { runGA, type GAProgress } from '../ga/ga'

interface Props {
  junction: Junction
  phases: Phase[]
  onResult: (plan: SignalPlan, score: number, history: GAProgress[]) => void
}

export function Optimizer({ junction, phases, onResult }: Props) {
  const [populationSize, setPopulationSize] = useState(60)
  const [generations, setGenerations] = useState(80)
  const [mutationRate, setMutationRate] = useState(0.25)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<GAProgress[]>([])
  const [current, setCurrent] = useState(0)

  function evolve() {
    setRunning(true)
    setProgress([])
    setTimeout(() => {
      const { best, history } = runGA(
        junction,
        phases,
        { horizonSec: 600, seed: 7, leftoverPenalty: 5 },
        { populationSize, generations, tournamentSize: 3, mutationRate, eliteCount: 3 },
        42,
        (p) => {
          setProgress((prev) => [...prev, p])
          setCurrent(p.generation + 1)
        },
      )
      onResult(
        { phases: best.order.map((i) => phases[i]), greenSec: best.green },
        history[history.length - 1]?.bestScore ?? 0,
        history,
      )
      setRunning(false)
    }, 30)
  }

  const best = progress.length > 0 ? progress[progress.length - 1].bestScore : null
  const chart = progress.slice(-200)

  return (
    <div className="optimizer">
      <section className="panel">
        <h2>GA parameters</h2>
        <div className="row">
          <label>Population
            <input type="number" min={10} max={300} value={populationSize}
              onChange={(e) => setPopulationSize(clamp(e.target.value, 10, 300))} />
          </label>
          <label>Generations
            <input type="number" min={5} max={500} value={generations}
              onChange={(e) => setGenerations(clamp(e.target.value, 5, 500))} />
          </label>
          <label>Mutation rate
            <input type="number" min={0.01} max={1} step={0.05} value={mutationRate}
              onChange={(e) => setMutationRate(clamp(e.target.value, 0.01, 1))} />
          </label>
        </div>
        <button className="primary" disabled={running} onClick={evolve}>
          {running ? `Evolving… (${current}/${generations})` : 'Evolve'}
        </button>
        {best !== null && <p>Best score (avg delay + penalty): <strong>{best.toFixed(1)}s</strong></p>}
      </section>

      <section className="panel">
        <h2>Fitness over generations</h2>
        {chart.length > 1 ? (
          <svg className="chart" viewBox="0 0 600 200" preserveAspectRatio="none">
            {polyline(chart.map((p) => p.bestScore), '#4ade80')}
            {polyline(chart.map((p) => p.avgScore), '#94a3b8')}
          </svg>
        ) : (
          <p className="hint">Run the evolution to see progress.</p>
        )}
        <div className="legend">
          <span className="dot green" /> best &nbsp;
          <span className="dot gray" /> average
        </div>
      </section>
    </div>
  )
}

function polyline(values: number[], color: string) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 600},${200 - ((v - min) / span) * 180}`)
    .join(' ')
  return <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
}

function clamp(v: string, min: number, max: number): number {
  const n = Number(v)
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}
