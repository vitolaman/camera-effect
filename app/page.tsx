'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Download } from 'lucide-react'

type EffectType = 'none' | 'grayscale' | 'dither' | 'ascii' | 'pixelate'
type AsciiCharMode = 'gradient' | 'numbers'
type DitherMode = 'bayer' | 'halftone' | 'dotcross' | 'line'

const DITHER_MODES: { id: DitherMode; label: string }[] = [
  { id: 'bayer',    label: 'Bayer' },
  { id: 'halftone', label: 'Halftone' },
  { id: 'dotcross', label: 'Dot Cross' },
  { id: 'line',     label: 'Line' },
]

const ASCII_CHAR_MODES: { id: AsciiCharMode; label: string }[] = [
  { id: 'gradient', label: 'Gradient' },
  { id: 'numbers',  label: 'Numbers' },
]

interface EffectParams {
  grayscaleContrast: number
  ditherMode: DitherMode
  ditherScale: number
  ditherCellSize: number
  ditherFgColor: string
  ditherBgColor: string
  asciiBlockSize: number
  asciiCharMode: AsciiCharMode
  asciiColor: string
  pixelSize: number
}

const DEFAULT_PARAMS: EffectParams = {
  grayscaleContrast: 1,
  ditherMode: 'bayer',
  ditherScale: 1,
  ditherCellSize: 8,
  ditherFgColor: '#ffffff',
  ditherBgColor: '#000000',
  asciiBlockSize: 8,
  asciiCharMode: 'gradient',
  asciiColor: '#00ff00',
  pixelSize: 8,
}

