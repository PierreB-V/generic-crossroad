import type { Junction, Phase } from '../model/types'
import { movementLabel } from '../App'

interface Props {
  junction: Junction
  onChange: (j: Junction) => void
  phases: Phase[]
}

const HEADINGS = [0, 90, 180, 270]

export function Editor({ junction, onChange, phases }: Props) {
  function updateApproach(i: number, patch: Partial<Junction['approaches'][number]>) {
    const approaches = junction.approaches.map((a, ai) => (ai === i ? { ...a, ...patch } : a))
    onChange({ ...junction, approaches })
  }

  function updateMovement(ai: number, mi: number, patch: Partial<{ demandVph: number }>) {
    const approaches = junction.approaches.map((a, i) =>
      i === ai
        ? { ...a, movements: a.movements.map((m, j) => (j === mi ? { ...m, ...patch } : m)) }
        : a,
    )
    onChange({ ...junction, approaches })
  }

  function toggleApproach(i: number) {
    const has = junction.approaches.some((a) => a.heading === HEADINGS[i])
    if (has) {
      if (junction.approaches.length <= 1) return
      onChange({ ...junction, approaches: junction.approaches.filter((a) => a.heading !== HEADINGS[i]) })
    } else {
      const def = { heading: HEADINGS[i], lanes: 1, movements: [{ turn: 'through' as const, demandVph: 500, saturationVph: 1800 }] }
      onChange({ ...junction, approaches: [...junction.approaches, def] })
    }
  }

  const headingName = (h: number) => ['North', 'East', 'South', 'West'][HEADINGS.indexOf(h)]

  return (
    <div className="editor">
      <section className="panel">
        <h2>Junction definition</h2>
        <div className="row">
          {HEADINGS.map((h, i) => {
            const active = junction.approaches.some((a) => a.heading === h)
            return (
              <button key={h} className={active ? 'toggle active' : 'toggle'} onClick={() => toggleApproach(i)}>
                {headingName(h)}
              </button>
            )
          })}
        </div>
        <div className="row">
          <label>Amber (s)
            <input type="number" min={1} max={10} value={junction.amberSec}
              onChange={(e) => onChange({ ...junction, amberSec: clampNum(e.target.value, 1, 10) })} />
          </label>
          <label>Min green (s)
            <input type="number" min={3} max={30} value={junction.minGreenSec}
              onChange={(e) => onChange({ ...junction, minGreenSec: clampNum(e.target.value, 3, 30) })} />
          </label>
          <label>Max green (s)
            <input type="number" min={30} max={180} value={junction.maxGreenSec}
              onChange={(e) => onChange({ ...junction, maxGreenSec: clampNum(e.target.value, 30, 180) })} />
          </label>
        </div>
      </section>

      {junction.approaches.map((app, ai) => (
        <section className="panel" key={app.heading}>
          <h2>{headingName(app.heading)} approach</h2>
          <div className="row">
            <label>Lanes
              <input type="number" min={1} max={4} value={app.lanes}
                onChange={(e) => updateApproach(ai, { lanes: clampNum(e.target.value, 1, 4) })} />
            </label>
            {app.movements.map((m, mi) => (
              <label key={m.turn}>
                {m.turn} (veh/h)
                <input type="number" min={0} max={3000} step={10} value={m.demandVph}
                  onChange={(e) => updateMovement(ai, mi, { demandVph: clampNum(e.target.value, 0, 3000) })} />
              </label>
            ))}
          </div>
        </section>
      ))}

      <section className="panel">
        <h2>Detected phases</h2>
        <p className="hint">Movements grouped to run together (greedy conflict-free grouping).</p>
        <div className="phases">
          {phases.map((p, pi) => (
            <div className="phase" key={pi}>
              <strong>Phase {pi + 1}</strong>
              <div className="movements">
                {p.movements.map((m, i) => (
                  <span className="tag" key={i}>{movementLabel(junction, m)}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function clampNum(v: string, min: number, max: number): number {
  const n = Math.round(Number(v))
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}
