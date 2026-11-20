/**
 * Cuisine filter — removes recipes whose cuisine is in the user's
 * `excludedCuisines` list (e.g. a user who dislikes Italian food).
 *
 * Pure function.
 */

import type { Recipe, Cuisine } from './types'

export function filterByCuisine(recipes: Recipe[], excludedCuisines: Cuisine[]): Recipe[] {
  if (!excludedCuisines || excludedCuisines.length === 0) return recipes.slice()
  const set = new Set(excludedCuisines)
  return recipes.filter((r) => !set.has(r.cuisine))
}
