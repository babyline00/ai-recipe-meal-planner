/**
 * Pantry-aware shopping list generator.
 *
 * `generateShoppingList(slots, pantry)` aggregates every ingredient across the
 * plan's 21 slots (scaled by scaledServings / recipe.servings), then subtracts
 * what the user already owns (matched by normalised ingredient name). The
 * result is the buy quantity and estimated cost for each ingredient the user
 * still needs to purchase.
 *
 * Pure function — the recipe lookup table is injected (defaults to the
 * hardcoded RECIPES_BY_ID) so the unit test can pass a tiny synthetic table.
 */

import type {
  PlanSlot,
  ShoppingListItem,
  PantryItem,
  Recipe,
  IngredientCategory,
} from './types'
import { RECIPES_BY_ID } from './recipe-data'

export function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

export function generateShoppingList(
  slots: PlanSlot[],
  pantry: PantryItem[],
  recipes?: Record<string, Recipe>,
): ShoppingListItem[] {
  const recipeMap = recipes ?? RECIPES_BY_ID
  const needed = new Map<
    string,
    { qty: number; unit: string; unitCostCents: number; category: IngredientCategory; name: string }
  >()

  for (const slot of slots) {
    const recipe = recipeMap[slot.recipeId]
    if (!recipe) continue
    const scale = slot.scaledServings / recipe.servings
    for (const ing of recipe.ingredients) {
      const key = normalizeIngredientName(ing.name)
      const qty = ing.qty * scale
      const existing = needed.get(key)
      if (existing) {
        existing.qty += qty
      } else {
        needed.set(key, {
          qty,
          unit: ing.unit,
          unitCostCents: ing.unitCostCents,
          category: ing.category,
          name: ing.name,
        })
      }
    }
  }

  const pantryMap = new Map<string, PantryItem>()
  for (const p of pantry ?? []) {
    pantryMap.set(normalizeIngredientName(p.name), p)
  }

  const result: ShoppingListItem[] = []
  for (const [, n] of needed) {
    const have = pantryMap.get(normalizeIngredientName(n.name))?.qty ?? 0
    const buy = Math.max(0, n.qty - have)
    result.push({
      ingredient: n.name,
      neededQty: round2(n.qty),
      haveQty: round2(have),
      buyQty: round2(buy),
      unit: n.unit,
      unitCostCents: n.unitCostCents,
      estimatedCostCents: Math.round(buy * n.unitCostCents),
      category: n.category,
    })
  }

  // Sort by category (produce, dairy, meat, pantry) then ingredient name.
  const catOrder: Record<IngredientCategory, number> = {
    produce: 0,
    dairy: 1,
    meat: 2,
    pantry: 3,
  }
  result.sort(
    (a, b) =>
      catOrder[a.category] - catOrder[b.category] ||
      a.ingredient.localeCompare(b.ingredient),
  )
  return result
}

/** Sum of buy costs — convenience for the UI. */
export function totalShoppingCostCents(items: ShoppingListItem[]): number {
  return items.reduce((s, i) => s + i.estimatedCostCents, 0)
}
