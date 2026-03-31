const VOICE_PHASE = 'rosy-voice-phase' as const

export type RosyVoicePhase = 'speaking' | 'idle'

function emitVoicePhase(phase: RosyVoicePhase) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(VOICE_PHASE, { detail: { phase } }))
}

let currentAudio: HTMLAudioElement | null = null
let currentObjectUrl: string | null = null
/** مصدر Web Audio النشط — يُوقف عند stopRosyVoicePlayback */
let currentBufferSource: AudioBufferSourceNode | null = null
let sharedAudioContext: AudioContext | null = null

/**
 * صوت المتصفح الروبوتي — معطّل افتراضياً (صوت روزي = ElevenLabs فقط).
 * لتفعيل الاحتياطي: VITE_ROSY_WEB_SPEECH_FALLBACK=1
 */
function isWebSpeechFallbackEnabled(): boolean {
  const raw = import.meta.env.VITE_ROSY_WEB_SPEECH_FALLBACK
  if (typeof raw !== 'string' || raw.trim() === '') return false
  return /^(1|true|yes|on)$/i.test(raw.trim())
}

/** تقوية مخرج الصوت فوق حد HTMLAudio.volume (1) — VITE_ROSY_VOICE_OUTPUT_GAIN افتراضي 1.35 */
function parseOutputGain(): number {
  const raw = import.meta.env.VITE_ROSY_VOICE_OUTPUT_GAIN
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number.parseFloat(raw.trim())
    if (!Number.isNaN(n)) return Math.min(2.5, Math.max(0.5, n))
  }
  return 1.35
}

function getRosyAudioContext(): AudioContext {
  if (typeof window === 'undefined') throw new Error('AudioContext unavailable')
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) throw new Error('AudioContext not supported')
    sharedAudioContext = new AC()
  }
  return sharedAudioContext
}

