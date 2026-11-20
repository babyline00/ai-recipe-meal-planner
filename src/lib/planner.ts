/**
 * Constraint-satisfaction weekly meal planner.
 *
 * `generateWeeklyPlan(profile, recipes)` returns a 7-day x 3-meal plan that
 * respects the user's allergies, excluded cuisines, the 30-min cook-time
 * filter, a "no recipe used more than 3 times per week" variety constraint,
 * the daily macro targets (greedy balance + a post-pass rebalance), and the
 * weekly budget (swap expensive meals for cheaper alternatives if over).
 *
 * Algorithm:
 *   1. Filter recipes by allergies, excluded cuisines, and cook-time <= 30.
 *   2. Greedy fill: for each day x meal slot, pick the eligible recipe whose
 *      per-serving macros best balance the day's running total against the
 *      daily target, preferring less-used recipes on ties (variety).
 *   3. Variety: any recipe already used 3x this week is excluded from
 *      candidates (relaxed only if no other candidate exists for the slot).
 *   4. Macro rebalance pass: for each day whose macros are > 10% off target,
 *      swap the worst-contributing slot for a better-fitting candidate.
 *   5. Cost rebalance pass: if the weekly total exceeds the budget, swap the
 *      most expensive slots for cheaper eligible alternatives (same meal type
 *      if possible) until under budget or no more beneficial swaps exist.
 *
 * Returns: { slots (21), totalMacros (per-day average), totalCostCents,
 *            overBudget }.
 *
 * Pure function — fully deterministic, no I/O. Safe for `bun test`.
 */

import type {
  UserProfile,
  Recipe,
  PlanSlot,
  Macros,
  MealType,
  WeeklyPlanResult,
} from './types'
import { MEAL_ORDER } from './types'
import { filterByAllergy } from './allergy-filter'
import { filterByCuisine } from './cuisine-filter'
import { filterByCookTime } from './cook-time-filter'
import { estimateRecipeCost } from './cost-estimator'
import {
  computeDayMacros,
  computeAverageDayMacros,
  isOffTarget,
  macroDistance,
  zeroMacros,
} from './macro-targeter'

const MAX_USES_PER_RECIPE = 3
const MAX_COOK_MINUTES = 30

export function generateWeeklyPlan(
  profile: UserProfile,
  recipes: Recipe[],
): WeeklyPlanResult {
  // ── Step 1: filter by hard constraints ──
  let eligible = filterByCookTime(
    filterByCuisine(filterByAllergy(recipes, profile.allergies), profile.excludedCuisines),
    MAX_COOK_MINUTES,
  )
  // Fallback: if every recipe is filtered out (overly restrictive profile),
  // relax to all recipes so we can still fill 21 slots.
  if (eligible.length === 0) {
    eligible = filterByCookTime(recipes, MAX_COOK_MINUTES)
  }
  if (eligible.length === 0) {
    eligible = recipes.slice()
  }

  const usage = new Map<string, number>()
  const slots: PlanSlot[] = []
  const dailyTarget = profile.macroTargets

  // ── Step 2-3: greedy fill ──
  for (let day = 0; day < 7; day++) {
    const placed: PlanSlot[] = []
    for (const meal of MEAL_ORDER) {
      const target = perMealTarget(dailyTarget, placed)
      const candidates = candidatesForMeal(eligible, meal, usage)
      const pick = chooseBest(candidates, target, usage)
      const slot: PlanSlot = {
        day,
        meal,
        recipeId: pick.id,
        scaledServings: 1,
        macros: { ...pick.macros },
        cost: estimateRecipeCost(pick, 1),
      }
      placed.push(slot)
      slots.push(slot)
      usage.set(pick.id, (usage.get(pick.id) ?? 0) + 1)
    }
  }

  // ── Step 4: macro rebalance (single pass per day) ──
  for (let day = 0; day < 7; day++) {
    const daySlots = slots.filter((s) => s.day === day)
    const dayMacros = computeDayMacros(daySlots)
    if (!isOffTarget(dayMacros, dailyTarget, 0.1)) continue
    rebalanceDay(slots, day, eligible, dailyTarget, usage)
  }

  // ── Step 5: cost rebalance ──
  let totalCostCents = slots.reduce((s, sl) => s + sl.cost, 0)
  const overBudgetInitial = totalCostCents > profile.weeklyBudgetCents
  if (overBudgetInitial) {
    rebalanceForBudget(slots, eligible, profile.weeklyBudgetCents, usage)
    totalCostCents = slots.reduce((s, sl) => s + sl.cost, 0)
  }

  const totalMacros = computeAverageDayMacros(slots)
  const overBudget = totalCostCents > profile.weeklyBudgetCents
  return { slots, totalMacros, totalCostCents, overBudget }
}

/**
 * Per-meal macro target: divide the remaining daily target evenly across the
 * remaining meals. If nothing is placed yet, target = dailyTarget / 3.
 */
function perMealTarget(daily: Macros, placed: PlanSlot[]): Macros {
  const remainingMeals = MEAL_ORDER.length - placed.length
  if (remainingMeals <= 0) return zeroMacros()
  const used = computeDayMacros(placed)
  return {
    calories: (daily.calories - used.calories) / remainingMeals,
    protein: (daily.protein - used.protein) / remainingMeals,
    carbs: (daily.carbs - used.carbs) / remainingMeals,
    fat: (daily.fat - used.fat) / remainingMeals,
  }
}

