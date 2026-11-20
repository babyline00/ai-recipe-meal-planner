/**
 * Cook-time filter — keeps only recipes whose `cookTime` is <= `maxMinutes`.
 * For this app, maxMinutes is always 30 (every meal must cook in under 30 min).
 *
 * Pure function.
 */

import type { Recipe } from './types'

export function filterByCookTime(recipes: Recipe[], maxMinutes: number): Recipe[] {
  return recipes.filter((r) => r.cookTime <= maxMinutes)
}
