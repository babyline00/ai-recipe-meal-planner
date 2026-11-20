import { test, expect, describe } from 'bun:test'
import {
  computeDayMacros,
  sumMacros,
  scaleMacros,
  macroDistance,
  isOffTarget,
  zeroMacros,
} from '../macro-targeter'
import type { PlanSlot, Macros } from '../types'

const slot = (cal: number, pro: number, car: number, fat: number): PlanSlot => ({
  day: 0,
  meal: 'breakfast',
  recipeId: 'r',
  scaledServings: 1,
  macros: { calories: cal, protein: pro, carbs: car, fat },
  cost: 0,
})

describe('macro-targeter', () => {
  test('zeroMacros returns all zeros', () => {
    const z = zeroMacros()
    expect(z).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })

  test('sumMacros adds each field', () => {
    const a: Macros = { calories: 100, protein: 10, carbs: 20, fat: 5 }
    const b: Macros = { calories: 200, protein: 30, carbs: 40, fat: 15 }
    expect(sumMacros(a, b)).toEqual({ calories: 300, protein: 40, carbs: 60, fat: 20 })
  })

  test('scaleMacros multiplies each field', () => {
    const m: Macros = { calories: 200, protein: 10, carbs: 30, fat: 5 }
    expect(scaleMacros(m, 2)).toEqual({ calories: 400, protein: 20, carbs: 60, fat: 10 })
  })

  test('computeDayMacros sums the macros of all slots', () => {
    const slots: PlanSlot[] = [
      slot(400, 20, 40, 15),
      slot(600, 30, 70, 20),
      slot(500, 25, 55, 18),
    ]
    const day = computeDayMacros(slots)
    expect(day).toEqual({ calories: 1500, protein: 75, carbs: 165, fat: 53 })
  })

  test('computeDayMacros on empty list returns zeros', () => {
    expect(computeDayMacros([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })

  test('macroDistance is 0 for identical macros', () => {
    const m: Macros = { calories: 500, protein: 30, carbs: 60, fat: 20 }
    expect(macroDistance(m, m)).toBe(0)
  })

  test('macroDistance increases as macros diverge', () => {
    const target: Macros = { calories: 600, protein: 30, carbs: 60, fat: 20 }
    const close: Macros = { calories: 580, protein: 29, carbs: 58, fat: 19 }
    const far: Macros = { calories: 300, protein: 10, carbs: 30, fat: 5 }
    expect(macroDistance(close, target)).toBeLessThan(macroDistance(far, target))
  })

  test('isOffTarget is false when within 10% tolerance', () => {
    const target: Macros = { calories: 2000, protein: 100, carbs: 200, fat: 60 }
    const actual: Macros = { calories: 2050, protein: 98, carbs: 210, fat: 58 }
    expect(isOffTarget(actual, target, 0.1)).toBe(false)
  })

  test('isOffTarget is true when any macro is > 10% off', () => {
    const target: Macros = { calories: 2000, protein: 100, carbs: 200, fat: 60 }
    // 2300 cal is 15% over 2000 -> strictly > 10% off
    const actual: Macros = { calories: 2300, protein: 100, carbs: 200, fat: 60 }
    expect(isOffTarget(actual, target, 0.1)).toBe(true)
  })

  test('isOffTarget is false when exactly 10% off (boundary is inclusive-not-off)', () => {
    const target: Macros = { calories: 2000, protein: 100, carbs: 200, fat: 60 }
    const actual: Macros = { calories: 2200, protein: 100, carbs: 200, fat: 60 }
    expect(isOffTarget(actual, target, 0.1)).toBe(false)
  })
})
