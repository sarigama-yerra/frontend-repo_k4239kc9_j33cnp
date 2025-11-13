import { useEffect, useRef, useState } from 'react'

function App() {
  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const [running, setRunning] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [hud, setHud] = useState({ speed: 0, distance: 0, score: 0, fuel: 100, best: 0 })
  const inputRef = useRef({ left: false, right: false, up: false, down: false })

  const gameRef = useRef({
    w: 0,
    h: 0,
    road: { left: 0, right: 0, laneCount: 3, laneWidth: 0, scroll: 0 },
    car: { x: 0, y: 0, w: 36, h: 60, vx: 0, vy: 0, speed: 0, angle: 0 },
    traffic: [],
    pickups: [],
    lastSpawn: 0,
    lastPickupSpawn: 0,
    distance: 0,
    score: 0,
    fuel: 100,
    difficulty: 1,
  })

  const resetGame = () => {
    const canvas = canvasRef.current
    const g = gameRef.current
    g.w = canvas.width
    g.h = canvas.height
    const margin = Math.max(20, Math.min(g.w * 0.08, 60))
    g.road.left = margin
    g.road.right = g.w - margin
    g.road.laneCount = 3
    g.road.laneWidth = (g.road.right - g.road.left) / g.road.laneCount
    g.road.scroll = 0

    g.car.w = Math.max(26, Math.min(40, g.w * 0.08))
    g.car.h = g.car.w * 1.6
    g.car.x = (g.road.left + g.road.right) / 2 - g.car.w / 2
    g.car.y = g.h - g.car.h - 30
    g.car.vx = 0
    g.car.vy = 0
    g.car.speed = 0
    g.car.angle = 0

    g.traffic = []
    g.pickups = []
    g.lastSpawn = 0
    g.lastPickupSpawn = 0
    g.distance = 0
    g.score = 0
    g.fuel = 100
    g.difficulty = 1

    setHud({ speed: 0, distance: 0, score: 0, fuel: 100, best: getBestScore() })
    setGameOver(false)
  }

  const getBestScore = () => {
    const s = localStorage.getItem('driving_best')
    return s ? parseInt(s) : 0
  }
  const setBestScore = (v) => localStorage.setItem('driving_best', String(v))

  const resize = () => {
    const canvas = canvasRef.current
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const rectW = Math.min(window.innerWidth, 900)
    const rectH = Math.min(window.innerHeight, 700)
    canvas.width = rectW * dpr
    canvas.height = rectH * dpr
    canvas.style.width = rectW + 'px'
    canvas.style.height = rectH + 'px'
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    resetGame()
  }

  useEffect(() => {
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Input handling
  useEffect(() => {
    const onKey = (e, down) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current.left = down
      if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current.right = down
      if (e.code === 'ArrowUp' || e.code === 'KeyW') inputRef.current.up = down
      if (e.code === 'ArrowDown' || e.code === 'KeyS') inputRef.current.down = down
      if (down && e.code === 'Space' && gameOver) start()
      if (down && e.code === 'Enter' && !running) start()
      e.preventDefault()
    }
    const preventScroll = (e) => e.preventDefault()
    window.addEventListener('keydown', (e) => onKey(e, true), { passive: false })
    window.addEventListener('keyup', (e) => onKey(e, false), { passive: false })
    window.addEventListener('touchmove', preventScroll, { passive: false })
    return () => {
      window.removeEventListener('keydown', (e) => onKey(e, true))
      window.removeEventListener('keyup', (e) => onKey(e, false))
      window.removeEventListener('touchmove', preventScroll)
    }
  }, [running, gameOver])

  // Mobile controls helpers
  const press = (dir, down) => {
    inputRef.current[dir] = down
  }

  const rand = (min, max) => Math.random() * (max - min) + min

  const spawnTraffic = (t) => {
    const g = gameRef.current
    const lane = Math.floor(rand(0, g.road.laneCount))
    const x = g.road.left + lane * g.road.laneWidth + g.road.laneWidth * 0.5
    const carW = Math.max(24, g.car.w * rand(0.85, 1.1))
    const carH = carW * rand(1.4, 1.8)
    const v = rand(1.5, 4) * g.difficulty
    g.traffic.push({ x: x - carW / 2, y: -carH - 20, w: carW, h: carH, vy: v, color: randColor() })
    g.lastSpawn = t
  }

  const spawnPickup = (t) => {
    const g = gameRef.current
    const lane = Math.floor(rand(0, g.road.laneCount))
    const x = g.road.left + lane * g.road.laneWidth + g.road.laneWidth * 0.5
    const size = Math.max(14, g.car.w * 0.6)
    g.pickups.push({ x: x - size / 2, y: -size - 20, w: size, h: size, vy: 2.5, type: Math.random() < 0.7 ? 'fuel' : 'coin' })
    g.lastPickupSpawn = t
  }

  const randColor = () => {
    const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#06b6d4', '#8b5cf6']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

  const draw = (ctx) => {
    const g = gameRef.current
    // background
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, g.w, g.h)

    // road
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(g.road.left, 0, g.road.right - g.road.left, g.h)

    // lane markings
    const dashH = 24
    const gap = 24
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 4
    ctx.setLineDash([dashH, gap])
    for (let i = 1; i < g.road.laneCount; i++) {
      const x = g.road.left + i * g.road.laneWidth
      ctx.beginPath()
      ctx.moveTo(x, -dashH + (g.road.scroll % (dashH + gap)))
      ctx.lineTo(x, g.h)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // car (player)
    const car = g.car
    ctx.save()
    ctx.translate(car.x + car.w / 2, car.y + car.h / 2)
    ctx.rotate((car.angle * Math.PI) / 180)
    ctx.fillStyle = '#38bdf8'
    roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 6, true)
    // windshield
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    roundRect(ctx, -car.w * 0.35, -car.h * 0.3, car.w * 0.7, car.h * 0.35, 4, true)
    // tail lights
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(-car.w * 0.4, car.h * 0.45, car.w * 0.8, 4)
    ctx.restore()

    // traffic
    for (const t of g.traffic) {
      ctx.save()
      ctx.fillStyle = t.color
      roundRect(ctx, t.x, t.y, t.w, t.h, 6, true)
      ctx.restore()
    }

    // pickups
    for (const p of g.pickups) {
      ctx.save()
      if (p.type === 'fuel') {
        ctx.fillStyle = '#22c55e'
      } else {
        ctx.fillStyle = '#f59e0b'
      }
      roundRect(ctx, p.x, p.y, p.w, p.h, 6, true)
      ctx.restore()
    }
  }

  const roundRect = (ctx, x, y, w, h, r, fill = false) => {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
    if (fill) ctx.fill()
    else ctx.stroke()
  }

  const update = (dt, t) => {
    const g = gameRef.current
    const car = g.car
    const inp = inputRef.current

    // update difficulty gradually
    g.difficulty = 1 + Math.min(2.5, g.distance / 3000)

    // car control
    const maxSpeed = 10
    const accel = 0.2
    const brake = 0.3
    const friction = 0.06

    if (inp.up) car.speed += accel
    if (inp.down) car.speed -= brake
    car.speed = Math.max(0, Math.min(maxSpeed, car.speed))

    // horizontal control
    const steer = (inp.left ? -1 : 0) + (inp.right ? 1 : 0)
    car.vx += steer * 0.9
    car.vx *= 0.85

    car.x += car.vx
    car.y -= (car.speed - 3) * 0.2 // small vertical shift just for angle feel

    // angle for feel
    car.angle = steer * 8

    // keep car within road
    const minX = gameRef.current.road.left + 8
    const maxX = gameRef.current.road.right - car.w - 8
    car.x = Math.max(minX, Math.min(maxX, car.x))

    // road scroll based on speed
    g.road.scroll += car.speed * 2

    // spawn traffic
    if (t - g.lastSpawn > Math.max(300, 900 / g.difficulty)) {
      spawnTraffic(t)
    }
    // spawn pickups
    if (t - g.lastPickupSpawn > Math.max(800, 1600 / g.difficulty)) {
      spawnPickup(t)
    }

    // move traffic
    for (const tr of g.traffic) {
      tr.y += tr.vy + car.speed * 0.6
    }
    // move pickups
    for (const p of g.pickups) {
      p.y += p.vy + car.speed * 0.6
    }

    // remove offscreen
    g.traffic = g.traffic.filter((tr) => tr.y < g.h + 80)
    g.pickups = g.pickups.filter((p) => p.y < g.h + 80)

    // collisions
    for (const tr of g.traffic) {
      if (rectsOverlap(car, tr)) {
        endGame()
        return
      }
    }

    // pickups collection
    for (let i = g.pickups.length - 1; i >= 0; i--) {
      const p = g.pickups[i]
      if (rectsOverlap(car, p)) {
        if (p.type === 'fuel') {
          g.fuel = Math.min(100, g.fuel + 25)
        } else {
          g.score += 100
        }
        g.pickups.splice(i, 1)
      }
    }

    // fuel consumption
    g.fuel -= (0.02 + car.speed * 0.01) * dt * 0.06
    if (g.fuel <= 0) {
      endGame()
      return
    }

    // distance and score
    g.distance += car.speed * dt * 0.06
    g.score += Math.floor(car.speed)

    setHud((prev) => ({
      speed: Math.round(car.speed * 10),
      distance: Math.floor(g.distance),
      score: g.score,
      fuel: Math.max(0, Math.round(g.fuel)),
      best: prev.best,
    }))
  }

  const loop = (t) => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const g = gameRef.current

    if (!loop.prev) loop.prev = t
    const dt = Math.min(32, t - loop.prev)
    loop.prev = t

    update(dt, t)
    draw(ctx)

    if (running) rafRef.current = requestAnimationFrame(loop)
  }

  const start = () => {
    resetGame()
    setRunning(true)
    rafRef.current = requestAnimationFrame(loop)
  }

  const endGame = () => {
    setRunning(false)
    setGameOver(true)
    const g = gameRef.current
    const best = getBestScore()
    if (g.score > best) setBestScore(g.score)
    setHud((prev) => ({ ...prev, best: Math.max(best, g.score) }))
  }

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div className="min-h-screen w-full bg-slate-900 text-white flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-5xl aspect-[9/7] bg-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* HUD */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-sm sm:text-base">
          <div className="flex gap-3 sm:gap-4">
            <Badge label="Speed" value={`${hud.speed} km/h`} color="bg-sky-500/20 text-sky-200" />
            <Badge label="Distance" value={`${hud.distance} m`} color="bg-emerald-500/20 text-emerald-200" />
            <Badge label="Score" value={hud.score} color="bg-amber-500/20 text-amber-200" />
            <Badge label="Fuel" value={`${hud.fuel}%`} color={hud.fuel > 30 ? 'bg-lime-500/20 text-lime-200' : 'bg-rose-500/20 text-rose-200'} />
          </div>
          <div>
            <Badge label="Best" value={hud.best} color="bg-fuchsia-500/20 text-fuchsia-200" />
          </div>
        </div>

        {/* Start overlay */}
        {!running && !gameOver && (
          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
            <div className="text-center p-6 rounded-xl bg-white/5 border border-white/10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">Arcade Driving</h2>
              <p className="text-white/70 mb-4">Avoid traffic, collect fuel and coins, go as far as you can.</p>
              <div className="text-white/70 text-sm mb-4 space-y-1">
                <p>Keyboard: Arrow keys or WASD</p>
                <p>Mobile: Tap/hold the on-screen controls</p>
              </div>
              <button onClick={start} className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded">Start</button>
            </div>
          </div>
        )}

        {/* Game over */}
        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm">
            <div className="text-center p-6 rounded-xl bg-white/5 border border-white/10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">Game Over</h2>
              <p className="text-white/70 mb-4">Score: {hud.score} • Best: {hud.best}</p>
              <button onClick={start} className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded">Play Again</button>
            </div>
          </div>
        )}

        {/* Mobile controls */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex gap-3">
            <Pad label="◀" onDown={() => press('left', true)} onUp={() => press('left', false)} />
            <Pad label="▶" onDown={() => press('right', true)} onUp={() => press('right', false)} />
          </div>
          <div className="flex gap-3">
            <Pad label="▲" onDown={() => press('up', true)} onUp={() => press('up', false)} />
            <Pad label="▼" onDown={() => press('down', true)} onUp={() => press('down', false)} />
          </div>
        </div>
      </div>

      <div className="mt-4 text-white/60 text-sm text-center">
        <p>Inspired by classic lane-driving games. Built for keyboard and touch.</p>
      </div>
    </div>
  )
}

function Badge({ label, value, color }) {
  return (
    <div className={`px-3 py-1.5 rounded-md border border-white/10 ${color} shadow backdrop-blur pointer-events-none`}>
      <span className="uppercase tracking-wide text-[10px] mr-2 text-white/60">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

function Pad({ label, onDown, onUp }) {
  return (
    <button
      className="pointer-events-auto w-14 h-14 rounded-full bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/15 text-xl backdrop-blur flex items-center justify-center select-none"
      onMouseDown={() => onDown?.()}
      onMouseUp={() => onUp?.()}
      onMouseLeave={() => onUp?.()}
      onTouchStart={(e) => { e.preventDefault(); onDown?.() }}
      onTouchEnd={(e) => { e.preventDefault(); onUp?.() }}
    >
      {label}
    </button>
  )
}

export default App
