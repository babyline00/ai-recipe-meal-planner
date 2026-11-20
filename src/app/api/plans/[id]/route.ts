import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deserializePlan } from '@/lib/serialize'

/** GET /api/plans/[id] — single plan with all 21 slots + shopping list. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const row = await db.weeklyPlan.findUnique({ where: { id } })
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ plan: deserializePlan(row) })
  } catch (e) {
    return NextResponse.json({ error: 'db_unavailable', message: (e as Error).message }, { status: 500 })
  }
}