async function playMp3BufferWithGain(buffer: ArrayBuffer): Promise<void> {
  const ctx = getRosyAudioContext()
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      /* iOS قد يرفض بدون إيماءة — نُكمل وقد يفشل decode/play */
    }
  }
  const gainValue = parseOutputGain()
  const audioBuffer = await ctx.decodeAudioData(buffer.slice(0))

  return new Promise((resolve, reject) => {
    const src = ctx.createBufferSource()
    const gainNode = ctx.createGain()
    src.buffer = audioBuffer
    gainNode.gain.value = gainValue
    src.connect(gainNode)
    gainNode.connect(ctx.destination)
    currentBufferSource = src
    src.onended = () => {
      if (currentBufferSource === src) currentBufferSource = null
      try {
        src.disconnect()
      } catch {
        /* ignore */
      }
      try {
        gainNode.disconnect()
      } catch {
        /* ignore */
      }
      resolve()
    }
    try {
      src.start(0)
    } catch (e) {
      if (currentBufferSource === src) currentBufferSource = null
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

/** REST base — used for TTS so we can log URL + status + body on failure. */
const ELEVENLABS_API_ORIGIN = 'https://api.elevenlabs.io/v1'

function buildTtsUrl(voiceId: string): string {
  const id = encodeURIComponent(voiceId)
  return `${ELEVENLABS_API_ORIGIN}/text-to-speech/${id}/stream?output_format=mp3_44100_128`
}

/** نطق عربي + استنساخ — نموذج واحد فقط */
const MODEL_ID = 'eleven_multilingual_v2' as const

/** استنساخ واضح: similarity كامل، ثبات منخفض */
const VOICE_SETTINGS = {
  stability: 0.2,
  similarityBoost: 1.0,
} as const

/** مصدر معرّف الصوت للتشخيص — `edge` يعني TTS من دالة Supabase. */
export type RosyVoiceIdSource = 'db' | 'env' | 'edge'

export type RosySpeakMode = 'default' | 'salon_owner_sales'

export type RosyTtsRoute = 'direct' | 'edge' | 'web_speech' | 'none'

export type RosySpeakResult = {
  ok: boolean
  usedElevenLabs: boolean
  /** من أين جاء الصوت: ElevenLabs مباشرة، دالة rosey-tts، أو صوت المتصفح */
  ttsRoute?: RosyTtsRoute
  /** اكتمل التشغيل بنجاح (أو نجاح web speech عند تفعيله) */
  audioOk?: boolean
  error?: string
  debug?: {
    voiceId?: string
    voiceIdSource?: RosyVoiceIdSource
    requestUrl?: string
    httpStatus?: number
    failureReason?: string
    ttsRoute?: RosyTtsRoute
    audioPlaybackOk?: boolean
  }
}

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
 * هل يوجد مسار TTS بصوت روزي (مفتاح في العميل **أو** دالة `rosey-tts` على Supabase).
 */
export function isElevenLabsConfigured(): boolean {
  const key =
    typeof import.meta.env.VITE_ELEVENLABS_API_KEY === 'string' ? import.meta.env.VITE_ELEVENLABS_API_KEY.trim() : ''
  if (key) return true
  const url = typeof import.meta.env.VITE_SUPABASE_URL === 'string' ? import.meta.env.VITE_SUPABASE_URL.trim() : ''
  const anon =
    typeof import.meta.env.VITE_SUPABASE_ANON_KEY === 'string' ? import.meta.env.VITE_SUPABASE_ANON_KEY.trim() : ''
  return Boolean(url && anon)
}

function canUseRosyTtsEdge(): boolean {
  const url = typeof import.meta.env.VITE_SUPABASE_URL === 'string' ? import.meta.env.VITE_SUPABASE_URL.trim() : ''
  const anon =
    typeof import.meta.env.VITE_SUPABASE_ANON_KEY === 'string' ? import.meta.env.VITE_SUPABASE_ANON_KEY.trim() : ''
  return Boolean(url && anon)
}

/**
 * TTS عبر Edge Function — `supabase.functions.invoke('rosey-tts')` (الدالة تُرجع octet-stream → Blob).
 */
async function fetchRosyTtsFromEdge(text: string): Promise<{ buffer: ArrayBuffer; httpStatus: number; requestUrl: string } | null> {
  if (!canUseRosyTtsEdge()) return null
  const base = import.meta.env.VITE_SUPABASE_URL!.trim().replace(/\/$/, '')
  const requestUrl = `${base}/functions/v1/rosey-tts`

  try {
    const { supabase } = await import('@/lib/supabase')
    const { data, error, response } = await supabase.functions.invoke('rosey-tts', {
      body: { text },
    })

    const httpStatus = response?.status ?? 0

    if (error) {
      console.warn('[Rosy voice] rosey-tts invoke failed', error)
      return null
    }

    let buffer: ArrayBuffer | null = null
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      buffer = await data.arrayBuffer()
    } else if (data instanceof ArrayBuffer) {
      buffer = data
    } else {
      console.warn('[Rosy voice] rosey-tts invoke returned unexpected data type', typeof data)
      return null
    }

    if (buffer.byteLength < 64) {
      console.warn('[Rosy voice] rosey-tts buffer too small', buffer.byteLength)
      return null
    }

    console.log('[Rosy voice] rosey-tts success')
    return { buffer, httpStatus: httpStatus || 200, requestUrl }
  } catch (e) {
    console.warn('[Rosy voice] rosey-tts invoke exception', e)
    return null
  }
}

async function fetchElevenLabsDirect(
  apiKey: string,
  voiceId: string,
  text: string,
): Promise<{ buffer: ArrayBuffer; httpStatus: number; requestUrl: string } | null> {
  const requestUrl = buildTtsUrl(voiceId)
  console.log('[Rosy voice] trying direct ElevenLabs first')
  try {
    const res = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: VOICE_SETTINGS.stability,
          similarity_boost: VOICE_SETTINGS.similarityBoost,
        },
      }),
    })
    const httpStatus = res.status
    if (!res.ok) {
      const bodyText = await res.text()
      console.error('[Rosy voice] direct ElevenLabs failed', httpStatus, bodyText.slice(0, 500))
      return null
    }
    const buffer = await res.arrayBuffer()
    if (buffer.byteLength === 0) return null
    return { buffer, httpStatus, requestUrl }
  } catch (e) {
    console.error('[Rosy voice] direct ElevenLabs exception', e)
    return null
  }
}

