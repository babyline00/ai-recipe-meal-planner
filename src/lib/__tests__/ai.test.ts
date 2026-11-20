import { test, expect, describe } from 'bun:test'
import {
  MockProvider,
  getSwapProvider,
  __setSwapProviderForTest,
  type ChatProvider,
} from '../ai'
import type { Recipe, UserProfile } from '../types'

function fakeRecipe(id: string, title: string, cost: number): Recipe {
  return {
    id,
    title,
    cuisine: 'American',
    ingredients: [{ name: 'x', qty: 1, unit: 'cup', unitCostCents: cost, category: 'pantry' }],
    instructions: ['cook'],
    prepTime: 1,
    cookTime: 5,
    servings: 1,
    macros: { calories: 300, protein: 15, carbs: 30, fat: 10 },
    tags: ['vegetarian'],
    allergens: [],
    suitableMeals: ['dinner'],
  }
}

const profile: UserProfile = {
  id: 'p',
  name: 'p',
  macroTargets: { calories: 2000, protein: 100, carbs: 200, fat: 60 },
  allergies: [],
  pantry: [],
  weeklyBudgetCents: 10000,
  excludedCuisines: [],
}

describe('MockProvider (swap suggestions)', () => {
  const current = fakeRecipe('r0', 'Pad Thai', 300)
  const candidates = [
    fakeRecipe('r1', 'Veggie Tacos', 150),
    fakeRecipe('r2', 'Lentil Soup', 200),
    fakeRecipe('r3', 'Beef Stew', 350),
  ]

  test('returns a deterministic suggestion for identical inputs', async () => {
    const p = new MockProvider()
    const a = await p.suggestSwap({ current, candidates, constraints: 'vegetarian', profile })
    const b = await p.suggestSwap({ current, candidates, constraints: 'vegetarian', profile })
    expect(a).toEqual(b)
  })

  test('suggestion references the current recipe title', async () => {
    const p = new MockProvider()
    const r = await p.suggestSwap({ current, candidates, constraints: 'vegetarian', profile })
    expect(r.message).toContain('Pad Thai')
  })

  test('picks the cheapest candidate as the swap target', async () => {
    const p = new MockProvider()
    const r = await p.suggestSwap({ current, candidates, constraints: '', profile })
    expect(r.recipeId).toBe('r1') // Veggie Tacos @ 150c is the cheapest
  })

  test('falls back to the first candidate when only one is available', async () => {
    const p = new MockProvider()
    const r = await p.suggestSwap({
      current,
      candidates: [fakeRecipe('only', 'Only Option', 999)],
      constraints: '',
      profile,
    })
    expect(r.recipeId).toBe('only')
  })

  test('returns no recipeId when the candidate pool is empty', async () => {
    const p = new MockProvider()
    const r = await p.suggestSwap({ current, candidates: [], constraints: '', profile })
    expect(r.recipeId).toBeUndefined()
    expect(r.message).toContain('Pad Thai')
  })

  test('getSwapProvider returns the injected provider via __setSwapProviderForTest', async () => {
    class FixedProvider implements ChatProvider {
      async suggestSwap() {
        return { recipeId: 'fixed', message: 'fixed message' }
      }
    }
    __setSwapProviderForTest(new FixedProvider())
    const provider = getSwapProvider()
    const r = await provider.suggestSwap({ current, candidates, constraints: '', profile })
    expect(r.recipeId).toBe('fixed')
    expect(r.message).toBe('fixed message')
    __setSwapProviderForTest(null)
  })

  test('getSwapProvider returns a MockProvider when ARP_DISABLE_LLM is set', async () => {
    const prev = process.env.ARP_DISABLE_LLM
    process.env.ARP_DISABLE_LLM = '1'
    __setSwapProviderForTest(null)
    const provider = getSwapProvider()
    expect(provider).toBeInstanceOf(MockProvider)
    const r = await provider.suggestSwap({ current, candidates, constraints: '', profile })
    expect(r.recipeId).toBe('r1')
    process.env.ARP_DISABLE_LLM = prev
    __setSwapProviderForTest(null)
  })
})
