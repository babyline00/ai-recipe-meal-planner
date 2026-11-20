import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deserializeProfile, deserializePlan } from '@/lib/serialize'
import { generateWeeklyPlan } from '@/lib/planner'
import { generateShoppingList } from '@/lib/shopping-list'
import { RECIPES } from '@/lib/recipe-data'
import { DEFAULT_PROFILE, type UserProfile } from '@/lib/types'

/**
 * POST /api/plans/generate — body: { profileId? }.
 * Runs the constraint-satisfaction planner against the profile, builds the
 * pantry-aware shopping list, and persists a WeeklyPlan row. If the database
 * isn't initialised (no `bun run db:push` yet), the plan is still computed and
 * returned in "demo" mode so the UI keeps working offline.
 */
export async function POST(req: Request) {
  let profileId: string | undefined
  try {
    const body = (await req.json()) as { profileId?: string }
    profileId = body.profileId
  } catch {
    // empty body — use default profile
  }

  let profile: UserProfile = DEFAULT_PROFILE
  try {
    if (profileId) {
      const row = await db.userProfile.findUnique({ where: { id: profileId } })
      if (row) profile = deserializeProfile(row)
    } else {
      const rows = await db.userProfile.findMany({ orderBy: { createdAt: 'desc' }, take: 1 })
      if (rows[0]) profile = deserializeProfile(rows[0])
    }
  } catch {
    // DB unavailable — fall through with DEFAULT_PROFILE
  }

  const plan = generateWeeklyPlan(profile, RECIPES)
  const shoppingList = generateShoppingList(plan.slots, profile.pantry)
  const weekStart = new Date()

  try {
    const row = await db.weeklyPlan.create({
      data: {
        profileId: profile.id,
        weekStart,
        slotsJson: JSON.stringify(plan.slots),
        shoppingListJson: JSON.stringify(shoppingList),
        totalMacrosJson: JSON.stringify(plan.totalMacros),
        totalCostCents: plan.totalCostCents,
      },
    })
    return NextResponse.json({ plan: deserializePlan(row) })
  } catch (e) {
    // Persist failed (DB not initialised) — return the computed plan in demo mode.
    return NextResponse.json({
      plan: {
        id: 'demo',
        profileId: profile.id,
        weekStart: weekStart.toISOString(),
        slots: plan.slots,
        shoppingList,
        totalMacros: plan.totalMacros,
        totalCostCents: plan.totalCostCents,
        createdAt: weekStart.toISOString(),
      },
      demo: true,
      overBudget: plan.overBudget,
      warning:
        'Plan computed in-memory but not persisted — run `bun run db:push` to enable saving.',
    })
  }
}
