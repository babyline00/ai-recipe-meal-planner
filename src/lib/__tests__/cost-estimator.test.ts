import { test, expect, describe } from 'bun:test'
import { estimateRecipeCost, recipeCostCents } from '../cost-estimator'
import { RECIPES, RECIPES_BY_ID } from '../recipe-data'

describe('cost-estimator', () => {
  test('recipeCostCents sums qty * unitCostCents across ingredients', () => {
    // avocado-toast: bread40 + avocado150 + egg25 + lemon5 = 220
    const r = RECIPES_BY_ID['avocado-toast']
    expect(recipeCostCents(r)).toBe(40 + 150 + 25 + 5)
    expect(recipeCostCents(r)).toBe(220)
  })

  test('estimateRecipeCost for the recipe as-written equals recipeCostCents', () => {
    for (const r of RECIPES) {
      expect(estimateRecipeCost(r, r.servings)).toBe(recipeCostCents(r))
    }
  })

  test('estimateRecipeCost scales linearly with servings (servings=1 recipe)', () => {
    const r = RECIPES_BY_ID['avocado-toast'] // servings = 1
    const base = estimateRecipeCost(r, 1)
    expect(estimateRecipeCost(r, 2)).toBe(2 * base)
    expect(estimateRecipeCost(r, 3)).toBe(3 * base)
    expect(estimateRecipeCost(r, 4)).toBe(4 * base)
  })

  test('estimateRecipeCost scales linearly with servings (multi-serving recipe)', () => {
    // banana-pancakes: servings = 2, base cost = 170
    const r = RECIPES_BY_ID['banana-pancakes']
    expect(estimateRecipeCost(r, 2)).toBe(170)
    expect(estimateRecipeCost(r, 4)).toBe(340)
    expect(estimateRecipeCost(r, 1)).toBe(85)
    // ratio property: cost(4) / cost(2) === 4 / 2
    expect(estimateRecipeCost(r, 4) / estimateRecipeCost(r, 2)).toBe(2)
  })

  test('estimateRecipeCost(0) returns 0', () => {
    const r = RECIPES_BY_ID['avocado-toast']
    expect(estimateRecipeCost(r, 0)).toBe(0)
  })
})