const EFFECTS: { id: EffectType; label: string; desc: string }[] = [
  { id: 'none',      label: 'None',      desc: 'Raw camera feed' },
  { id: 'grayscale', label: 'Grayscale', desc: 'Luminance conversion' },
  { id: 'dither',    label: 'Dither',    desc: 'Ordered Bayer matrix' },
  { id: 'ascii',     label: 'ASCII',     desc: 'Character art' },
  { id: 'pixelate',  label: 'Pixelate',  desc: 'Block averaging' },
]

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [effect, setEffect] = useState<EffectType>('none')
  const [params, setParams] = useState<EffectParams>(DEFAULT_PARAMS)
  const effectRef = useRef<EffectType>('none')
  const paramsRef = useRef<EffectParams>(DEFAULT_PARAMS)
  const animationFrameRef = useRef<number>(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { effectRef.current = effect }, [effect])
  useEffect(() => { paramsRef.current = params }, [params])

  const setParam = <K extends keyof EffectParams>(key: K, value: EffectParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  const takeScreenshot = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `snapshot-${Date.now()}.png`
    link.click()
  }

  const startCountdown = () => {
    if (countdown !== null) return
    setCountdown(3)
    let current = 3
    const tick = () => {
      current -= 1
      if (current <= 0) {
        setCountdown(null)
        takeScreenshot()
      } else {
        setCountdown(current)
        countdownRef.current = setTimeout(tick, 1000)
      }
    }
    countdownRef.current = setTimeout(tick, 1000)
  }

  // Start camera stream and render loop
  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        // Set canvas size to match video
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }

        // Draw video to canvas
        ctx.drawImage(video, 0, 0)

        // Apply selected effect using refs so no restart needed
        const currentEffect = effectRef.current
        const p = paramsRef.current
        if (currentEffect !== 'none') {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data

          if (currentEffect === 'grayscale') {
            applyGrayscale(data, p.grayscaleContrast)
            ctx.putImageData(imageData, 0, 0)
          } else if (currentEffect === 'dither') {
            applyDither(ctx, imageData, canvas.width, canvas.height, p)
          } else if (currentEffect === 'ascii') {
            applyASCII(ctx, canvas.width, canvas.height, p.asciiBlockSize, p.asciiCharMode, p.asciiColor)
          } else if (currentEffect === 'pixelate') {
            applyPixelate(imageData, canvas.width, canvas.height, p.pixelSize)
            ctx.putImageData(imageData, 0, 0)
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(render)
    }

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
        if (video) {
          video.srcObject = stream
          video.onloadedmetadata = () => {
            video.play()
            render()
          }
        }
      } catch (err) {
        console.error('Error accessing camera:', err)
      }
    }

    startCamera()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (countdownRef.current) {
        clearTimeout(countdownRef.current)
      }
      if (video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [])

  return (
    <div className="flex h-screen bg-black text-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Hidden video element */}
      <video ref={videoRef} className="hidden" playsInline />

      {/* Canvas area */}
      <div className="flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-cover"
          width={640}
          height={480}
        />
      </div>

      {/* Right Sidebar */}
      <aside className="w-72 flex flex-col shrink-0 border-l border-neutral-800 bg-neutral-950">
        {/* Sidebar header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center gap-2.5">
          <Camera size={15} className="text-neutral-400" />
          <span className="text-sm font-medium tracking-tight">Cam Effect</span>
        </div>

        {/* Scrollable controls */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
          {/* Effect selector */}
          <section>
            <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-2.5">Effect</p>
            <div className="space-y-0.5">
              {EFFECTS.map(e => (
                <button
                  key={e.id}
                  onClick={() => setEffect(e.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-all duration-150 ${
                    effect === e.id
                      ? 'bg-white text-black font-medium'
                      : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  <span>{e.label}</span>
                  {effect === e.id && (
                    <span className="text-[11px] text-neutral-500 font-normal">{e.desc}</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Per-effect sliders */}
          {effect !== 'none' && (
            <section>
              <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-4">Parameters</p>
              <div className="space-y-6">
                {effect === 'grayscale' && (
                  <ParamSlider
                    label="Contrast"
                    hint="Amplifies difference from mid-gray"
                    value={params.grayscaleContrast}
                    min={0.5} max={2} step={0.05}
                    display={params.grayscaleContrast.toFixed(2) + '×'}
                    onChange={v => setParam('grayscaleContrast', v)}
                  />
                )}
                {effect === 'dither' && (
                  <>
                    {/* Dither mode */}
                    <div>
                      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-2">Mode</p>
                      <div className="grid grid-cols-2 gap-1">
                        {DITHER_MODES.map(m => (
                          <button
                            key={m.id}
                            onClick={() => setParam('ditherMode', m.id)}
                            className={`px-2.5 py-1.5 rounded text-xs transition-all duration-150 ${
                              params.ditherMode === m.id
                                ? 'bg-white text-black font-medium'
                                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Threshold — Bayer only */}
                    {params.ditherMode === 'bayer' && (
                      <ParamSlider
                        label="Threshold"
                        hint="Bayer matrix sensitivity"
                        value={params.ditherScale}
                        min={0.1} max={2} step={0.05}
                        display={params.ditherScale.toFixed(2) + '×'}
                        onChange={v => setParam('ditherScale', v)}
                      />
                    )}

                    {/* Cell size — non-bayer modes */}
                    {params.ditherMode !== 'bayer' && (
                      <ParamSlider
                        label="Cell Size"
                        hint="Sampling grid resolution"
                        value={params.ditherCellSize}
                        min={4} max={32} step={2}
                        display={params.ditherCellSize + 'px'}
                        onChange={v => setParam('ditherCellSize', v)}
                      />
                    )}

                    {/* Foreground color */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-neutral-200">Foreground</span>
                        <span className="text-xs font-mono text-neutral-400">{params.ditherFgColor}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <input
                          type="color"
                          value={params.ditherFgColor}
                          onChange={e => setParam('ditherFgColor', e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <div className="flex gap-1.5 flex-wrap">
                          {['#ffffff','#00ff00','#ff4444','#44aaff','#ffaa00','#ff44ff'].map(c => (
                            <button key={c} onClick={() => setParam('ditherFgColor', c)} title={c}
                              style={{ background: c }}
                              className={`w-5 h-5 rounded-sm transition-all ${params.ditherFgColor === c ? 'ring-1 ring-white ring-offset-1 ring-offset-neutral-950' : ''}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Background color */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-neutral-200">Background</span>
                        <span className="text-xs font-mono text-neutral-400">{params.ditherBgColor}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <input
                          type="color"
                          value={params.ditherBgColor}
                          onChange={e => setParam('ditherBgColor', e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <div className="flex gap-1.5 flex-wrap">
                          {['#000000','#0a0a0a','#001a00','#00001a','#1a0000','#1a001a'].map(c => (
                            <button key={c} onClick={() => setParam('ditherBgColor', c)} title={c}
                              style={{ background: c, border: '1px solid #333' }}
                              className={`w-5 h-5 rounded-sm transition-all ${params.ditherBgColor === c ? 'ring-1 ring-white ring-offset-1 ring-offset-neutral-950' : ''}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
                {effect === 'ascii' && (
                  <>
                    {/* Char mode selector */}
                    <div>
                      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-2">Char Set</p>
                      <div className="grid grid-cols-2 gap-1">
                        {ASCII_CHAR_MODES.map(m => (
                          <button
                            key={m.id}
                            onClick={() => setParam('asciiCharMode', m.id)}
                            className={`px-2.5 py-1.5 rounded text-xs transition-all duration-150 ${
                              params.asciiCharMode === m.id
                                ? 'bg-white text-black font-medium'
                                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color picker */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-neutral-200">Font Color</span>
                        <span className="text-xs font-mono text-neutral-400">{params.asciiColor}</span>
                      </div>
                      <p className="text-[11px] text-neutral-600 mb-2.5">Character fill color</p>
                      <div className="flex items-center gap-2.5">
                        <input
                          type="color"
                          value={params.asciiColor}
                          onChange={e => setParam('asciiColor', e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <div className="flex gap-1.5 flex-wrap">
                          {['#00ff00','#ffffff','#ff4444','#44aaff','#ffaa00','#ff44ff'].map(c => (
                            <button
                              key={c}
                              onClick={() => setParam('asciiColor', c)}
                              title={c}
                              style={{ background: c }}
                              className={`w-5 h-5 rounded-sm transition-all ${
                                params.asciiColor === c ? 'ring-1 ring-white ring-offset-1 ring-offset-neutral-950' : ''
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Font / block size */}
                    <ParamSlider
                      label="Font Size"
                      hint="Character cell resolution"
                      value={params.asciiBlockSize}
                      min={4} max={24} step={2}
                      display={params.asciiBlockSize + 'px'}
                      onChange={v => setParam('asciiBlockSize', v)}
                    />
                  </>
                )}
                {effect === 'pixelate' && (
                  <ParamSlider
                    label="Pixel Size"
                    hint="Block averaging resolution"
                    value={params.pixelSize}
                    min={2} max={64} step={2}
                    display={params.pixelSize + 'px'}
                    onChange={v => setParam('pixelSize', v)}
                  />
                )}
              </div>
            </section>
          )}
        </div>

        {/* Footer — Take Picture */}
        <div className="px-5 py-4 border-t border-neutral-800">
          <button
            onClick={startCountdown}
            disabled={countdown !== null}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-white hover:bg-neutral-100 active:bg-neutral-200 disabled:opacity-60 disabled:cursor-not-allowed text-black text-sm font-medium transition-colors duration-150"
          >
            {countdown !== null ? (
              <>
                <span className="text-base font-bold tabular-nums">{countdown}</span>
                <span>Taking photo…</span>
              </>
            ) : (
              <>
                <Download size={14} />
                Take Picture
              </>
            )}
          </button>
        </div>
      </aside>
    </div>
  )
}

function ParamSlider({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  hint: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm text-neutral-200">{label}</span>
        <span className="text-xs font-mono text-neutral-400">{display}</span>
      </div>
      <p className="text-[11px] text-neutral-600 mb-2.5">{hint}</p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-[3px] rounded-full appearance-none cursor-pointer accent-white bg-neutral-700"
      />
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-neutral-600">{min}</span>
        <span className="text-[10px] text-neutral-600">{max}</span>
      </div>
    </div>
  )
}

// Apply grayscale effect
function applyGrayscale(data: Uint8ClampedArray, contrast: number) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    // Apply contrast: scale around mid-gray (128)
    const adjusted = Math.round(Math.min(255, Math.max(0, (gray - 128) * contrast + 128)))

    data[i] = adjusted
    data[i + 1] = adjusted
    data[i + 2] = adjusted
  }
}

// Apply dither effect (all modes)
function applyDither(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  width: number,
  height: number,
  p: EffectParams,
) {
  const { data } = imageData

  // Build grayscale map
  const grays = new Uint8Array(width * height)
  for (let i = 0; i < data.length; i += 4) {
    grays[i >> 2] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
  }

  const fg = p.ditherFgColor
  const bg = p.ditherBgColor

  if (p.ditherMode === 'bayer') {
    const bayer = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ]
    // Parse fg/bg into rgb components for imageData manipulation
    const toRgb = (hex: string) => {
      const n = parseInt(hex.replace('#', ''), 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const [fr, fg2, fb] = toRgb(fg)
    const [br, bg2, bb] = toRgb(bg)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const gray = grays[y * width + x]
        const threshold = (bayer[y % 4][x % 4] / 16) * 255 * p.ditherScale
        const on = gray > threshold
        data[idx]     = on ? fr : br
        data[idx + 1] = on ? fg2 : bg2
        data[idx + 2] = on ? fb : bb
      }
    }
    ctx.putImageData(imageData, 0, 0)
    return
  }

  // For canvas-draw modes: fill background first
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = fg

  const cell = p.ditherCellSize

  if (p.ditherMode === 'halftone') {
    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        const cx = x + cell / 2
        const cy = y + cell / 2
        const gray = grays[Math.min(Math.floor(cy), height - 1) * width + Math.min(Math.floor(cx), width - 1)] ?? 0
        const radius = (gray / 255) * (cell / 2) * 0.95
        if (radius < 0.5) continue
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else if (p.ditherMode === 'dotcross') {
    ctx.font = `${cell}px monospace`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        const cx = x + cell / 2
        const cy = y + cell / 2
        const gray = grays[Math.min(Math.floor(cy), height - 1) * width + Math.min(Math.floor(cx), width - 1)] ?? 0
        // 3 symbol tiers: dark → '.', mid → 'o', bright → 'x'
        const char = gray < 85 ? '.' : gray < 170 ? 'o' : 'x'
        ctx.fillText(char, cx, cy)
      }
    }
    // reset defaults
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
  } else if (p.ditherMode === 'line') {
    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        const gray = grays[Math.min(y + Math.floor(cell / 2), height - 1) * width + x] ?? 0
        // Line thickness proportional to luminance
        const thickness = Math.max(0.5, (gray / 255) * cell * 0.9)
        const midY = y + cell / 2
        ctx.fillRect(x, midY - thickness / 2, cell, thickness)
      }
    }
  }
}

// Apply ASCII art effect
function applyASCII(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  blockSize: number,
  charMode: AsciiCharMode,
  color: string,
) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  // Grayscale pass
  const grays = new Uint8Array(width * height)
  for (let i = 0; i < data.length; i += 4) {
    grays[i >> 2] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
  }

  // Black background
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)

  const GRADIENT = ' .:-=+*#%@'
  const NUMBERS  = '0123456789'

  ctx.fillStyle = color
  ctx.font = `${blockSize}px monospace`
  ctx.textBaseline = 'top'

  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      const gray = grays[y * width + x] ?? 0
      let char: string

      if (charMode === 'gradient') {
        char = GRADIENT[Math.floor((gray / 255) * (GRADIENT.length - 1))]
      } else {
        char = NUMBERS[Math.floor((gray / 255) * (NUMBERS.length - 1))]
      }

      ctx.fillText(char, x, y)
    }
  }
}

// Apply pixelation effect
function applyPixelate(imageData: ImageData, width: number, height: number, pixelSize: number) {
  const { data } = imageData

  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      const idx = (y * width + x) * 4

      // Get average color in block
      let r = 0,
        g = 0,
        b = 0,
        count = 0

      for (let dy = 0; dy < pixelSize && y + dy < height; dy++) {
        for (let dx = 0; dx < pixelSize && x + dx < width; dx++) {
          const i = ((y + dy) * width + (x + dx)) * 4
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          count++
        }
      }

      // Apply average color to entire block
      const avgR = Math.round(r / count)
      const avgG = Math.round(g / count)
      const avgB = Math.round(b / count)

      for (let dy = 0; dy < pixelSize && y + dy < height; dy++) {
        for (let dx = 0; dx < pixelSize && x + dx < width; dx++) {
          const i = ((y + dy) * width + (x + dx)) * 4
          data[i] = avgR
          data[i + 1] = avgG
          data[i + 2] = avgB
        }
      }
    }
  }
}
