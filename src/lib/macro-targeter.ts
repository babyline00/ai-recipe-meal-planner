/**
 * Macro-targeting helpers — summing, scaling, and distance between macro
 * targets. Used by the planner to pick recipes that balance each day's macros.
 *
 * All pure functions.
 */

import type { Macros, PlanSlot } from './types'

export function zeroMacros(): Macros {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 }
}

export function sumMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  }
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    calories: m.calories * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
  }
}

/**
 * Sum the macros of a list of plan slots (typically the 3 slots for one day).
 */
export function computeDayMacros(slots: PlanSlot[]): Macros {
  return slots.reduce((acc, s) => sumMacros(acc, s.macros), zeroMacros())
}

/**
 * Average per-day macros across all 7 days of the plan. Used as the
 * `totalMacros` summary returned to the UI.
 */
export function computeAverageDayMacros(allSlots: PlanSlot[]): Macros {
  if (allSlots.length === 0) return zeroMacros()
  const total = allSlots.reduce((acc, s) => sumMacros(acc, s.macros), zeroMacros())
  return scaleMacros(total, 1 / 7)
}

/**
 * Normalised Euclidean distance between two macro sets, expressed in
 * *percentage* deviations so 100kcal off on a 2000kcal target is comparable
 * to 5g off on a 100g protein target. The denominator is clamped to >=1 so a
 * zero target doesn't blow up.
 */
export function macroDistance(a: Macros, b: Macros): number {
  const dCal = (a.calories - b.calories) / Math.max(b.calories, 1)
  const dPro = (a.protein - b.protein) / Math.max(b.protein, 1)
  const dCar = (a.carbs - b.carbs) / Math.max(b.carbs, 1)
  const dFat = (a.fat - b.fat) / Math.max(b.fat, 1)
  return Math.sqrt(dCal * dCal + dPro * dPro + dCar * dCar + dFat * dFat)
}

/**
 * True when any macro of `actual` is more than `tolerance` (default 10%) off
 * the corresponding `target`.
 */
export function isOffTarget(actual: Macros, target: Macros, tolerance = 0.1): boolean {
  const keys: (keyof Macros)[] = ['calories', 'protein', 'carbs', 'fat']
  return keys.some((k) => {
    const t = Math.max(target[k], 1)
    return Math.abs(actual[k] - target[k]) / t > tolerance
  })
}
