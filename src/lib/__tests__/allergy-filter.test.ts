import { test, expect, describe } from 'bun:test'
import { filterByAllergy } from '../allergy-filter'
import { RECIPES } from '../recipe-data'

describe('filterByAllergy', () => {
  test('user with no allergies returns all recipes', () => {
    const out = filterByAllergy(RECIPES, [])
    expect(out.length).toBe(RECIPES.length)
  })

  test('user with [milk] allergy excludes every recipe containing milk', () => {
    const out = filterByAllergy(RECIPES, ['milk'])
    for (const r of out) {
      expect(r.allergens).not.toContain('milk')
    }
    // sanity: there DO exist milk recipes in the dataset that get filtered out
    const milkRecipes = RECIPES.filter((r) => r.allergens.includes('milk'))
    expect(milkRecipes.length).toBeGreaterThan(0)
    expect(out.length).toBeLessThan(RECIPES.length)
  })

  test('user with multiple allergens excludes the union', () => {
    const out = filterByAllergy(RECIPES, ['milk', 'eggs'])
    for (const r of out) {
      expect(r.allergens).not.toContain('milk')
      expect(r.allergens).not.toContain('eggs')
    }
  })

  test('preserves recipes that have no allergens at all', () => {
    const noAllergen = RECIPES.filter((r) => r.allergens.length === 0)
    expect(noAllergen.length).toBeGreaterThan(0)
    const out = filterByAllergy(RECIPES, ['milk', 'eggs', 'nuts', 'soy', 'wheat', 'fish', 'shellfish'])
    // only truly allergen-free recipes survive the union-of-all filter
    expect(out.length).toBe(noAllergen.length)
    for (const r of out) {
      expect(r.allergens.length).toBe(0)
    }
  })

  test('does not mutate the input array', () => {
    const before = RECIPES.length
    filterByAllergy(RECIPES, ['milk'])
    expect(RECIPES.length).toBe(before)
  })
})
