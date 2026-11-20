import { test, expect, describe } from 'bun:test'
import { RECIPES, RECIPES_BY_ID } from '../recipe-data'
import type { IngredientCategory } from '../types'

const VALID_CATEGORIES: IngredientCategory[] = ['produce', 'dairy', 'meat', 'pantry']

describe('recipe-data integrity', () => {
  test('has at least 40 recipes', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(40)
  })

  test('all recipe ids are unique', () => {
    const ids = RECIPES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every recipe has a non-empty title', () => {
    for (const r of RECIPES) {
      expect(typeof r.title).toBe('string')
      expect(r.title.trim().length).toBeGreaterThan(0)
    }
  })

  test('every recipe has a cuisine', () => {
    for (const r of RECIPES) {
      expect(typeof r.cuisine).toBe('string')
      expect(r.cuisine.length).toBeGreaterThan(0)
    }
  })

  test('every recipe has a non-empty ingredients list', () => {
    for (const r of RECIPES) {
      expect(Array.isArray(r.ingredients)).toBe(true)
      expect(r.ingredients.length).toBeGreaterThan(0)
    }
  })

  test('every ingredient has name, qty>0, unit, unitCostCents>0, valid category', () => {
    for (const r of RECIPES) {
      for (const ing of r.ingredients) {
        expect(typeof ing.name).toBe('string')
        expect(ing.name.length).toBeGreaterThan(0)
        expect(typeof ing.qty).toBe('number')
        expect(ing.qty).toBeGreaterThan(0)
        expect(typeof ing.unit).toBe('string')
        expect(ing.unit.length).toBeGreaterThan(0)
        expect(typeof ing.unitCostCents).toBe('number')
        expect(ing.unitCostCents).toBeGreaterThan(0)
        expect(VALID_CATEGORIES).toContain(ing.category)
      }
    }
  })

  test('every recipe has a non-empty instructions list', () => {
    for (const r of RECIPES) {
      expect(Array.isArray(r.instructions)).toBe(true)
      expect(r.instructions.length).toBeGreaterThan(0)
      for (const step of r.instructions) {
        expect(typeof step).toBe('string')
        expect(step.trim().length).toBeGreaterThan(0)
      }
    }
  })

  test('every recipe has cookTime <= 30 (hard guarantee)', () => {
    for (const r of RECIPES) {
      expect(typeof r.cookTime).toBe('number')
      expect(r.cookTime).toBeLessThanOrEqual(30)
      expect(r.cookTime).toBeGreaterThanOrEqual(0)
    }
  })

  test('every recipe has servings >= 1', () => {
    for (const r of RECIPES) {
      expect(r.servings).toBeGreaterThanOrEqual(1)
    }
  })

  test('every recipe has complete macros (calories/protein/carbs/fat >= 0)', () => {
    for (const r of RECIPES) {
      expect(typeof r.macros.calories).toBe('number')
      expect(r.macros.calories).toBeGreaterThanOrEqual(0)
      expect(typeof r.macros.protein).toBe('number')
      expect(r.macros.protein).toBeGreaterThanOrEqual(0)
      expect(typeof r.macros.carbs).toBe('number')
      expect(r.macros.carbs).toBeGreaterThanOrEqual(0)
      expect(typeof r.macros.fat).toBe('number')
      expect(r.macros.fat).toBeGreaterThanOrEqual(0)
    }
  })

  test('every recipe has tags and allergens arrays', () => {
    for (const r of RECIPES) {
      expect(Array.isArray(r.tags)).toBe(true)
      expect(Array.isArray(r.allergens)).toBe(true)
    }
  })

  test('every recipe declares at least one suitable meal slot', () => {
    for (const r of RECIPES) {
      expect(Array.isArray(r.suitableMeals)).toBe(true)
      expect(r.suitableMeals.length).toBeGreaterThan(0)
    }
  })

  test('RECIPES_BY_ID maps every recipe by id', () => {
    for (const r of RECIPES) {
      expect(RECIPES_BY_ID[r.id]).toBeDefined()
      expect(RECIPES_BY_ID[r.id].title).toBe(r.title)
    }
  })
})
