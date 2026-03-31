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

/** REST base — used for TTS so we can log URL + status + body on failure. */
const ELEVENLABS_API_ORIGIN = 'https://api.elevenlabs.io/v1'

function buildTtsUrl(voiceId: string): string {
  return `${ELEVENLABS_API_ORIGIN}/text-to-speech/${encodeURIComponent(voiceId)}`
}

/** مصدر واحد للتشخيص: قاعدة أولاً، ثم env (بما فيه ELEVENLABS_VOICE_ID المحقون عبر Vite). */
export type RosyVoiceIdSource = 'db' | 'env'

/**
 * `public.rosey_voice_config` — صف واحد (id=1). voice_id الفارغ يُعامل كعدم ضبط.
 */
async function fetchVoiceIdFromDatabase(): Promise<string | null> {
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data, error } = await supabase.from('rosey_voice_config').select('voice_id').eq('id', 1).maybeSingle()
    if (error) {
      console.warn('[Rosy voice] database voice_id read failed', error.message)
      return null
    }
    const id = data && typeof data.voice_id === 'string' ? data.voice_id.trim() : ''
    return id || null
  } catch (e) {
    console.warn('[Rosy voice] database voice_id read exception', e instanceof Error ? e.message : String(e))
    return null
  }
}

function voiceIdFromEnv(): string {
  const raw = import.meta.env.VITE_ELEVENLABS_VOICE_ID
  return typeof raw === 'string' ? raw.trim() : ''
}

/**
 * أولوية مصدر واحد: 1) قاعدة `rosey_voice_config.voice_id` 2) env (`VITE_*` أو ELEVENLABS_VOICE_ID عبر Vite define) 3) خطأ.
 */
async function resolveElevenLabsVoiceId(): Promise<{ voiceId: string; source: RosyVoiceIdSource } | null> {
  const fromDb = await fetchVoiceIdFromDatabase()
  if (fromDb) {
    return { voiceId: fromDb, source: 'db' }
  }
  const fromEnv = voiceIdFromEnv()
  if (fromEnv) {
    return { voiceId: fromEnv, source: 'env' }
  }
  console.warn(
    '[Rosy voice] no voice_id: set public.rosey_voice_config.voice_id (preferred) or VITE_ELEVENLABS_VOICE_ID / ELEVENLABS_VOICE_ID',
  )
  return null
}

/**
 * جاهز تقريباً للصوت: يتطلب مفتاح API في العميل.
 * معرّف الصوت يُحلّ عند التشغيل: **قاعدة أولاً** ثم env — لا يُفحص هنا (غير متزامن).
 */
