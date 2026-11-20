/**
 * Cost estimator — computes the cost (in cents) to cook a recipe for a given
 * number of servings. Cost scales linearly with servings: cooking half a
 * recipe costs half as much, cooking double costs double.
 *
 * Pure functions.
 */

import type { Recipe } from './types'

/** Cost in cents to cook the recipe as-written (recipe.servings). */
export function recipeCostCents(recipe: Recipe): number {
  return recipe.ingredients.reduce((sum, ing) => sum + ing.qty * ing.unitCostCents, 0)
}

/**
 * Cost in cents to cook `servings` portions of the recipe.
 * Linear in `servings`: estimateRecipeCost(r, s) = recipeCostCents(r) * (s / r.servings).
 */
export function estimateRecipeCost(recipe: Recipe, servings: number): number {
  if (recipe.servings <= 0) return 0
  const perServing = recipeCostCents(recipe) / recipe.servings
  return Math.round(perServing * servings)
}
