'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Download, SlidersHorizontal, X } from 'lucide-react'

type EffectType = 'none' | 'grayscale' | 'negative' | 'dither' | 'ascii' | 'pixelate' | 'rgbshift' | 'heatvision'
type AsciiCharMode = 'gradient' | 'numbers'
type DitherMode = 'bayer' | 'halftone' | 'dotcross' | 'line'
type PhotoSize = 'normal' | 'square' | 'story'

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

const PHOTO_SIZES: { id: PhotoSize; label: string; desc: string }[] = [
  { id: 'normal', label: 'Normal', desc: 'Use the device camera aspect ratio' },
  { id: 'square', label: 'Square', desc: '1:1 crop' },
  { id: 'story', label: 'Instagram Story', desc: '9:16 crop' },
]

const APP_GATE_HASH = 'fe604600879c2512397964183c848337e9ba366ead980e4542dc7d0adf2b9ccd'

interface EffectParams {
  grayscaleContrast: number
  heatIntensity: number
  heatBands: number
  ditherMode: DitherMode
  ditherScale: number
  ditherCellSize: number
  ditherFgColor: string
  ditherBgColor: string
  asciiBlockSize: number
  asciiCharMode: AsciiCharMode
  asciiColor: string
  pixelSize: number
  rgbShiftX: number
  rgbShiftY: number
  rgbGlitchLines: number
  rgbScanlines: boolean
}

const DEFAULT_PARAMS: EffectParams = {
  grayscaleContrast: 1,
  heatIntensity: 1,
  heatBands: 9,
  ditherMode: 'bayer',
  ditherScale: 1,
  ditherCellSize: 8,
  ditherFgColor: '#ffffff',
  ditherBgColor: '#000000',
  asciiBlockSize: 8,
  asciiCharMode: 'gradient',
  asciiColor: '#00ff00',
  pixelSize: 8,
  rgbShiftX: 8,
  rgbShiftY: 2,
  rgbGlitchLines: 4,
  rgbScanlines: true,
}

