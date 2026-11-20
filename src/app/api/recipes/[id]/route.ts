import { NextResponse } from 'next/server'
import { RECIPES_BY_ID } from '@/lib/recipe-data'

/** GET /api/recipes/[id] — single recipe (no DB). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const recipe = RECIPES_BY_ID[id]
  if (!recipe) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ recipe })
}