async function playBufferToCompletion(
  buffer: ArrayBuffer,
  debug: NonNullable<RosySpeakResult['debug']>,
  ttsRoute: 'direct' | 'edge',
): Promise<RosySpeakResult> {
  emitVoicePhase('speaking')
  try {
    await playMp3BufferWithGain(buffer)
  } catch (webAudioErr: unknown) {
    console.warn('[Rosy voice] Web Audio path failed, using <audio> element', webAudioErr)
    const audioBlob = new Blob([buffer])
    const audioUrl = URL.createObjectURL(audioBlob)
    if (!audioUrl.startsWith('blob:')) {
      stopRosyVoicePlayback()
      emitVoicePhase('idle')
      return {
        ok: false,
        usedElevenLabs: false,
        ttsRoute,
        audioOk: false,
        error: 'Invalid blob URL',
        debug: {
          ...debug,
          ttsRoute,
          audioPlaybackOk: false,
          failureReason: 'object URL not blob:',
        },
      }
    }

    currentObjectUrl = audioUrl
    const audio = new Audio(audioUrl)
    audio.preload = 'auto'
    audio.muted = false
    audio.volume = 1
    audio.setAttribute('playsinline', '')
    currentAudio = audio
    await awaitRosyElevenLabsAudio(audio)
  }
  stopRosyVoicePlayback()
  emitVoicePhase('idle')
  return {
    ok: true,
    usedElevenLabs: true,
    ttsRoute,
    audioOk: true,
    debug: { ...debug, ttsRoute, audioPlaybackOk: true },
  }
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
 * انتظار انتهاء المقطع + `play()` مع try/catch؛ عند حظر autoplay ننتظر نقرة/لمسة ثم نعيد المحاولة.
 */
const PLAYBACK_TIMEOUT_MS = 180_000

function awaitRosyElevenLabsAudio(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      window.removeEventListener('click', gestureUnlock)
      window.removeEventListener('touchstart', gestureUnlock)
      fn()
    }

    const timeoutId = window.setTimeout(() => {
      finish(() => reject(new Error('Audio playback timeout')))
    }, PLAYBACK_TIMEOUT_MS)

    audio.onended = () => finish(() => resolve())

    audio.addEventListener('error', () => {
      console.error('[Rosy voice] AUDIO ERROR FULL', {
        error: audio.error,
        code: audio.error?.code,
        message: audio.error?.message,
        src: audio.src,
      })
      finish(() =>
        reject(
          new Error(
            `Audio playback failed: ${mediaErrorLabel(audio.error?.code)} — ${audio.error?.message ?? 'no MediaError message'}`,
          ),
        ),
      )
    })

    const gestureUnlock = async () => {
      try {
        await audio.play()
      } catch (e: unknown) {
        console.error('[Rosy voice] play() retry after gesture failed', e)
      }
    }

    const tryPlayAfterGesture = () => {
      window.addEventListener('click', gestureUnlock, { passive: true })
      window.addEventListener('touchstart', gestureUnlock, { passive: true })
    }

    void (async () => {
      try {
        await audio.play()
      } catch (e: unknown) {
        console.error('[Rosy voice] play() failed', e)
        console.warn('[Rosy voice] Autoplay blocked, retrying after user interaction')
        tryPlayAfterGesture()
      }
    })()
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
      resolve({
        ok: false,
        usedElevenLabs: false,
        ttsRoute: 'none',
        audioOk: false,
        error: 'Web Speech API unavailable',
      })
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
      resolve({
        ok: true,
        usedElevenLabs: false,
        ttsRoute: 'web_speech',
        audioOk: true,
      })
    }
    utter.onerror = () => {
      emitVoicePhase('idle')
      resolve({
        ok: false,
        usedElevenLabs: false,
        ttsRoute: 'web_speech',
        audioOk: false,
        error: 'Web speech playback failed',
      })
    }

    emitVoicePhase('speaking')
    try {
      synth.speak(utter)
    } catch {
      emitVoicePhase('idle')
      resolve({
        ok: false,
        usedElevenLabs: false,
        ttsRoute: 'web_speech',
        audioOk: false,
        error: 'Web speech speak() failed',
      })
    }
  })
}

