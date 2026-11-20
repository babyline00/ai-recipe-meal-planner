import { test, expect, describe } from 'bun:test'
import { filterByCookTime } from '../cook-time-filter'
import { RECIPES } from '../recipe-data'

describe('filterByCookTime', () => {
  test('max 30 keeps every recipe (hard dataset guarantee)', () => {
    const out = filterByCookTime(RECIPES, 30)
    for (const r of out) {
      expect(r.cookTime).toBeLessThanOrEqual(30)
    }
    expect(out.length).toBe(RECIPES.length)
  })

  test('max 0 returns only no-cook recipes', () => {
    const out = filterByCookTime(RECIPES, 0)
    for (const r of out) {
      expect(r.cookTime).toBe(0)
    }
    expect(out.length).toBeGreaterThan(0) // parfaits, smoothies, salads
  })

  test('max 15 returns no recipe with cookTime > 15', () => {
    const out = filterByCookTime(RECIPES, 15)
    for (const r of out) {
      expect(r.cookTime).toBeLessThanOrEqual(15)
    }
  })

  test('max 10 returns no recipe with cookTime > 10', () => {
    const out = filterByCookTime(RECIPES, 10)
    for (const r of out) {
      expect(r.cookTime).toBeLessThanOrEqual(10)
    }
  })
})
