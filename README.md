# Generic Crossroad

Optimize traffic-signal timing at a crossroad with a genetic algorithm.

- Define a junction: approaches, lanes, turning movements and demand (veh/h).
- A queue-based mesoscopic simulator scores any signal plan (average delay).
- A genetic algorithm evolves phase durations and phase order to minimize delay.
- 2D canvas visualization shows the junction, lights and queued cars.

<img width="611" height="389" alt="image" src="https://github.com/user-attachments/assets/6bd793ce-2d0b-4403-904a-89fa9db4fa13" />

## Dev

```bash
npm install
npm run dev
```

## Structure

- `src/model` — junction definition, phase groups, demand
- `src/sim` — queue-based simulator and metrics
- `src/ga` — genome encoding, fitness, genetic algorithm
- `src/ui` — React app: editor, optimizer controls, canvas view
