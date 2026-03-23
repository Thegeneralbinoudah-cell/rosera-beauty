const VOICE_PHASE = 'rosy-voice-phase' as const

/** نفس بداية تنبيه تحليل الوجه في المحادثة — لإسقاطه من الصوت فقط */
const FACE_SCAN_VOICE_CUT = '⚠️ تنبيه مهم:'

export type RosyVoicePhase = 'speaking' | 'idle'

function emitVoicePhase(phase: RosyVoicePhase) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(VOICE_PHASE, { detail: { phase } }))
}

let currentAudio: HTMLAudioElement | null = null
let currentObjectUrl: string | null = null

let elevenClient: import('@elevenlabs/elevenlabs-js').ElevenLabsClient | null = null

async function getElevenLabsClient() {
  const key = import.meta.env.VITE_ELEVENLABS_API_KEY
  if (!key || typeof key !== 'string') return null
  if (!elevenClient) {
    try {
      const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js')
      elevenClient = new ElevenLabsClient({ apiKey: key })
    } catch {
      return null
    }
  }
  return elevenClient
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_ELEVENLABS_API_KEY)
}

export function stripForAssistantVoice(text: string): string {
  const idx = text.indexOf(FACE_SCAN_VOICE_CUT)
  let t = (idx === -1 ? text : text.slice(0, idx)).trim()
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  return t.length > 0 ? t : 'ردّيت عليكِ في الشات.'
}

async function streamToMp3Blob(stream: ReadableStream<Uint8Array>): Promise<Blob> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value?.byteLength) chunks.push(value)
  }
  let size = 0
  for (const c of chunks) size += c.byteLength
  const out = new Uint8Array(size)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.byteLength
  }
  return new Blob([out], { type: 'audio/mpeg' })
}

function stopBrowserUtterance() {
  try {
    speechSynthesis.cancel()
  } catch {
    /* ignore */
  }
}

/** إيقاف أي تشغيل صوتي (ElevenLabs أو المتصفح). */
export function stopRosyVoicePlayback() {
  stopBrowserUtterance()
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
  emitVoicePhase('idle')
}

/** صوت Bella الافتراضي في ElevenLabs */
export const ELEVENLABS_BELLA_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'

export type RosySpeakMode = 'default' | 'salon_owner_sales'

async function speakElevenLabs(
  plain: string,
  opts?: {
    voiceId?: string
    voiceSettings?: {
      stability?: number
      similarityBoost?: number
      style?: number
      useSpeakerBoost?: boolean
      speed?: number
    }
  }
): Promise<boolean> {
  const client = await getElevenLabsClient()
  if (!client) return false
  const envVoice = (import.meta.env.VITE_ELEVENLABS_VOICE_ID as string | undefined)?.trim()
  const voiceId = opts?.voiceId?.trim() || envVoice || ELEVENLABS_BELLA_VOICE_ID
  const stream = await client.textToSpeech.convert(voiceId, {
    text: plain,
    modelId: 'eleven_multilingual_v2',
    ...(opts?.voiceSettings ? { voiceSettings: opts.voiceSettings } : {}),
  })
  const blob = await streamToMp3Blob(stream)
  const url = URL.createObjectURL(blob)
  currentObjectUrl = url
  const audio = new Audio(url)
  currentAudio = audio
  emitVoicePhase('speaking')
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve()
    audio.onerror = () => reject(new Error('audio'))
    void audio.play().catch(() => reject(new Error('play')))
  })
  stopRosyVoicePlayback()
  return true
}

async function speakBrowser(plain: string): Promise<void> {
  emitVoicePhase('speaking')
  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(plain)
    utterance.lang = 'ar-SA'
    utterance.rate = 1
    utterance.pitch = 1.02
    const list = speechSynthesis.getVoices()
    const ar = list.filter((v) => v.lang.toLowerCase().startsWith('ar'))
    const voice =
      ar.find((v) => /female|woman|أنثى|girl/i.test(`${v.name} ${v.voiceURI}`)) ?? ar[0]
    if (voice) utterance.voice = voice
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    speechSynthesis.speak(utterance)
  })
  emitVoicePhase('idle')
}

/**
 * تشغيل رد روزي صوتياً — ElevenLabs إن وُجد المفتاح، وإلا صوت المتصفح.
 * المفتاح في Vite يُعرّض للعميل؛ للإنتاج يُفضّل بروكسي عبر Edge Function.
 * `salon_owner_sales`: Bella + إعدادات أنعم وأقرب للإقناع الودّي.
 */
export async function speak(
  text: string,
  options?: { mode?: RosySpeakMode }
): Promise<{ ok: boolean; usedElevenLabs: boolean }> {
  const plain = stripForAssistantVoice(text)
  if (!plain) {
    emitVoicePhase('idle')
    return { ok: false, usedElevenLabs: false }
  }
  stopRosyVoicePlayback()
  const mode = options?.mode ?? 'default'
  const salesVoiceId =
    (import.meta.env.VITE_ELEVENLABS_SALES_VOICE_ID as string | undefined)?.trim() || ELEVENLABS_BELLA_VOICE_ID
  try {
    if (isElevenLabsConfigured()) {
      const ok =
        mode === 'salon_owner_sales'
          ? await speakElevenLabs(plain, {
              voiceId: salesVoiceId,
              voiceSettings: {
                stability: 0.52,
                similarityBoost: 0.78,
                style: 0.24,
                useSpeakerBoost: true,
                speed: 0.97,
              },
            })
          : await speakElevenLabs(plain)
      if (ok) {
        emitVoicePhase('idle')
        return { ok: true, usedElevenLabs: true }
      }
    }
    await speakBrowser(plain)
    return { ok: true, usedElevenLabs: false }
  } catch {
    emitVoicePhase('idle')
    return { ok: false, usedElevenLabs: false }
  }
}

export const ROSY_VOICE_PHASE_EVENT = VOICE_PHASE
