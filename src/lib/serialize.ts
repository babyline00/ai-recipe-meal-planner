/**
 * Serialization helpers — convert between UserProfile / WeeklyPlan domain
 * objects and the JSON-stringified Prisma rows (the schema stores complex
 * fields as JSON strings because SQLite + Prisma can't store native arrays
 * or nested objects).
 */

import type {
  UserProfile,
  MacroTargets,
  Allergen,
  PantryItem,
  Cuisine,
  PlanSlot,
  ShoppingListItem,
  Macros,
} from './types'

export interface RawProfileRow {
  id: string
  name: string
  macroTargets: string
  allergies: string
  pantry: string
  weeklyBudgetCents: number
  excludedCuisines: string
  createdAt: Date
  updatedAt: Date
}

export function deserializeProfile(row: RawProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.name,
    macroTargets: safeParse(row.macroTargets, { calories: 2000, protein: 120, carbs: 220, fat: 65 }) as MacroTargets,
    allergies: safeParse(row.allergies, []) as Allergen[],
    pantry: safeParse(row.pantry, []) as PantryItem[],
    weeklyBudgetCents: row.weeklyBudgetCents,
    excludedCuisines: safeParse(row.excludedCuisines, []) as Cuisine[],
  }
}

export function profileCreateInput(p: Partial<UserProfile> & { id?: string }) {
  return {
    name: p.name ?? 'default',
    macroTargets: JSON.stringify(p.macroTargets ?? { calories: 2000, protein: 120, carbs: 220, fat: 65 }),
    allergies: JSON.stringify(p.allergies ?? []),
    pantry: JSON.stringify(p.pantry ?? []),
    weeklyBudgetCents: p.weeklyBudgetCents ?? 10000,
    excludedCuisines: JSON.stringify(p.excludedCuisines ?? []),
  }
}

export function profileUpdateInput(p: Partial<UserProfile>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (p.name !== undefined) out.name = p.name
  if (p.macroTargets !== undefined) out.macroTargets = JSON.stringify(p.macroTargets)
  if (p.allergies !== undefined) out.allergies = JSON.stringify(p.allergies)
  if (p.pantry !== undefined) out.pantry = JSON.stringify(p.pantry)
  if (p.weeklyBudgetCents !== undefined) out.weeklyBudgetCents = p.weeklyBudgetCents
  if (p.excludedCuisines !== undefined) out.excludedCuisines = JSON.stringify(p.excludedCuisines)
  return out
}

export interface RawPlanRow {
  id: string
  profileId: string
  weekStart: Date
  slotsJson: string
  shoppingListJson: string
  totalMacrosJson: string
  totalCostCents: number
  createdAt: Date
}

export interface HydratedPlan {
  id: string
  profileId: string
  weekStart: string
  slots: PlanSlot[]
  shoppingList: ShoppingListItem[]
  totalMacros: Macros
  totalCostCents: number
  createdAt: string
}

export function deserializePlan(row: RawPlanRow): HydratedPlan {
  return {
    id: row.id,
    profileId: row.profileId,
    weekStart: row.weekStart.toISOString(),
    slots: safeParse(row.slotsJson, []) as PlanSlot[],
    shoppingList: safeParse(row.shoppingListJson, []) as ShoppingListItem[],
    totalMacros: safeParse(row.totalMacrosJson, { calories: 0, protein: 0, carbs: 0, fat: 0 }) as Macros,
    totalCostCents: row.totalCostCents,
    createdAt: row.createdAt.toISOString(),
  }
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
