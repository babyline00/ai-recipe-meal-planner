import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deserializePlan } from '@/lib/serialize'

/** GET /api/plans — list the 50 most recent plans. */
export async function GET() {
  try {
    const rows = await db.weeklyPlan.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
    return NextResponse.json({ plans: rows.map(deserializePlan) })
  } catch (e) {
    return NextResponse.json({
      plans: [],
      error: 'db_unavailable',
      message: 'Run `bun run db:push` to initialise the SQLite database.',
    })
  }
}