/** إيقاف تشغيل ElevenLabs فقط — لا Web Speech API. */
export function stopRosyVoicePlayback() {
  if (currentBufferSource) {
    try {
      currentBufferSource.stop()
    } catch {
      /* already ended */
    }
    try {
      currentBufferSource.disconnect()
    } catch {
      /* ignore */
    }
    currentBufferSource = null
  }
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

/** تسلسل تشغيلات TTS حتى لا تتداخل المقاطع */
let speakQueueTail: Promise<RosySpeakResult> = Promise.resolve({ ok: false, usedElevenLabs: false })

/**
 * صوت روزي: ElevenLabs عبر REST — `voiceId` من **قاعدة `rosey_voice_config`** ثم **env** (واحد فقط يُستخدم بعد الحل).
 */
export async function speak(text: string, options?: { mode?: RosySpeakMode }): Promise<RosySpeakResult> {
  void options
  if (text.length === 0) {
    emitVoicePhase('idle')
    return { ok: false, usedElevenLabs: false, ttsRoute: 'none', audioOk: false, error: 'Empty text' }
  }

  const next = speakQueueTail.then(() => speakOnce(text))
  speakQueueTail = next.catch(() => ({
    ok: false,
    usedElevenLabs: false,
    ttsRoute: 'none' as const,
    audioOk: false,
  }))
  return next
}

async function speakOnce(text: string): Promise<RosySpeakResult> {
  const finalText = text

  stopRosyVoicePlayback()
  await new Promise<void>((r) => setTimeout(r, 80))

  const apiKeyRaw = import.meta.env.VITE_ELEVENLABS_API_KEY
  const apiKey = typeof apiKeyRaw === 'string' ? apiKeyRaw.trim() : ''
  if (import.meta.env.DEV) console.log('[Rosy voice] client API key present', Boolean(apiKey))

  const resolved = await resolveElevenLabsVoiceId()
  const voiceId = resolved?.voiceId ?? ''
  const voiceIdSource = resolved?.source

  let buffer: ArrayBuffer | null = null
  let requestUrl = ''
  let httpStatus: number | undefined
  let debugVoiceId = voiceId
  let debugSource: RosyVoiceIdSource | undefined = voiceIdSource
  let ttsPath: 'direct' | 'edge' | null = null

  if (apiKey && voiceId) {
    const direct = await fetchElevenLabsDirect(apiKey, voiceId, finalText)
    if (direct && direct.buffer.byteLength > 0) {
      buffer = direct.buffer
      requestUrl = direct.requestUrl
      httpStatus = direct.httpStatus
      ttsPath = 'direct'
    }
  }

  if (!buffer || buffer.byteLength === 0) {
    if (canUseRosyTtsEdge()) {
      console.log('[Rosy voice] falling back to rosey-tts edge')
      const edge = await fetchRosyTtsFromEdge(finalText)
      if (edge) {
        buffer = edge.buffer
        requestUrl = edge.requestUrl
        httpStatus = edge.httpStatus
        debugVoiceId = '(server)'
        debugSource = 'edge'
        ttsPath = 'edge'
      }
    }
  }

  if (!buffer || buffer.byteLength === 0) {
    if (isWebSpeechFallbackEnabled()) return speakWithWebApi(finalText)
    emitVoicePhase('idle')
    const hint =
      canUseRosyTtsEdge() && !apiKey
        ? 'انشري دالة rosey-tts على Supabase واضيفي أسرار ELEVENLABS_API_KEY و ELEVENLABS_VOICE_ID'
        : apiKey && !voiceId
          ? 'اضيفي voice_id في rosey_voice_config أو VITE_ELEVENLABS_VOICE_ID'
          : !apiKey && !canUseRosyTtsEdge()
            ? 'اضيفي VITE_ELEVENLABS_API_KEY أو ELEVENLABS_API_KEY ثم أعيدي بناء التطبيق'
            : 'تعذّر جلب الصوت — تحققي من مفتاح ElevenLabs أو دالة rosey-tts'
    return {
      ok: false,
      usedElevenLabs: false,
      ttsRoute: 'none',
      audioOk: false,
      error: hint,
      debug: {
        voiceId: debugVoiceId || undefined,
        voiceIdSource: debugSource,
        requestUrl: requestUrl || undefined,
        httpStatus,
        ttsRoute: 'none',
        audioPlaybackOk: false,
        failureReason: 'no audio buffer from direct or edge',
      },
    }
  }

  const playbackRoute: 'direct' | 'edge' = ttsPath === 'edge' ? 'edge' : 'direct'

  try {
    return await playBufferToCompletion(
      buffer,
      {
        voiceId: debugVoiceId || undefined,
        voiceIdSource: debugSource,
        requestUrl,
        httpStatus,
      },
      playbackRoute,
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'playback failed'
    console.error('[Rosy voice] playback failed', msg, e)
    stopRosyVoicePlayback()
    if (isWebSpeechFallbackEnabled()) return speakWithWebApi(finalText)
    emitVoicePhase('idle')
    return {
      ok: false,
      usedElevenLabs: false,
      ttsRoute: playbackRoute,
      audioOk: false,
      error: msg,
      debug: {
        voiceId: debugVoiceId || undefined,
        voiceIdSource: debugSource,
        requestUrl,
        httpStatus,
        ttsRoute: playbackRoute,
        audioPlaybackOk: false,
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
  console.log('[Rosy voice] E2E summary', { ttsRoute: r.ttsRoute, audioOk: r.audioOk, ok: r.ok })
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { testRosyVoiceDirect: () => Promise<void> }).testRosyVoiceDirect = () => testVoiceDirect()
}

export const ROSY_VOICE_PHASE_EVENT = VOICE_PHASE
