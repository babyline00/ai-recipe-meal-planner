import { test, expect, describe } from 'bun:test'
import { filterByCuisine } from '../cuisine-filter'
import { RECIPES } from '../recipe-data'

describe('filterByCuisine', () => {
  test('no exclusions returns all recipes', () => {
    const out = filterByCuisine(RECIPES, [])
    expect(out.length).toBe(RECIPES.length)
  })

  test('excluding [Italian] removes all Italian recipes', () => {
    const out = filterByCuisine(RECIPES, ['Italian'])
    for (const r of out) {
      expect(r.cuisine).not.toBe('Italian')
    }
    const italian = RECIPES.filter((r) => r.cuisine === 'Italian')
    expect(italian.length).toBeGreaterThan(0)
    expect(out.length).toBe(RECIPES.length - italian.length)
  })

  test('excluding multiple cuisines removes the union', () => {
    const out = filterByCuisine(RECIPES, ['Italian', 'Mexican'])
    for (const r of out) {
      expect(r.cuisine).not.toBe('Italian')
      expect(r.cuisine).not.toBe('Mexican')
    }
  })

  test('excluding every cuisine yields an empty list', () => {
    const allCuisines = Array.from(new Set(RECIPES.map((r) => r.cuisine))) as any
    const out = filterByCuisine(RECIPES, allCuisines)
    expect(out.length).toBe(0)
  })
})
