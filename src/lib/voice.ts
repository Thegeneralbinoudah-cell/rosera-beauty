import type { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

const VOICE_PHASE = 'rosy-voice-phase' as const

export type RosyVoicePhase = 'speaking' | 'idle'

function emitVoicePhase(phase: RosyVoicePhase) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(VOICE_PHASE, { detail: { phase } }))
}

let currentAudio: HTMLAudioElement | null = null
let currentObjectUrl: string | null = null

function isWebSpeechFallbackEnabled(): boolean {
  const raw = import.meta.env.VITE_ROSY_WEB_SPEECH_FALLBACK
  if (typeof raw !== 'string') return false
  return /^(1|true|yes|on)$/i.test(raw.trim())
}

let elevenClient: ElevenLabsClient | null = null
let elevenClientApiKey: string | null = null

async function getElevenLabsClient(apiKey: string): Promise<ElevenLabsClient | null> {
  if (elevenClient && elevenClientApiKey === apiKey) {
    return elevenClient
  }
  elevenClient = null
  elevenClientApiKey = null
  try {
    const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js')
    elevenClient = new ElevenLabsClient({ apiKey })
    elevenClientApiKey = apiKey
    return elevenClient
  } catch {
    return null
  }
}

/**
 * جاهز للصوت: يتطلب **مفتاح API** و **Voice ID** من Voice Lab (نسخه من الإعدادات/API) —
 * ليس اسم صوت ولا preset ولا صوتاً من المكتبة.
 */
export function isElevenLabsConfigured(): boolean {
  const key = typeof import.meta.env.VITE_ELEVENLABS_API_KEY === 'string' ? import.meta.env.VITE_ELEVENLABS_API_KEY.trim() : ''
  const vid = import.meta.env.VITE_ELEVENLABS_VOICE_ID?.trim() ?? ''
  return Boolean(key && vid)
}

/**
 * نص المساعد كما وُلّد — لا إعادة صياغة ولا استبدال عبارات (مثل Voice Lab).
 */
export function prepareRosyTtsText(text: string): string {
  const t = String(text ?? '').trim()
  return t.length > 0 ? t : 'ردّيت عليكِ في الشات.'
}

/** @deprecated استخدمي prepareRosyTtsText */
export function stripForAssistantVoice(text: string): string {
  return prepareRosyTtsText(text)
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

/**
 * تشغيل مع التعامل مع حظر autoplay: إعادة المحاولة بعد أول نقرة / لمس.
 * لا نرفض الوعد عند فشل التشغيل الأول — ننتظر تفاعل المستخدم ثم ننتظر انتهاء المقطع.
 */
function waitForAudioPlaybackWithUnlock(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    audio.onended = () => resolve()
    audio.onerror = () => {
      console.error('❌ Audio element error')
      reject(new Error('Audio playback failed'))
    }

    const tryPlayAfterGesture = () => {
      const unlock = () => {
        window.removeEventListener('click', unlock)
        window.removeEventListener('touchstart', unlock)
        void audio.play().catch((e: unknown) => {
            console.error('❌ Retry failed', e)
            window.addEventListener('click', unlock)
            window.addEventListener('touchstart', unlock)
          })
      }
      window.addEventListener('click', unlock)
      window.addEventListener('touchstart', unlock)
    }

    void audio.play().catch((err: unknown) => {
        console.warn('⚠️ Autoplay blocked, retrying after user interaction', err)
        tryPlayAfterGesture()
      })
  })
}

function getSpeechSynthesisSafe(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null
  const synth = window.speechSynthesis
  return synth ?? null
}

function pickArabicVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices?.() ?? []
  if (!voices.length) return null
  const arSaudi =
    voices.find((v) => /^ar-sa$/i.test(v.lang)) ??
    voices.find((v) => /^ar[_-]sa$/i.test(v.lang)) ??
    null
  if (arSaudi) return arSaudi
  return voices.find((v) => /^ar/i.test(v.lang)) ?? null
}

function speakWithWebApi(text: string): Promise<RosySpeakResult> {
  return new Promise((resolve) => {
    const synth = getSpeechSynthesisSafe()
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      emitVoicePhase('idle')
      resolve({ ok: false, usedElevenLabs: false, error: 'Web Speech API unavailable' })
      return
    }

    // Stop any pending native TTS so the new line speaks cleanly.
    try {
      synth.cancel()
    } catch {
      /* ignore */
    }

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ar-SA'
    utter.rate = 1
    utter.pitch = 1
    utter.volume = 1
    const voice = pickArabicVoice(synth)
    if (voice) utter.voice = voice

    utter.onend = () => {
      emitVoicePhase('idle')
      resolve({ ok: true, usedElevenLabs: false })
    }
    utter.onerror = () => {
      emitVoicePhase('idle')
      resolve({ ok: false, usedElevenLabs: false, error: 'Web speech playback failed' })
    }

    emitVoicePhase('speaking')
    try {
      synth.speak(utter)
    } catch {
      emitVoicePhase('idle')
      resolve({ ok: false, usedElevenLabs: false, error: 'Web speech speak() failed' })
    }
  })
}