export function isElevenLabsConfigured(): boolean {
  const key =
    typeof import.meta.env.VITE_ELEVENLABS_API_KEY === 'string' ? import.meta.env.VITE_ELEVENLABS_API_KEY.trim() : ''
  return Boolean(key)
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

function mediaErrorLabel(code: number | undefined): string {
  if (code === 1) return 'MEDIA_ERR_ABORTED'
  if (code === 2) return 'MEDIA_ERR_NETWORK'
  if (code === 3) return 'MEDIA_ERR_DECODE'
  if (code === 4) return 'MEDIA_ERR_SRC_NOT_SUPPORTED'
  return code != null ? `MEDIA_ERR_${code}` : 'unknown'
}

/**
 * تشغيل مع التعامل مع حظر autoplay: إعادة المحاولة بعد أول نقرة / لمس.
 * لا نرفض الوعد عند فشل التشغيل الأول — ننتظر تفاعل المستخدم ثم ننتظر انتهاء المقطع.
 */
function waitForAudioPlaybackWithUnlock(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    audio.onended = () => resolve()
    audio.onerror = (ev: Event) => {
      const me = audio.error
      console.error('[Rosy voice] Audio element error (exact)', {
        eventType: ev.type,
        mediaErrorCode: me?.code,
        mediaErrorMessage: me?.message,
        mediaErrorLabel: mediaErrorLabel(me?.code),
        networkState: audio.networkState,
        readyState: audio.readyState,
        src: audio.src,
      })
      reject(new Error(`Audio playback failed: ${mediaErrorLabel(me?.code)} — ${me?.message ?? 'no MediaError message'}`))
    }

    const tryPlayAfterGesture = () => {
      const unlock = () => {
        window.removeEventListener('click', unlock)
        window.removeEventListener('touchstart', unlock)
        void audio.play().catch((e: unknown) => {
          console.error('[Rosy voice] play() retry after gesture failed', e)
          window.addEventListener('click', unlock)
          window.addEventListener('touchstart', unlock)
        })
      }
      window.addEventListener('click', unlock)
      window.addEventListener('touchstart', unlock)
    }

    void audio.play().catch((err: unknown) => {
      console.warn('[Rosy voice] Autoplay blocked, retrying after user interaction', err)
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
  /** آخر محاولة TTS (للتشخيص في الواجهة أو الكونسول) */
  debug?: {
    voiceId?: string
    voiceIdSource?: RosyVoiceIdSource
    requestUrl?: string
    httpStatus?: number
    failureReason?: string
  }
}

/** تسلسل تشغيلات TTS حتى لا تتداخل المقاطع */
let speakQueueTail: Promise<RosySpeakResult> = Promise.resolve({ ok: false, usedElevenLabs: false })

/**
 * صوت روزي: ElevenLabs عبر REST — `voiceId` من **قاعدة `rosey_voice_config`** ثم **env** (واحد فقط يُستخدم بعد الحل).
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
  const keyExists = Boolean(apiKey)
  console.log('[Rosy voice] api key exists', keyExists)
  if (!apiKey) {
    console.warn('[Rosy voice] missing key (set VITE_ELEVENLABS_API_KEY in env; server-side ELEVENLABS_API_KEY is not used in the browser)')
    if (isWebSpeechFallbackEnabled()) return speakWithWebApi(finalText)
    emitVoicePhase('idle')
    return {
      ok: false,
      usedElevenLabs: false,
      error: 'Missing API key',
      debug: { failureReason: 'missing key' },
    }
  }

  const resolved = await resolveElevenLabsVoiceId()
  const voiceId = resolved?.voiceId ?? ''
  const voiceIdSource = resolved?.source

  if (!voiceId) {
    if (isWebSpeechFallbackEnabled()) return speakWithWebApi(finalText)
    emitVoicePhase('idle')
    return {
      ok: false,
      usedElevenLabs: false,
      error: 'Missing voice ID (database empty and env empty)',
      debug: { failureReason: 'missing voice_id (db + env)' },
    }
  }

  console.log('[Rosy voice] final voice_id used', { voiceId, source: voiceIdSource })

  const requestUrl = buildTtsUrl(voiceId)
  console.log('[Rosy voice] request URL', requestUrl)

  try {
    const res = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: finalText,
        model_id: MODEL_ID,
        voice_settings: {
          stability: VOICE_SETTINGS.stability,
          similarity_boost: VOICE_SETTINGS.similarityBoost,
        },
      }),
    })

    const httpStatus = res.status
    console.log('[Rosy voice] response status', httpStatus)

    if (!res.ok) {
      const bodyText = await res.text()
      console.error('[Rosy voice] response not ok — full response text', bodyText)
      const failureReason = `HTTP ${httpStatus}: ${bodyText.slice(0, 500)}`
      stopRosyVoicePlayback()
      if (isWebSpeechFallbackEnabled()) return speakWithWebApi(finalText)
      emitVoicePhase('idle')
      return {
        ok: false,
        usedElevenLabs: false,
        error: failureReason,
        debug: { voiceId, voiceIdSource, requestUrl, httpStatus, failureReason },
      }
    }

    let blob = await res.blob()
    const looksAudio =
      blob.type === 'audio/mpeg' ||
      blob.type === 'audio/mp3' ||
      blob.type === 'application/octet-stream' ||
      blob.type === ''

    if (!looksAudio || blob.size === 0) {
      console.error('[Rosy voice] invalid audio blob', { type: blob.type, size: blob.size })
      stopRosyVoicePlayback()
      if (isWebSpeechFallbackEnabled()) return speakWithWebApi(finalText)
      emitVoicePhase('idle')
      return {
        ok: false,
        usedElevenLabs: false,
        error: 'Invalid audio blob',
        debug: {
          voiceId,
          voiceIdSource,
          requestUrl,
          httpStatus,
          failureReason: `invalid blob type=${blob.type} size=${blob.size}`,
        },
      }
    }

    if (blob.type !== 'audio/mpeg' && blob.type !== 'audio/mp3') {
      blob = new Blob([blob], { type: 'audio/mpeg' })
    }

    const blobUrl = URL.createObjectURL(blob)
    if (!blobUrl.startsWith('blob:')) {
      console.error('[Rosy voice] invalid object URL for audio', blobUrl)
      stopRosyVoicePlayback()
      if (isWebSpeechFallbackEnabled()) return speakWithWebApi(finalText)
      emitVoicePhase('idle')
      return {
        ok: false,
        usedElevenLabs: false,
        error: 'Invalid blob URL',
        debug: { voiceId, voiceIdSource, requestUrl, httpStatus, failureReason: 'object URL not blob:' },
      }
    }

    currentObjectUrl = blobUrl
    console.log('[Rosy voice] audio src before Audio()', blobUrl, {
      blobSize: blob.size,
      blobType: blob.type,
    })

    const audio = new Audio()
    audio.muted = false
    audio.volume = 1
    audio.preload = 'auto'
    audio.src = blobUrl
    currentAudio = audio
    emitVoicePhase('speaking')
    await waitForAudioPlaybackWithUnlock(audio)
    stopRosyVoicePlayback()
    emitVoicePhase('idle')
    return {
      ok: true,
      usedElevenLabs: true,
      debug: { voiceId, voiceIdSource, requestUrl, httpStatus },
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'ElevenLabs TTS failed'
    console.error('[Rosy voice] TTS fetch/playback failed', msg, e)
    stopRosyVoicePlayback()
    if (isWebSpeechFallbackEnabled()) return speakWithWebApi(finalText)
    emitVoicePhase('idle')
    return {
      ok: false,
      usedElevenLabs: false,
      error: msg,
      debug: {
        voiceId,
        voiceIdSource,
        requestUrl,
        failureReason: msg,
      },
    }
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
  const r = await playRosyVoice(text)
  console.log('[Rosy voice] testVoiceDirect result', r)
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { testRosyVoiceDirect: () => Promise<void> }).testRosyVoiceDirect = () => testVoiceDirect()
}

export const ROSY_VOICE_PHASE_EVENT = VOICE_PHASE
