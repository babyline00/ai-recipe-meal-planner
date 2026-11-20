import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { RECIPES } from '@/lib/recipe-data'

/** GET /api/stats — { profiles, plans, recipes }. DB counts degrade to 0 if unavailable. */
export async function GET() {
  let profiles = 0
  let plans = 0
  try {
    profiles = await db.userProfile.count()
    plans = await db.weeklyPlan.count()
  } catch {
    // DB not initialised — report 0 for the persisted counts
  }
  return NextResponse.json({ profiles, plans, recipes: RECIPES.length })
}
