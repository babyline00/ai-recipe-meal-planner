import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deserializeProfile, profileUpdateInput } from '@/lib/serialize'
import type { UserProfile } from '@/lib/types'

/** GET /api/profiles/[id] — single profile. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const row = await db.userProfile.findUnique({ where: { id } })
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ profile: deserializeProfile(row) })
  } catch (e) {
    return NextResponse.json({ error: 'db_unavailable', message: (e as Error).message }, { status: 500 })
  }
}

/** PATCH /api/profiles/[id] — partial update. Body: Partial<UserProfile>. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let body: Partial<UserProfile> = {}
  try {
    body = (await req.json()) as Partial<UserProfile>
  } catch {
    // empty body
  }
  try {
    const data = profileUpdateInput(body)
    const row = await db.userProfile.update({ where: { id }, data })
    return NextResponse.json({ profile: deserializeProfile(row) })
  } catch (e) {
    return NextResponse.json({ error: 'db_unavailable', message: (e as Error).message }, { status: 500 })
  }
}
