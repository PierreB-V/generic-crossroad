import { useMemo, useState } from 'react'
import type { Junction, MovementRef, Phase, SignalPlan } from './model/types'
import { buildPhases } from './model/phases'
import { simulate } from './sim/simulator'
import { Editor } from './ui/Editor'
import { Optimizer } from './ui/Optimizer'
import { Visualizer } from './ui/Visualizer'
import type { GAProgress } from './ga/ga'

export interface OptimizedPlan {
  plan: SignalPlan
  score: number
  history: GAProgress[]
}

export default function App() {
  const [junction, setJunction] = useState<Junction>(defaultJunction)
  const [optimized, setOptimized] = useState<OptimizedPlan | null>(null)
  const [tab, setTab] = useState<'editor' | 'optimize' | 'visualize'>('editor')

  const phases: Phase[] = useMemo(() => buildPhases(junction), [junction])
  const optimizedPlan: SignalPlan | null = optimized?.plan ?? null

  const baselinePlan: SignalPlan = useMemo(() => {
    const green = phases.map(() => Math.round(junction.cycleSec / phases.length))
    return { phases, greenSec: green }
  }, [phases, junction.cycleSec])


  return (
    <div className="app">
      <header className="header">
        <h1>Generic Crossroad</h1>
        <nav className="tabs">
          <button className={tab === 'editor' ? 'active' : ''} onClick={() => setTab('editor')}>Editor</button>
          <button className={tab === 'optimize' ? 'active' : ''} onClick={() => setTab('optimize')}>Optimize</button>
          <button className={tab === 'visualize' ? 'active' : ''} onClick={() => setTab('visualize')}>Visualize</button>
        </nav>
      </header>
      <main>
        {tab === 'editor' && <Editor junction={junction} onChange={setJunction} phases={phases} />}
        {tab === 'optimize' && (
          <Optimizer
            junction={junction}
            phases={phases}
            onResult={(plan, score, history) => {
              setOptimized({ plan, score, history })
              setTab('visualize')
            }}
          />
        )}
        {tab === 'visualize' && (
          <Visualizer
            junction={junction}
            phases={phases}
            optimizedPlan={optimizedPlan}
            baselinePlan={baselinePlan}
          />
        )}
      </main>
    </div>
  )
}

function defaultJunction(): Junction {
  return {
    approaches: [
      { heading: 0, lanes: 2, movements: [mk('through', 700), mk('left', 200), mk('right', 150)] },
      { heading: 90, lanes: 2, movements: [mk('through', 800), mk('left', 150), mk('right', 120)] },
      { heading: 180, lanes: 2, movements: [mk('through', 650), mk('left', 180), mk('right', 130)] },
      { heading: 270, lanes: 2, movements: [mk('through', 750), mk('left', 160), mk('right', 140)] },
    ],
    amberSec: 3,
    minGreenSec: 5,
    maxGreenSec: 90,
    cycleSec: 90,
  }
}

function mk(turn: 'left' | 'through' | 'right', vph: number) {
  return { turn, demandVph: vph, saturationVph: 1800 }
}

export function movementLabel(junction: Junction, ref: MovementRef): string {
  const app = junction.approaches[ref.approach]
  const heading = ['N', 'E', 'S', 'W'][Math.round(((app.heading % 360) + 360) % 360 / 90) % 4]
  const turn = app.movements[ref.movement].turn[0].toUpperCase()
  return `${heading}${turn}`
}

export function simulateBaseline(junction: Junction, plan: SignalPlan) {
  return simulate(junction, plan, { horizonSec: 600, seed: 7 })
}
