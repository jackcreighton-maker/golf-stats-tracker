import type { Course, HoleEntry, Round } from '../types'

/**
 * Strokes received on a hole for a given playing handicap, allocated by stroke index.
 * Standard allocation: floor(ph/18) on every hole, +1 on holes with SI <= ph % 18.
 * Plus handicaps (negative) give strokes back starting at the highest stroke index.
 */
export function strokesReceived(playingHandicap: number, strokeIndex: number): number {
  if (playingHandicap >= 0) {
    const base = Math.floor(playingHandicap / 18)
    const extra = strokeIndex <= playingHandicap % 18 ? 1 : 0
    return base + extra
  }
  const give = -playingHandicap // e.g. +2 handicap gives back on SI 18 and 17
  const base = -Math.floor(give / 18)
  const extra = strokeIndex > 18 - (give % 18) ? -1 : 0
  return base + extra
}

/** Stableford points for one hole. Picked up or no score = 0 points. */
export function stablefordPoints(entry: HoleEntry, par: number, playingHandicap: number, strokeIndex: number): number {
  if (entry.score == null || entry.pickedUp) return 0
  const net = entry.score - strokesReceived(playingHandicap, strokeIndex)
  return Math.max(0, 2 + par - net)
}

export function netScore(entry: HoleEntry, playingHandicap: number, strokeIndex: number): number | null {
  if (entry.score == null || entry.pickedUp) return null
  return entry.score - strokesReceived(playingHandicap, strokeIndex)
}

export interface RoundTotals {
  holesEntered: number
  gross: number
  /** Gross relative to par over entered holes */
  toPar: number
  points: number
  putts: number
  penalties: number
}

export function roundTotals(round: Round, course: Course): RoundTotals {
  let gross = 0
  let toPar = 0
  let points = 0
  let putts = 0
  let penalties = 0
  let holesEntered = 0
  for (const entry of round.holes) {
    const info = course.holes[entry.hole - 1]
    if (!info) continue
    if (entry.score != null) {
      holesEntered++
      gross += entry.score
      toPar += entry.score - info.par
      points += stablefordPoints(entry, info.par, round.playingHandicap, info.strokeIndex)
    }
    if (entry.putts != null) putts += entry.putts
    penalties += entry.penalties
  }
  return { holesEntered, gross, toPar, points, putts, penalties }
}
