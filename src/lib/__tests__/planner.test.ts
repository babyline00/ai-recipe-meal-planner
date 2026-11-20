import { test, expect, describe } from 'bun:test'
import { generateWeeklyPlan } from '../planner'
import { RECIPES, RECIPES_BY_ID } from '../recipe-data'
import { MEAL_ORDER, type UserProfile } from '../types'

const testProfile: UserProfile = {
  id: 'test',
  name: 'test',
  macroTargets: { calories: 2000, protein: 120, carbs: 220, fat: 65 },
  allergies: ['milk'],
  pantry: [
    { name: 'salt', qty: 8, unit: 'tsp' },
    { name: 'olive oil', qty: 16, unit: 'tbsp' },
    { name: 'rice', qty: 6, unit: 'cup' },
  ],
  weeklyBudgetCents: 20000,
  excludedCuisines: [],
}

describe('generateWeeklyPlan', () => {
  const result = generateWeeklyPlan(testProfile, RECIPES)

  test('returns exactly 21 slots (7 days x 3 meals)', () => {
    expect(result.slots.length).toBe(21)
  })

  test('every slot has a recipeId', () => {
    for (const s of result.slots) {
      expect(typeof s.recipeId).toBe('string')
      expect(s.recipeId.length).toBeGreaterThan(0)
    }
  })

  test('slots span 7 days with 3 meals each in breakfast/lunch/dinner order', () => {
    for (let day = 0; day < 7; day++) {
      const daySlots = result.slots.filter((s) => s.day === day)
      expect(daySlots.length).toBe(3)
      expect(daySlots.map((s) => s.meal)).toEqual(MEAL_ORDER)
    }
  })

  test('no recipe is used more than 3 times in the week (variety constraint)', () => {
    const counts = new Map<string, number>()
    for (const s of result.slots) {
      counts.set(s.recipeId, (counts.get(s.recipeId) ?? 0) + 1)
    }
    for (const [, c] of counts) {
      expect(c).toBeLessThanOrEqual(3)
    }
  })

  test('all allergens are respected (no milk recipe survives for milk-allergic user)', () => {
    for (const s of result.slots) {
      const r = RECIPES_BY_ID[s.recipeId]
      expect(r).toBeDefined()
      for (const a of testProfile.allergies) {
        expect(r.allergens).not.toContain(a)
      }
    }
  })

  test('every slot recipe has cookTime <= 30', () => {
    for (const s of result.slots) {
      const r = RECIPES_BY_ID[s.recipeId]
      expect(r.cookTime).toBeLessThanOrEqual(30)
    }
  })

  test('every slot recipe is suitable for its meal type', () => {
    for (const s of result.slots) {
      const r = RECIPES_BY_ID[s.recipeId]
      expect(r.suitableMeals).toContain(s.meal)
    }
  })

  test('total weekly cost does not exceed the budget (or is the closest achievable)', () => {
    expect(result.totalCostCents).toBeLessThanOrEqual(testProfile.weeklyBudgetCents)
    expect(result.overBudget).toBe(false)
  })

  test('totalMacros has all four macro fields', () => {
    expect(typeof result.totalMacros.calories).toBe('number')
    expect(typeof result.totalMacros.protein).toBe('number')
    expect(typeof result.totalMacros.carbs).toBe('number')
    expect(typeof result.totalMacros.fat).toBe('number')
  })

  test('totalCostCents equals the sum of slot costs', () => {
    const sum = result.slots.reduce((acc, s) => acc + s.cost, 0)
    expect(result.totalCostCents).toBe(sum)
  })

  test('works with an empty-allergy profile (still 21 slots, no exceptions)', () => {
    const noAllergyProfile: UserProfile = { ...testProfile, allergies: [] }
    const r = generateWeeklyPlan(noAllergyProfile, RECIPES)
    expect(r.slots.length).toBe(21)
  })

  test('respects excluded cuisines', () => {
    const p: UserProfile = { ...testProfile, excludedCuisines: ['Italian'] }
    const r = generateWeeklyPlan(p, RECIPES)
    for (const s of r.slots) {
      expect(RECIPES_BY_ID[s.recipeId].cuisine).not.toBe('Italian')
    }
  })
})