const EFFECTS: { id: EffectType; label: string; desc: string }[] = [
  { id: 'none',      label: 'None',      desc: 'Raw camera feed' },
  { id: 'grayscale', label: 'Grayscale', desc: 'Luminance conversion' },
  { id: 'negative',  label: 'Negative',  desc: 'Film negative inversion' },
  { id: 'heatvision', label: 'Heat Vision', desc: 'Thermal false color map' },
  { id: 'dither',    label: 'Dither',    desc: 'Ordered Bayer matrix' },
  { id: 'ascii',     label: 'ASCII',     desc: 'Character art' },
  { id: 'pixelate',  label: 'Pixelate',  desc: 'Block averaging' },
  { id: 'rgbshift',  label: 'RGB Shift', desc: 'Broken VHS channels' },
]

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameImageRef = useRef<HTMLImageElement | null>(null)
  const [effect, setEffect] = useState<EffectType>('dither')
  const [photoSize, setPhotoSize] = useState<PhotoSize>('story')
  const [params, setParams] = useState<EffectParams>(DEFAULT_PARAMS)
  const [showFrame, setShowFrame] = useState(true)
  const effectRef = useRef<EffectType>('dither')
  const photoSizeRef = useRef<PhotoSize>('story')
  const paramsRef = useRef<EffectParams>(DEFAULT_PARAMS)
  const showFrameRef = useRef(true)
  const animationFrameRef = useRef<number>(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isCheckingPassword, setIsCheckingPassword] = useState(false)

  useEffect(() => { effectRef.current = effect }, [effect])
  useEffect(() => { photoSizeRef.current = photoSize }, [photoSize])
  useEffect(() => { paramsRef.current = params }, [params])
  useEffect(() => { showFrameRef.current = showFrame }, [showFrame])

  useEffect(() => {
    const frame = new Image()
    frame.src = '/forareason.png'
    frameImageRef.current = frame
  }, [])

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

  const submitGatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isCheckingPassword) return

    setPasswordError('')
    setIsCheckingPassword(true)

    try {
      const hashedInput = await sha256(passwordInput.trim())
      if (hashedInput === APP_GATE_HASH) {
        setIsUnlocked(true)
        setPasswordInput('')
      } else {
        setPasswordError('Wrong password')
      }
    } catch {
      setPasswordError('Unable to verify password')
    } finally {
      setIsCheckingPassword(false)
    }
  }

  // Start camera stream and render loop
  useEffect(() => {
    if (!isUnlocked) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const frame = getPhotoFrame(
          video.videoWidth,
          video.videoHeight,
          photoSizeRef.current,
        )

        if (canvas.width !== frame.targetWidth || canvas.height !== frame.targetHeight) {
          canvas.width = frame.targetWidth
          canvas.height = frame.targetHeight
        }

        // Draw video to canvas (flipped horizontally to remove mirror effect)
        ctx.setTransform(-1, 0, 0, 1, canvas.width, 0)
        ctx.drawImage(
          video,
          frame.sourceX,
          frame.sourceY,
          frame.sourceWidth,
          frame.sourceHeight,
          0,
          0,
          canvas.width,
          canvas.height,
        )
        ctx.setTransform(1, 0, 0, 1, 0, 0)

        // Apply selected effect using refs so no restart needed
        const currentEffect = effectRef.current
        const p = paramsRef.current
        if (currentEffect !== 'none') {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data

          if (currentEffect === 'grayscale') {
            applyGrayscale(data, p.grayscaleContrast)
            ctx.putImageData(imageData, 0, 0)
          } else if (currentEffect === 'negative') {
            applyNegative(data)
            ctx.putImageData(imageData, 0, 0)
          } else if (currentEffect === 'heatvision') {
            applyHeatVision(data, p.heatIntensity, p.heatBands)
            ctx.putImageData(imageData, 0, 0)
          } else if (currentEffect === 'dither') {
            applyDither(ctx, imageData, canvas.width, canvas.height, p)
          } else if (currentEffect === 'ascii') {
            applyASCII(ctx, canvas.width, canvas.height, p.asciiBlockSize, p.asciiCharMode, p.asciiColor)
          } else if (currentEffect === 'pixelate') {
            applyPixelate(imageData, canvas.width, canvas.height, p.pixelSize)
            ctx.putImageData(imageData, 0, 0)
          } else if (currentEffect === 'rgbshift') {
            applyRGBShift(ctx, canvas.width, canvas.height, p)
          }
        }

        if (showFrameRef.current && frameImageRef.current?.complete) {
          const frameSize = 150
          const frameMargin = 20
          ctx.drawImage(
            frameImageRef.current,
            canvas.width - frameSize - frameMargin,
            canvas.height - frameSize - frameMargin,
            frameSize,
            frameSize,
          )
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
  }, [isUnlocked])

  const sidebarControls = (
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

      <section>
        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-2.5">Photo Size</p>
        <div className="space-y-0.5">
          {PHOTO_SIZES.map(size => (
            <button
              key={size.id}
              onClick={() => setPhotoSize(size.id)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 ${
                photoSize === size.id
                  ? 'bg-white text-black font-medium'
                  : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <span>{size.label}</span>
              {photoSize === size.id && (
                <span className="text-[11px] text-neutral-500 font-normal text-right">{size.desc}</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Per-effect parameters */}
      {effect !== 'none' && effect !== 'negative' && (
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
            {effect === 'heatvision' && (
              <>
                <ParamSlider
                  label="Intensity"
                  hint="How aggressively temperatures are separated"
                  value={params.heatIntensity}
                  min={0.6} max={2.5} step={0.05}
                  display={params.heatIntensity.toFixed(2) + '×'}
                  onChange={v => setParam('heatIntensity', v)}
                />
                <ParamSlider
                  label="Bands"
                  hint="Number of visible thermal color steps"
                  value={params.heatBands}
                  min={4} max={16} step={1}
                  display={String(Math.round(params.heatBands))}
                  onChange={v => setParam('heatBands', v)}
                />
              </>
            )}
            {effect === 'dither' && (
              <>
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
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-neutral-200">Foreground</span>
                    <span className="text-xs font-mono text-neutral-400">{params.ditherFgColor}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input type="color" value={params.ditherFgColor}
                      onChange={e => setParam('ditherFgColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {['#ff4444','#ffffff','#00ff00','#44aaff','#ffaa00','#ff44ff'].map(c => (
                        <button key={c} onClick={() => setParam('ditherFgColor', c)} title={c}
                          style={{ background: c }}
                          className={`w-5 h-5 rounded-sm transition-all ${params.ditherFgColor === c ? 'ring-1 ring-white ring-offset-1 ring-offset-neutral-950' : ''}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-neutral-200">Background</span>
                    <span className="text-xs font-mono text-neutral-400">{params.ditherBgColor}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <input type="color" value={params.ditherBgColor}
                      onChange={e => setParam('ditherBgColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {['#2624ae','#0a0a0a','#001a00','#00001a','#1a0000','#1a001a'].map(c => (
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
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-neutral-200">Font Color</span>
                    <span className="text-xs font-mono text-neutral-400">{params.asciiColor}</span>
                  </div>
                  <p className="text-[11px] text-neutral-600 mb-2.5">Character fill color</p>
                  <div className="flex items-center gap-2.5">
                    <input type="color" value={params.asciiColor}
                      onChange={e => setParam('asciiColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {['#00ff00','#ffffff','#ff4444','#44aaff','#ffaa00','#ff44ff'].map(c => (
                        <button key={c} onClick={() => setParam('asciiColor', c)} title={c}
                          style={{ background: c }}
                          className={`w-5 h-5 rounded-sm transition-all ${params.asciiColor === c ? 'ring-1 ring-white ring-offset-1 ring-offset-neutral-950' : ''}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
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
            {effect === 'rgbshift' && (
              <>
                <ParamSlider
                  label="Horizontal Shift"
                  hint="Channel offset on the X axis"
                  value={params.rgbShiftX}
                  min={0} max={40} step={1}
                  display={params.rgbShiftX + 'px'}
                  onChange={v => setParam('rgbShiftX', v)}
                />
                <ParamSlider
                  label="Vertical Shift"
                  hint="Channel offset on the Y axis"
                  value={params.rgbShiftY}
                  min={0} max={20} step={1}
                  display={params.rgbShiftY + 'px'}
                  onChange={v => setParam('rgbShiftY', v)}
                />
                <ParamSlider
                  label="Glitch Lines"
                  hint="Number of horizontal glitch slices"
                  value={params.rgbGlitchLines}
                  min={0} max={20} step={1}
                  display={String(params.rgbGlitchLines)}
                  onChange={v => setParam('rgbGlitchLines', v)}
                />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-200">Scanlines</p>
                    <p className="text-[11px] text-neutral-600">CRT horizontal lines overlay</p>
                  </div>
                  <button
                    onClick={() => setParam('rgbScanlines', !params.rgbScanlines)}
                    className={`w-10 h-5.5 rounded-full relative transition-colors duration-200 ${params.rgbScanlines ? 'bg-white' : 'bg-neutral-700'}`}
                    style={{ width: 36, height: 20 }}
                  >
                    <span
                      className="absolute top-0.5 rounded-full bg-black transition-transform duration-200"
                      style={{ width: 16, height: 16, left: 2, transform: params.rgbScanlines ? 'translateX(16px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      <section>
        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-3">Overlay</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-200">Frame</p>
            <p className="text-[11px] text-neutral-600">Show forareason overlay</p>
          </div>
          <button
            onClick={() => setShowFrame(v => !v)}
            className={`w-10 h-5.5 rounded-full relative transition-colors duration-200 ${showFrame ? 'bg-white' : 'bg-neutral-700'}`}
            style={{ width: 36, height: 20 }}
            aria-label="Toggle frame overlay"
          >
            <span
              className="absolute top-0.5 rounded-full bg-black transition-transform duration-200"
              style={{ width: 16, height: 16, left: 2, transform: showFrame ? 'translateX(16px)' : 'translateX(0)' }}
            />
          </button>
        </div>
      </section>
    </div>
  )

  const takeButton = (
    <button
      onClick={startCountdown}
      disabled={countdown !== null}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-white hover:bg-neutral-100 active:bg-neutral-200 disabled:opacity-60 disabled:cursor-not-allowed text-black text-sm font-medium transition-colors duration-150"
    >
      {countdown !== null ? (
        <span>Taking photo…</span>
      ) : (
        <>
          <Download size={14} />
          Take Picture
        </>
      )}
    </button>
  )

  return (
    <div className="relative flex flex-col md:flex-row h-screen overflow-hidden bg-black text-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {!isUnlocked && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center px-5">
          <form
            onSubmit={submitGatePassword}
            className="w-full max-w-sm border border-neutral-800 bg-neutral-950 rounded-xl p-6 space-y-5"
          >
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest">Protected Access</p>
              <h1 className="text-xl font-semibold tracking-tight">Enter Password</h1>
              <p className="text-sm text-neutral-400">Input password to open camera app.</p>
            </div>

            <div>
              <label htmlFor="gate-password" className="sr-only">Password</label>
              <input
                id="gate-password"
                type="password"
                value={passwordInput}
                onChange={e => {
                  setPasswordInput(e.target.value)
                  if (passwordError) setPasswordError('')
                }}
                autoFocus
                className="w-full rounded-md border border-neutral-700 bg-black px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-white"
                placeholder="Password"
                autoComplete="current-password"
              />
              {passwordError && (
                <p className="mt-2 text-xs text-red-400">{passwordError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isCheckingPassword || !passwordInput.trim()}
              className="w-full rounded-md bg-white text-black text-sm font-medium py-2.5 hover:bg-neutral-100 active:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCheckingPassword ? 'Checking…' : 'Open App'}
            </button>
          </form>
        </div>
      )}

      <video ref={videoRef} className="hidden" playsInline />

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden min-h-0">
        <canvas ref={canvasRef} className="w-full h-full object-contain" width={640} height={480} />

        {countdown !== null && (
          <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
            <div className="w-28 h-28 rounded-full border border-white/25 bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <span className="text-5xl font-semibold leading-none tabular-nums text-white">{countdown}</span>
            </div>
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-72 flex-col shrink-0 border-l border-neutral-800 bg-neutral-950">
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center gap-2.5">
          <Camera size={15} className="text-neutral-400" />
          <span className="text-sm font-medium tracking-tight">Cam Effect</span>
        </div>
        {sidebarControls}
        <div className="px-5 py-4 border-t border-neutral-800 space-y-3">
          {takeButton}
          <p className="text-center text-[10px] text-neutral-600">© Vito 2026</p>
        </div>
      </aside>

      {/* Mobile controls overlay */}
      <div className="md:hidden absolute inset-x-0 bottom-0 z-30 pointer-events-none">
        <div className="pointer-events-auto border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm transition-colors shrink-0"
            >
              {mobileOpen ? <X size={14} /> : <SlidersHorizontal size={14} />}
              {mobileOpen ? 'Close' : 'Controls'}
            </button>
            <div className="flex-1">{takeButton}</div>
          </div>
        </div>

        {/* Expandable controls */}
        {mobileOpen && (
          <div className="pointer-events-auto border-t border-neutral-800 bg-neutral-950/97 backdrop-blur-sm max-h-[55vh] overflow-y-auto">
            {sidebarControls}
          </div>
        )}
      </div>
    </div>
  )
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getPhotoFrame(videoWidth: number, videoHeight: number, photoSize: PhotoSize) {
  if (!videoWidth || !videoHeight) {
    return {
      targetWidth: 640,
      targetHeight: 480,
      sourceX: 0,
      sourceY: 0,
      sourceWidth: 640,
      sourceHeight: 480,
    }
  }

  if (photoSize === 'normal') {
    return {
      targetWidth: videoWidth,
      targetHeight: videoHeight,
      sourceX: 0,
      sourceY: 0,
      sourceWidth: videoWidth,
      sourceHeight: videoHeight,
    }
  }

  const targetAspect = photoSize === 'square' ? 1 : 9 / 16
  const videoAspect = videoWidth / videoHeight

  let sourceWidth = videoWidth
  let sourceHeight = videoHeight

  if (videoAspect > targetAspect) {
    sourceWidth = Math.round(videoHeight * targetAspect)
  } else {
    sourceHeight = Math.round(videoWidth / targetAspect)
  }

  const sourceX = Math.max(0, Math.round((videoWidth - sourceWidth) / 2))
  const sourceY = Math.max(0, Math.round((videoHeight - sourceHeight) / 2))

  return {
    targetWidth: sourceWidth,
    targetHeight: sourceHeight,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
  }
}

// RGB Shift — broken VHS channel offset
function applyRGBShift(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  p: EffectParams,
) {
  const src = ctx.getImageData(0, 0, width, height)
  const srcData = src.data

  const out = ctx.createImageData(width, height)
  const outData = out.data

  const ox = p.rgbShiftX
  const oy = p.rgbShiftY

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const di = (y * width + x) * 4

      // Red channel: shift right+down
      const rx = Math.min(width - 1, x + ox)
      const ry = Math.min(height - 1, y + oy)
      const ri = (ry * width + rx) * 4

      // Green channel: no shift (anchor)
      const gi = di

      // Blue channel: shift left+up
      const bx = Math.max(0, x - ox)
      const by2 = Math.max(0, y - oy)
      const bi = (by2 * width + bx) * 4

      outData[di]     = srcData[ri]         // R
      outData[di + 1] = srcData[gi + 1]     // G
      outData[di + 2] = srcData[bi + 2]     // B
      outData[di + 3] = 255
    }
  }

  // Random horizontal glitch slices
  const glitchCount = Math.round(p.rgbGlitchLines)
  for (let i = 0; i < glitchCount; i++) {
    const sliceY = Math.floor(Math.random() * height)
    const sliceH = Math.floor(Math.random() * 6) + 1
    const sliceOX = Math.floor((Math.random() - 0.5) * ox * 3)

    for (let sy = sliceY; sy < Math.min(sliceY + sliceH, height); sy++) {
      for (let x = 0; x < width; x++) {
        const sx = Math.max(0, Math.min(width - 1, x + sliceOX))
        const si = (sy * width + sx) * 4
        const di = (sy * width + x) * 4
        outData[di]     = outData[si]
        outData[di + 1] = outData[si + 1]
        outData[di + 2] = outData[si + 2]
      }
    }
  }

  ctx.putImageData(out, 0, 0)

  // CRT scanlines overlay
  if (p.rgbScanlines) {
    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#000000'
    for (let y = 0; y < height; y += 2) {
      ctx.fillRect(0, y, width, 1)
    }
    ctx.restore()
  }
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
        value={typeof value === 'number' && !isNaN(value) ? value : min}
        onChange={e => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(v)
        }}
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

// Apply negative film effect
function applyNegative(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]
    data[i + 1] = 255 - data[i + 1]
    data[i + 2] = 255 - data[i + 2]
  }
}

// Apply heat-vision false-color effect
function applyHeatVision(data: Uint8ClampedArray, intensity: number, bandCount: number) {
  const bands = Math.max(2, Math.round(bandCount))
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  const mix = (a: number, b: number, t: number) => a + (b - a) * t

  const palette = [
    [6, 18, 78],
    [0, 84, 188],
    [0, 190, 120],
    [255, 225, 0],
    [255, 78, 0],
    [255, 255, 255],
  ] as const

  const samplePalette = (t: number) => {
    const scaled = t * (palette.length - 1)
    const index = Math.min(palette.length - 2, Math.max(0, Math.floor(scaled)))
    const localT = scaled - index
    const [r1, g1, b1] = palette[index]
    const [r2, g2, b2] = palette[index + 1]
    return [
      mix(r1, r2, localT),
      mix(g1, g2, localT),
      mix(b1, b2, localT),
    ]
  }

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    let t = Math.pow(gray / 255, 1 / Math.max(0.35, intensity))
    t = Math.round(t * (bands - 1)) / (bands - 1)
    const [nr, ng, nb] = samplePalette(t)

    const hotBoost = Math.max(0, gray - 160) / 95
    const coolShadow = Math.max(0, 95 - gray) / 95

    data[i] = clamp(nr + hotBoost * 18 - coolShadow * 10)
    data[i + 1] = clamp(ng + hotBoost * 24 - coolShadow * 4)
    data[i + 2] = clamp(nb + hotBoost * 18 + coolShadow * 22)
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
