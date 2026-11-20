/**
 * Allergen filter — removes any recipe whose `allergens` intersect the user's
 * `allergies`. This is a strict avoid-list: a recipe with [milk, eggs] is
 * excluded if the user is allergic to EITHER milk OR eggs.
 *
 * Pure function — safe to unit-test with `bun test` without Next.js or Prisma.
 */

import type { Recipe, Allergen } from './types'

export function filterByAllergy(recipes: Recipe[], allergies: Allergen[]): Recipe[] {
  if (!allergies || allergies.length === 0) return recipes.slice()
  const set = new Set(allergies)
  return recipes.filter((r) => !r.allergens.some((a) => set.has(a)))
}
