/**
 * Web `MediaRecorder` helpers — this app is Vite + React (Capacitor), not Expo.
 * Use these instead of `expo-av` `Audio.Recording` for browser / WebView recording.
 */

export function pickMediaRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return undefined
}

export function isMediaRecorderSupported(): boolean {
  return typeof MediaRecorder !== 'undefined'
}