/** إيقاف تشغيل ElevenLabs فقط — لا Web Speech API. */
export function stopRosyVoicePlayback() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl)
    currentObjectUrl = null
  }
  const synth = getSpeechSynthesisSafe()
  if (synth) {
    try {
      synth.cancel()
    } catch {
      /* ignore */
    }
  }
  emitVoicePhase('idle')
}

/** نطق عربي + استنساخ — نموذج واحد فقط */
const MODEL_ID = 'eleven_multilingual_v2' as const

/** استنساخ واضح: similarity كامل، ثبات منخفض — لا style ولا speed ولا useSpeakerBoost */
const VOICE_SETTINGS = {
  stability: 0.2,
  similarityBoost: 1.0,
} as const

export type RosySpeakMode = 'default' | 'salon_owner_sales'

export type RosySpeakResult = {
  ok: boolean
  usedElevenLabs: boolean
  error?: string
}

/** تسلسل تشغيلات TTS حتى لا تتداخل المقاطع */
let speakQueueTail: Promise<RosySpeakResult> = Promise.resolve({ ok: false, usedElevenLabs: false })

/**
 * صوت روزي: **ElevenLabs فقط** — `voiceId` من `VITE_ELEVENLABS_VOICE_ID` (معرّف الاستنساخ من Voice Lab، ليس اسماً ولا preset).
 */
export async function speak(text: string, options?: { mode?: RosySpeakMode }): Promise<RosySpeakResult> {
  void options
  if (text.length === 0) {
    emitVoicePhase('idle')
    return { ok: false, usedElevenLabs: false, error: 'Empty text' }
  }

  const next = speakQueueTail.then(() => speakOnce(text))
  speakQueueTail = next.catch(() => ({ ok: false, usedElevenLabs: false }))
  return next
}

async function speakOnce(text: string): Promise<RosySpeakResult> {
  const finalText = text

  stopRosyVoicePlayback()
  await new Promise<void>((r) => setTimeout(r, 80))

  const apiKeyRaw = import.meta.env.VITE_ELEVENLABS_API_KEY
  const apiKey = typeof apiKeyRaw === 'string' ? apiKeyRaw.trim() : ''
  if (!apiKey) {
    console.warn('⚠️ ElevenLabs not configured — missing VITE_ELEVENLABS_API_KEY')
    if (isWebSpeechFallbackEnabled()) return speakWithWebApi(finalText)
    emitVoicePhase('idle')
    return { ok: false, usedElevenLabs: false, error: 'Missing API key' }
  }

  const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID
  if (typeof voiceId !== 'string' || !voiceId) {
    console.error('❌ Missing VITE_ELEVENLABS_VOICE_ID')
    if (isWebSpeechFallbackEnabled()) return speakWithWebApi(finalText)
    emitVoicePhase('idle')
    return { ok: false, usedElevenLabs: false, error: 'Missing cloned voice ID' }
  }

  const client = await getElevenLabsClient(apiKey)
  if (!client) {
    if (isWebSpeechFallbackEnabled()) return speakWithWebApi(finalText)
    emitVoicePhase('idle')
    return { ok: false, usedElevenLabs: false, error: 'ElevenLabs client failed to load' }
  }

  try {
    const stream = await client.textToSpeech.convert(voiceId, {
      text: finalText,
      modelId: MODEL_ID,
      voiceSettings: { ...VOICE_SETTINGS },
    })
    const blob = await streamToMp3Blob(stream)
    if (!blob || blob.size === 0) {
      console.error('❌ Invalid audio blob')
      emitVoicePhase('idle')
      return { ok: false, usedElevenLabs: false, error: 'Invalid audio blob' }
    }

    const blobUrl = URL.createObjectURL(blob)
    currentObjectUrl = blobUrl
    const audio = new Audio()
    audio.muted = false
    audio.volume = 1
    audio.src = blobUrl
    currentAudio = audio
    emitVoicePhase('speaking')
    await waitForAudioPlaybackWithUnlock(audio)
    stopRosyVoicePlayback()
    emitVoicePhase('idle')
    return { ok: true, usedElevenLabs: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ElevenLabs TTS failed'
    console.error('[Rosy TTS]', msg, e)
    stopRosyVoicePlayback()
    if (isWebSpeechFallbackEnabled()) return speakWithWebApi(finalText)
    emitVoicePhase('idle')
    return { ok: false, usedElevenLabs: false, error: msg }
  }
}

/** نفس `speak` — للاستدعاء من المحادثة */
export async function playRosyVoice(text: string, options?: { mode?: RosySpeakMode }): Promise<RosySpeakResult> {
  return speak(text, options)
}

/**
 * TEMP — اختبار سريع للصوت المستنسخ من كونسول المتصفح:
 * `testRosyVoiceDirect()` أو `import('@/lib/voice').then((m) => m.testVoiceDirect())`
 */
export async function testVoiceDirect(): Promise<void> {
  const text = 'هلا والله كيف أقدر أخدمك'
  await playRosyVoice(text)
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { testRosyVoiceDirect: () => Promise<void> }).testRosyVoiceDirect = () => testVoiceDirect()
}

export const ROSY_VOICE_PHASE_EVENT = VOICE_PHASE
