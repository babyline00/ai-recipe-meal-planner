import { NextResponse } from 'next/server'
import { RECIPES } from '@/lib/recipe-data'
import { filterByCookTime } from '@/lib/cook-time-filter'

/**
 * GET /api/recipes — list recipes, with optional filters:
 *   ?cuisine=Italian      keep only this cuisine
 *   ?tag=vegetarian       keep only recipes with this tag
 *   ?allergen=milk,eggs   exclude recipes containing ANY of these allergens
 *   ?maxCookTime=20       keep only recipes with cookTime <= 20
 * Multiple filters compose (AND). No DB dependency — reads from recipe-data.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const cuisine = url.searchParams.get('cuisine')
  const tag = url.searchParams.get('tag')
  const allergen = url.searchParams.get('allergen')
  const maxCookTime = url.searchParams.get('maxCookTime')

  let out = RECIPES.slice()
  if (cuisine) {
    out = out.filter((r) => r.cuisine === cuisine)
  }
  if (tag) {
    out = out.filter((r) => (r.tags as string[]).includes(tag))
  }
  if (allergen) {
    const list = allergen
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const set = new Set(list)
    out = out.filter((r) => !r.allergens.some((a) => set.has(a)))
  }
  if (maxCookTime) {
    const max = parseInt(maxCookTime, 10)
    if (!Number.isNaN(max)) out = filterByCookTime(out, max)
  }

  return NextResponse.json({ recipes: out, count: out.length })
}
