/**
 * Shared domain types for the AI-Powered Recipe & Meal Planner.
 *
 * These types are consumed by the pure planning functions
 * (allergy-filter, cuisine-filter, cook-time-filter, macro-targeter,
 * cost-estimator, planner, shopping-list) and by the API route handlers.
 * They are intentionally framework-agnostic so the planner can be unit-tested
 * with `bun test` without booting Next.js or Prisma.
 */

/** The eight FDA-recognised major allergens (we use 7 here — sesame omitted). */
export type Allergen = 'milk' | 'eggs' | 'nuts' | 'soy' | 'wheat' | 'fish' | 'shellfish'

export const ALL_ALLERGENS: Allergen[] = [
  'milk', 'eggs', 'nuts', 'soy', 'wheat', 'fish', 'shellfish',
]

/** Dietary tags used for filtering and surfacing options. */
export type Tag =
  | 'vegetarian'
  | 'vegan'
  | 'gluten-free'
  | 'dairy-free'
  | 'keto'
  | 'whole30'

export const ALL_TAGS: Tag[] = [
  'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'whole30',
]

/** Cuisines represented in the hardcoded recipe dataset. */
export type Cuisine =
  | 'American'
  | 'Italian'
  | 'Mexican'
  | 'Asian'
  | 'Japanese'
  | 'Indian'
  | 'Mediterranean'
  | 'Middle Eastern'
  | 'French'

export const ALL_CUISINES: Cuisine[] = [
  'American', 'Italian', 'Mexican', 'Asian', 'Japanese',
  'Indian', 'Mediterranean', 'Middle Eastern', 'French',
]

/** Three meal slots per day. */
export type MealType = 'breakfast' | 'lunch' | 'dinner'

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner']

/** Supermarket aisle grouping for the shopping list. */
export type IngredientCategory = 'produce' | 'dairy' | 'meat' | 'pantry'

export const CATEGORY_ORDER: IngredientCategory[] = ['produce', 'dairy', 'meat', 'pantry']

/** A single ingredient in a recipe, priced per `unit`. */
export interface Ingredient {
  name: string
  /** Quantity in `unit`. Scaled by scaledServings when building the shopping list. */
  qty: number
  /** Free-form unit: 'cup', 'tbsp', 'tsp', 'oz', 'lb', 'piece', 'clove', 'can', 'slice', ... */
  unit: string
  /** Cost in cents per 1 `unit` of this ingredient. */
  unitCostCents: number
  category: IngredientCategory
}

/** Per-serving macros (grams for protein/carbs/fat, kcal for calories). */
export interface Macros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

/** A hardcoded recipe in the dataset. cookTime is guaranteed <= 30. */
export interface Recipe {
  id: string
  title: string
  cuisine: Cuisine
  ingredients: Ingredient[]
  instructions: string[]
  prepTime: number
  /** MUST be <= 30 for every recipe (enforced by recipe-data.test.ts). */
  cookTime: number
  servings: number
  /** Per-serving macros. */
  macros: Macros
  tags: Tag[]
  allergens: Allergen[]
  /** Which meal slots this recipe is suitable for. */
  suitableMeals: MealType[]
}

/** Daily macro targets for a user. */
export interface MacroTargets {
  calories: number
  protein: number
  carbs: number
  fat: number
}

/** An item the user already owns. Matched by normalised name against recipe ingredients. */
export interface PantryItem {
  name: string
  qty: number
  unit: string
}

/** A user profile — the planner's input. */
export interface UserProfile {
  id: string
  name: string
  macroTargets: MacroTargets
  allergies: Allergen[]
  pantry: PantryItem[]
  /** Weekly food budget in cents. */
  weeklyBudgetCents: number
  excludedCuisines: Cuisine[]
}

/** One slot in the weekly plan (7 days x 3 meals = 21 slots). */
export interface PlanSlot {
  /** 0 = Monday ... 6 = Sunday. */
  day: number
  meal: MealType
  recipeId: string
  /** Number of servings to cook for this slot (1 by default). */
  scaledServings: number
  /** Total macros for this slot = recipe.macros * scaledServings. */
  macros: Macros
  /** Total cost in cents for this slot = estimateRecipeCost(recipe, scaledServings). */
  cost: number
}

/** The full weekly plan result returned by generateWeeklyPlan. */
export interface WeeklyPlanResult {
  slots: PlanSlot[]
  /** Per-day average macros across the 7 days. */
  totalMacros: Macros
  /** Total weekly cost in cents. */
  totalCostCents: number
  /** True when the planner could not get totalCostCents under the budget. */
  overBudget: boolean
}

/** A single line on the pantry-aware shopping list. */
export interface ShoppingListItem {
  ingredient: string
  neededQty: number
  haveQty: number
  buyQty: number
  unit: string
  unitCostCents: number
  estimatedCostCents: number
  category: IngredientCategory
}

/** Default profile used when none is persisted (keeps the UI demoable offline). */
export const DEFAULT_PROFILE: UserProfile = {
  id: 'default',
  name: 'default',
  macroTargets: { calories: 2000, protein: 120, carbs: 220, fat: 65 },
  allergies: ['milk'],
  pantry: [
    { name: 'salt', qty: 8, unit: 'tsp' },
    { name: 'black pepper', qty: 4, unit: 'tsp' },
    { name: 'olive oil', qty: 16, unit: 'tbsp' },
    { name: 'garlic', qty: 12, unit: 'clove' },
    { name: 'onion', qty: 4, unit: 'piece' },
    { name: 'rice', qty: 6, unit: 'cup' },
  ],
  weeklyBudgetCents: 20000,
  excludedCuisines: [],
}
