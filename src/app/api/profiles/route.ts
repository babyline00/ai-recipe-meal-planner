import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deserializeProfile, profileCreateInput } from '@/lib/serialize'
import type { UserProfile } from '@/lib/types'

/** GET /api/profiles — list all profiles (newest first). */
export async function GET() {
  try {
    const rows = await db.userProfile.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json({ profiles: rows.map(deserializeProfile) })
  } catch (e) {
    return NextResponse.json({
      profiles: [],
      error: 'db_unavailable',
      message: 'Run `bun run db:push` to initialise the SQLite database.',
    })
  }
}

/** POST /api/profiles — create or upsert a profile. Body: Partial<UserProfile> & { id? }. */
export async function POST(req: Request) {
  let body: Partial<UserProfile> & { id?: string } = {}
  try {
    body = (await req.json()) as Partial<UserProfile> & { id?: string }
  } catch {
    // empty body — create a default
  }
  const data = profileCreateInput(body)
  try {
    if (body.id) {
      const row = await db.userProfile.upsert({
        where: { id: body.id },
        create: { id: body.id, ...data },
        update: data,
      })
      return NextResponse.json({ profile: deserializeProfile(row) })
    }
    const row = await db.userProfile.create({ data })
    return NextResponse.json({ profile: deserializeProfile(row) })
  } catch (e) {
    return NextResponse.json(
      { error: 'db_unavailable', message: (e as Error).message },
      { status: 500 },
    )
  }
}
