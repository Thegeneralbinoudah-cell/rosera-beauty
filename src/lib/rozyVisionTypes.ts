/** Strict JSON shape returned by `rozi-vision` Edge Function (validated server-side). */
export type RozyVisionMode = 'hand' | 'face'

export type RozyVisionConfidence = 'high' | 'medium' | 'low'

export type RozyVisionUndertone = 'warm' | 'cool' | 'neutral' | 'uncertain'

export type RozyVisionFaceShape = 'oval' | 'round' | 'square' | 'heart' | 'uncertain'

export type RozyVisionResult = {
  mode: RozyVisionMode
  confidence: RozyVisionConfidence
  qualityOk: boolean
  summaryAr: string
  undertone: RozyVisionUndertone
  faceShape: RozyVisionFaceShape
  /** hand: nail polish colors; face: always [] — each entry: Arabic name + (#HEX) */
  recommendedColors: string[]
  /** hand: shades that often clash; face: always [] — Arabic + (#HEX) when possible */
  colorsToAvoid: string[]
  /** face: hair color suggestions; hand: [] */
  recommendedHairColors: string[]
  /** face: haircut / style names; hand: [] */
  recommendedHaircuts: string[]
  /** face: soft limits / uncertainty (no absolute claims); hand: [] */
  cautionNotes: string[]
  /** when qualityOk is false: fixed retry hints; otherwise [] */
  retryTips: string[]
  nextActions: string[]
}
