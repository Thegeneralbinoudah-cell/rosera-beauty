import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export type VoiceWaveformPhase = 'idle' | 'listening' | 'speaking'

const IDLE_MIC_LEVELS = [0.2, 0.16, 0.22, 0.18, 0.2] as const

function useMicLevels(active: boolean, externalStream?: MediaStream | null): number[] {
  const [levels, setLevels] = useState<number[]>(() => [...IDLE_MIC_LEVELS])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!active) {
      return
    }

    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let cancelled = false

    void (async () => {
      try {
        if (externalStream) {
          stream = externalStream
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          })
        }
        if (cancelled) {
          if (!externalStream) stream.getTracks().forEach((t) => t.stop())
          return
        }
        ctx = new AudioContext()
        const src = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 128
        analyser.smoothingTimeConstant = 0.65
        src.connect(analyser)
        const buf = new Uint8Array(analyser.frequencyBinCount)

        const tick = () => {
          if (cancelled) return
          analyser.getByteFrequencyData(buf)
          const buckets = 5
          const step = Math.max(1, Math.floor(buf.length / buckets))
          const next: number[] = []
          for (let b = 0; b < buckets; b++) {
            let s = 0
            for (let i = 0; i < step; i++) s += buf[b * step + i] ?? 0
            const v = Math.min(1, (s / step / 255) * 3.2)
            next.push(v)
          }
          setLevels(next)
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        let t = 0
        const fake = () => {
          if (cancelled) return
          t += 0.08
          setLevels([
            0.35 + Math.sin(t) * 0.2,
            0.42 + Math.sin(t + 0.7) * 0.22,
            0.38 + Math.sin(t + 1.2) * 0.24,
            0.4 + Math.sin(t + 0.4) * 0.2,
            0.36 + Math.sin(t + 1.6) * 0.21,
          ])
          rafRef.current = requestAnimationFrame(fake)
        }
        fake()
      }
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      if (!externalStream) stream?.getTracks().forEach((tr) => tr.stop())
      void ctx?.close()
    }
  }, [active, externalStream])

  return active ? levels : [...IDLE_MIC_LEVELS]
}

type VoiceWaveformProps = {
  phase: VoiceWaveformPhase
  className?: string
  /** Single shared mic stream (e.g. from `MediaRecorder`) — avoids double `getUserMedia`. */
  externalStream?: MediaStream | null
  /** While recording / listening — bars use accent gold. */
  dustyRoseRecording?: boolean
}

/**
 * موجة صوتية — مستويات حقيقية أثناء الاستماع عند توفر المايك، وحركة ناعمة في وضعي السكون والكلام.
 */
export function VoiceWaveform({ phase, className, externalStream, dustyRoseRecording }: VoiceWaveformProps) {
  const listening = phase === 'listening'
  const liveLevels = useMicLevels(listening, listening ? externalStream : null)
  const tRef = useRef(0)
  const [idlePulse, setIdlePulse] = useState([0.2, 0.16, 0.22, 0.18, 0.2])

  useEffect(() => {
    if (phase === 'listening') return
    let raf = 0
    const speed = phase === 'speaking' ? 0.06 : 0.035
    const base = phase === 'speaking' ? 0.28 : 0.14
    const amp = phase === 'speaking' ? 0.32 : 0.12
    const tick = () => {
      tRef.current += speed
      const t = tRef.current
      setIdlePulse([
        base + Math.sin(t) * amp,
        base + Math.sin(t + 0.9) * amp * 1.05,
        base + Math.sin(t + 1.7) * amp * 1.1,
        base + Math.sin(t + 0.4) * amp * 0.95,
        base + Math.sin(t + 2.1) * amp,
      ])
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [phase])

  const heights = listening ? liveLevels : idlePulse

  const barClass = cn(
    dustyRoseRecording && listening
      ? 'inline-block w-2 origin-bottom rounded-full bg-accent shadow-sm transition-[height] duration-75'
      : 'inline-block w-2 origin-bottom rounded-full bg-gradient-to-t from-primary via-accent to-primary/40 shadow-sm transition-[height] duration-75',
    phase === 'idle' && 'opacity-80',
    phase === 'speaking' && 'opacity-95'
  )

  return (
    <div className={cn('flex h-9 items-end justify-center gap-1.5', className)} aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className={barClass}
          style={{
            height: `${Math.max(18, 10 + h * 52)}px`,
            animationDelay: `${i * 70}ms`,
          }}
        />
      ))}
    </div>
  )
}
