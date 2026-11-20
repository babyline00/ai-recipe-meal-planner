import { test, expect, describe } from 'bun:test'
import { generateShoppingList, normalizeIngredientName, totalShoppingCostCents } from '../shopping-list'
import type { Recipe, PlanSlot, PantryItem } from '../types'

const recipe: Recipe = {
  id: 'r1',
  title: 'Test Eggs',
  cuisine: 'American',
  ingredients: [
    { name: 'Eggs', qty: 2, unit: 'piece', unitCostCents: 25, category: 'dairy' },
    { name: 'Spinach', qty: 1, unit: 'cup', unitCostCents: 100, category: 'produce' },
  ],
  instructions: ['cook eggs', 'add spinach'],
  prepTime: 2,
  cookTime: 5,
  servings: 1,
  macros: { calories: 200, protein: 14, carbs: 4, fat: 12 },
  tags: ['vegetarian'],
  allergens: ['eggs'],
  suitableMeals: ['breakfast'],
}

const recipes = { r1: recipe }

function slot(): PlanSlot {
  return {
    day: 0,
    meal: 'breakfast',
    recipeId: 'r1',
    scaledServings: 1,
    macros: { calories: 200, protein: 14, carbs: 4, fat: 12 },
    cost: 150,
  }
}

describe('generateShoppingList', () => {
  test('pantry item fully covers needed qty -> buyQty 0, cost 0', () => {
    const pantry: PantryItem[] = [{ name: 'eggs', qty: 2, unit: 'piece' }]
    const list = generateShoppingList([slot()], pantry, recipes)
    const eggs = list.find((i) => i.ingredient.toLowerCase() === 'eggs')!
    expect(eggs.neededQty).toBe(2)
    expect(eggs.haveQty).toBe(2)
    expect(eggs.buyQty).toBe(0)
    expect(eggs.estimatedCostCents).toBe(0)
  })

  test('pantry partially covers -> buyQty = needed - have', () => {
    const pantry: PantryItem[] = [{ name: 'eggs', qty: 1, unit: 'piece' }]
    const list = generateShoppingList([slot()], pantry, recipes)
    const eggs = list.find((i) => i.ingredient.toLowerCase() === 'eggs')!
    expect(eggs.buyQty).toBe(1)
    expect(eggs.estimatedCostCents).toBe(25) // 1 * 25c
  })

  test('pantry empty -> buyQty = needed', () => {
    const list = generateShoppingList([slot()], [], recipes)
    const eggs = list.find((i) => i.ingredient.toLowerCase() === 'eggs')!
    const spinach = list.find((i) => i.ingredient.toLowerCase() === 'spinach')!
    expect(eggs.buyQty).toBe(2)
    expect(eggs.estimatedCostCents).toBe(50)
    expect(spinach.buyQty).toBe(1)
    expect(spinach.estimatedCostCents).toBe(100)
  })

  test('estimatedCostCents = buyQty * unitCostCents', () => {
    const list = generateShoppingList([slot()], [], recipes)
    for (const item of list) {
      expect(item.estimatedCostCents).toBe(Math.round(item.buyQty * item.unitCostCents))
    }
  })

  test('aggregates needed qty across multiple slots', () => {
    const slots: PlanSlot[] = [slot(), slot(), slot()]
    const list = generateShoppingList(slots, [], recipes)
    const eggs = list.find((i) => i.ingredient.toLowerCase() === 'eggs')!
    expect(eggs.neededQty).toBe(6) // 2 per slot * 3 slots
    expect(eggs.buyQty).toBe(6)
  })

  test('normalised name matching is case-insensitive', () => {
    expect(normalizeIngredientName('Eggs')).toBe('eggs')
    expect(normalizeIngredientName('  Greek  Yogurt ')).toBe('greek yogurt')
    // pantry 'eggs' matches recipe 'Eggs'
    const pantry: PantryItem[] = [{ name: 'EGGS', qty: 2, unit: 'piece' }]
    const list = generateShoppingList([slot()], pantry, recipes)
    const eggs = list.find((i) => i.ingredient.toLowerCase() === 'eggs')!
    expect(eggs.haveQty).toBe(2)
    expect(eggs.buyQty).toBe(0)
  })

  test('totalShoppingCostCents sums the buy costs', () => {
    const list = generateShoppingList([slot()], [], recipes)
    expect(totalShoppingCostCents(list)).toBe(50 + 100)
  })
})
