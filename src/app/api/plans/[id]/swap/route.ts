import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deserializePlan, deserializeProfile } from '@/lib/serialize'
import { RECIPES, RECIPES_BY_ID } from '@/lib/recipe-data'
import { estimateRecipeCost } from '@/lib/cost-estimator'
import { generateShoppingList } from '@/lib/shopping-list'
import { computeAverageDayMacros } from '@/lib/macro-targeter'
import { getSwapProvider } from '@/lib/ai'
import { DEFAULT_PROFILE, type PlanSlot, type UserProfile } from '@/lib/types'

/**
 * POST /api/plans/[id]/swap — body: { slotIndex, newRecipeId? }.
 * Swaps the meal at `slotIndex` for `newRecipeId` (or, if omitted, asks the
 * swap provider for a suggestion), then recomputes the plan's macros, cost,
 * and shopping list, and persists the updated plan.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let body: { slotIndex?: number; newRecipeId?: string } = {}
  try {
    body = (await req.json()) as { slotIndex?: number; newRecipeId?: string }
  } catch {
    // empty body
  }

  let row
  try {
    row = await db.weeklyPlan.findUnique({ where: { id } })
  } catch (e) {
    return NextResponse.json({ error: 'db_unavailable', message: (e as Error).message }, { status: 500 })
  }
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const slots = JSON.parse(row.slotsJson) as PlanSlot[]
  const slotIndex = body.slotIndex ?? -1
  if (slotIndex < 0 || slotIndex >= slots.length) {
    return NextResponse.json({ error: 'invalid_slot_index' }, { status: 400 })
  }

  const slot = slots[slotIndex]

  // Load profile for pantry (shopping list recompute) + swap constraints.
  let profile: UserProfile = DEFAULT_PROFILE
  try {
    const prow = await db.userProfile.findUnique({ where: { id: row.profileId } })
    if (prow) profile = deserializeProfile(prow)
  } catch {
    // keep default
  }

  let chosenId = body.newRecipeId
  if (!chosenId) {
    const current = RECIPES_BY_ID[slot.recipeId]
    const candidates = RECIPES.filter(
      (r) => r.suitableMeals.includes(slot.meal) && r.id !== slot.recipeId,
    )
    const suggestion = await getSwapProvider().suggestSwap({
      current,
      candidates,
      constraints: `meal slot=${slot.meal}, cookTime<=30, allergies=[${profile.allergies.join(',')}]`,
      profile,
    })
    chosenId = suggestion.recipeId
  }
  if (!chosenId || !RECIPES_BY_ID[chosenId]) {
    return NextResponse.json({ error: 'no_valid_recipe' }, { status: 400 })
  }

  const recipe = RECIPES_BY_ID[chosenId]
  slot.recipeId = recipe.id
  slot.macros = { ...recipe.macros }
  slot.cost = estimateRecipeCost(recipe, 1)

  const totalMacros = computeAverageDayMacros(slots)
  const totalCostCents = slots.reduce((s, sl) => s + sl.cost, 0)
  const shoppingList = generateShoppingList(slots, profile.pantry)

  try {
    const updated = await db.weeklyPlan.update({
      where: { id },
      data: {
        slotsJson: JSON.stringify(slots),
        shoppingListJson: JSON.stringify(shoppingList),
        totalMacrosJson: JSON.stringify(totalMacros),
        totalCostCents: totalCostCents,
      },
    })
    return NextResponse.json({ plan: deserializePlan(updated) })
  } catch (e) {
    return NextResponse.json({
      plan: {
        id: row.id,
        profileId: row.profileId,
        weekStart: row.weekStart.toISOString(),
        slots,
        shoppingList,
        totalMacros,
        totalCostCents,
        createdAt: row.createdAt.toISOString(),
      },
      demo: true,
      warning: 'Swap applied in-memory; not persisted (database not initialised).',
    })
  }
}