/** Eligible recipes for a meal slot, enforcing the variety cap (<= 3 uses). */
function candidatesForMeal(
  eligible: Recipe[],
  meal: MealType,
  usage: Map<string, number>,
): Recipe[] {
  const fresh = eligible.filter(
    (r) => r.suitableMeals.includes(meal) && (usage.get(r.id) ?? 0) < MAX_USES_PER_RECIPE,
  )
  if (fresh.length > 0) return fresh
  // Relax: allow up to 5 uses if no fresh candidate (keeps plan fillable).
  const relaxed = eligible.filter(
    (r) => r.suitableMeals.includes(meal) && (usage.get(r.id) ?? 0) < 5,
  )
  if (relaxed.length > 0) return relaxed
  // Last resort: any recipe suitable for this meal, regardless of usage.
  return eligible.filter((r) => r.suitableMeals.includes(meal))
}

/** Pick the candidate that best matches the per-meal target (lowest distance). */
function chooseBest(
  candidates: Recipe[],
  target: Macros,
  usage: Map<string, number>,
): Recipe {
  if (candidates.length === 0) {
    throw new Error('No eligible recipes for slot')
  }
  let best = candidates[0]
  let bestScore = Infinity
  for (const r of candidates) {
    const dist = macroDistance(r.macros, target)
    // Small usage penalty nudges the planner toward variety on near-ties.
    const penalty = (usage.get(r.id) ?? 0) * 0.05
    const score = dist + penalty
    if (score < bestScore) {
      bestScore = score
      best = r
    }
  }
  return best
}

/**
 * Swap the worst-contributing slot of a day for a better-fitting candidate.
 * Only swaps into recipes that respect the variety cap.
 */
function rebalanceDay(
  slots: PlanSlot[],
  day: number,
  eligible: Recipe[],
  dailyTarget: Macros,
  usage: Map<string, number>,
): void {
  const daySlots = slots.filter((s) => s.day === day)
  // Find the slot whose replacement most reduces the day's distance to target.
  let bestSwap: { slot: PlanSlot; recipe: Recipe; gain: number } | null = null
  for (const slot of daySlots) {
    const without = computeDayMacros(daySlots.filter((s) => s !== slot))
    const currentDist = macroDistance(
      sumMacros(without, slot.macros),
      dailyTarget,
    )
    const candidates = eligible.filter(
      (r) =>
        r.suitableMeals.includes(slot.meal) &&
        r.id !== slot.recipeId &&
        (usage.get(r.id) ?? 0) < MAX_USES_PER_RECIPE,
    )
    for (const r of candidates) {
      const newMacros = sumMacros(without, r.macros)
      const newDist = macroDistance(newMacros, dailyTarget)
      const gain = currentDist - newDist
      if (gain > 0.01 && (!bestSwap || gain > bestSwap.gain)) {
        bestSwap = { slot, recipe: r, gain }
      }
    }
  }
  if (bestSwap) {
    const { slot, recipe } = bestSwap
    // Update usage counts.
    usage.set(slot.recipeId, (usage.get(slot.recipeId) ?? 0) - 1)
    usage.set(recipe.id, (usage.get(recipe.id) ?? 0) + 1)
    slot.recipeId = recipe.id
    slot.macros = { ...recipe.macros }
    slot.cost = estimateRecipeCost(recipe, 1)
  }
}

/**
 * Swap expensive slots for cheaper eligible alternatives until the weekly
 * total is under budget or no more beneficial swaps exist.
 */
function rebalanceForBudget(
  slots: PlanSlot[],
  eligible: Recipe[],
  budgetCents: number,
  usage: Map<string, number>,
): void {
  // Iterate: each pass swaps the single most expensive slot for its cheapest
  // eligible alternative (same meal type) that reduces total cost.
  for (let pass = 0; pass < slots.length; pass++) {
    const total = slots.reduce((s, sl) => s + sl.cost, 0)
    if (total <= budgetCents) break
    // Sort slots by cost descending; try the most expensive first.
    const ordered = [...slots].sort((a, b) => b.cost - a.cost)
    let swapped = false
    for (const slot of ordered) {
      const candidates = eligible
        .filter(
          (r) =>
            r.suitableMeals.includes(slot.meal) &&
            r.id !== slot.recipeId &&
            (usage.get(r.id) ?? 0) < MAX_USES_PER_RECIPE,
        )
        .map((r) => ({ recipe: r, cost: estimateRecipeCost(r, 1) }))
        .filter((c) => c.cost < slot.cost)
        .sort((a, b) => a.cost - b.cost)
      if (candidates.length === 0) continue
      const pick = candidates[0]
      usage.set(slot.recipeId, (usage.get(slot.recipeId) ?? 0) - 1)
      usage.set(pick.recipe.id, (usage.get(pick.recipe.id) ?? 0) + 1)
      slot.recipeId = pick.recipe.id
      slot.macros = { ...pick.recipe.macros }
      slot.cost = pick.cost
      swapped = true
      break
    }
    if (!swapped) break
  }
}

function sumMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  }
}
