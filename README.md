# AI-Powered Recipe & Meal Planner

A weekly meal planner that respects your **macros**, **allergies**, **pantry**, and **budget** — and generates a **pantry-aware shopping list**. Every meal cooks in **under 30 minutes**.

> **Differs from Project #62 ("AI Recipe Finder — what can I make right now from my fridge").** This project is the *planning* problem: *plan a whole week of meals that hits your macro targets, avoids your allergens, stays under your weekly $ budget, and uses what's already in your pantry.* #62 is the *matching* problem: *given what's in my fridge now, what single recipe can I make?*

---

## Overview

- **Constraint-satisfaction planner** — pure-function `generateWeeklyPlan(profile, recipes)` returns a 7-day × 3-meal plan (21 slots) that respects allergies, excluded cuisines, the 30-min cook-time cap, a "no recipe used more than 3× per week" variety rule, the daily macro targets, and the weekly budget.
- **Pantry-aware shopping list** — `generateShoppingList(plan, pantry)` aggregates every ingredient across the week, subtracts what you already own, and tells you exactly what (and how much) to buy.
- **Swap any meal** — every slot has a Swap button; the API recomputes macros, cost, and the shopping list.
- **Optional LLM swap suggestions** — when the heuristic planner can't satisfy a constraint set, the `/api/plans/[id]/swap` endpoint can ask a pluggable `ChatProvider` (ZAI SDK or a deterministic `MockProvider`) for a natural-language alternative.

## MVP scope

- 45-recipe hardcoded dataset (`src/lib/recipe-data.ts`) with per-ingredient quantities + costs, per-serving macros, dietary tags, and allergen lists.
- User profile: macro targets (cal/protein/carbs/fat per day), allergies, pantry, weekly $ budget, excluded cuisines.
- Constraint-satisfaction weekly planner with macro + cost rebalance passes.
- Pantry-aware shopping list grouped by category (produce, dairy, meat, pantry).
- 30-min cook-time hard cap baked into the dataset.
- 2-column UI: weekly plan grid (left) + shopping list (right).
- Profile editor dialog (macros, allergies, pantry, budget, excluded cuisines).
- Recipe browse + filter API.
- 67 unit tests (`bun test`).

## Stretch (documented, not implemented)

- **Voice-guided cooking mode** — step-by-step instructions with a "Next step" button. The recipe view already shows instructions; TTS (e.g. `z-ai-web-dev-sdk` text-to-speech) would read each step aloud and advance on a voice command. The `ai.ts` `ChatProvider` pattern is ready to host a `TTSProvider`.
- **Family plan with picky eaters** — extend the profile with per-member veto lists and a "satisfies all members" filter; the planner would treat each veto as another avoid-list and score meals by family-wide acceptability.
- **Grocery delivery integration** — POST the shopping list to an Instacart/Kroger-style basket API.
- **Real Spoonacular API** — swap the hardcoded dataset for Spoonacular's recipe search (with a cost + macro normalizer).
- **ML-based meal planning** — replace the greedy + rebalance heuristic with a learned model that predicts meal assignments from constraint sets.

## Features

- Weekly 7×3 meal grid with per-day macro totals and a weekly cost-vs-budget bar.
- One-click **New plan** — re-runs the planner against the current profile.
- One-click **Swap** on any slot — pick from allergy-safe alternatives.
- **Shopping list** grouped by supermarket aisle, showing buy quantity (after pantry subtraction) and per-item cost.
- Profile persistence via Prisma + SQLite (degrades to an in-memory demo when the DB isn't initialised).
- Pluggable LLM swap provider with a deterministic offline mock.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Database | Prisma 6 + SQLite |
| LLM (optional) | `z-ai-web-dev-sdk` |
| Tests | `bun test` (Bun's built-in test runner) |
| Lint | `eslint-config-next` |

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Browser (page.tsx, 'use client')              │
│  ┌─────────────────────────┐    ┌──────────────────────────────────┐ │
│  │ Weekly plan grid (7×3)  │    │ Shopping list (pantry-aware)      │ │
│  │ + week overview + swap   │    │ grouped by category               │ │
│  └─────────────┬───────────┘    └───────────────┬──────────────────┘ │
│                │  pure functions (client-side, instant)               │
│                v                  v                                    │
│  generateWeeklyPlan()      generateShoppingList()                      │
│  (planner.ts)              (shopping-list.ts)                           │
└────────────────┬─────────────────────────────────────────────────────┘
                 │ fetch (best-effort persistence)
                 v
┌──────────────────────────────────────────────────────────────────────┐
│                    Next.js Route Handlers (/api)                       │
│  profiles  plans/generate  plans/[id]/swap  recipes  stats             │
└────────────────┬─────────────────────────────────────────────────────┘
                 │ Prisma
                 v
┌──────────────────────────────────────────────────────────────────────┐
│  SQLite (UserProfile, WeeklyPlan)  ◄── JSON-stringified complex fields │
└──────────────────────────────────────────────────────────────────────┘

Pure planning core (no I/O, fully unit-tested):
  allergy-filter  cuisine-filter  cook-time-filter  macro-targeter
  cost-estimator  planner  shopping-list  ai (swap provider)
```

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Initialise the SQLite database
bun run db:push      # inlines DATABASE_URL="$(pwd)/db/custom.db"

# 3. Run the dev server
bun run dev          # http://localhost:3000

# 4. Run the tests
bun test
```

> The app runs in **demo mode** even before `db:push`: the page computes plans
> client-side with the pure functions and the API returns computed plans with
> a `warning` instead of persisting. Run `db:push` to enable profile + plan
> persistence.

## Tests

`bun test` runs **67 tests** across 9 files covering every pure function:

| File | Covers |
|---|---|
| `recipe-data.test.ts` | Dataset integrity (ids unique, cookTime ≤ 30, every field present) |
| `allergy-filter.test.ts` | `filterByAllergy` — strict avoid-list, union, no-mutation |
| `cuisine-filter.test.ts` | `filterByCuisine` — exclusions, union |
| `cook-time-filter.test.ts` | `filterByCookTime` — ≤30, ≤15, ≤0 |
| `macro-targeter.test.ts` | `computeDayMacros`, `sumMacros`, `scaleMacros`, `macroDistance`, `isOffTarget` |
| `planner.test.ts` | `generateWeeklyPlan` — 21 slots, variety ≤3, allergens, cook-time, budget, meal-fit |
| `shopping-list.test.ts` | `generateShoppingList` — full/partial/empty pantry, cost = buyQty × unitCost, aggregation, case-insensitive matching |
| `cost-estimator.test.ts` | `estimateRecipeCost` — linear in servings |
| `ai.test.ts` | `MockProvider` — deterministic swap suggestions, cheapest-candidate pick, provider injection |

## Environment variables

See [`.env.example`](.env.example).

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes (for persistence) | Absolute path to the SQLite file. The npm `db:*` scripts inline this as `$(pwd)/db/custom.db`. |
| `ARP_DISABLE_LLM` | no | Set to `1` to force the deterministic `MockProvider` for swap suggestions (no network). |
| `ZAI_API_KEY` / `ZAI_API_SECRET` | no | Credentials for the `z-ai-web-dev-sdk` real LLM swap provider. |

## Project structure

```
78-ai-recipe-meal-planner/
├── prisma/schema.prisma          # UserProfile, WeeklyPlan (JSON-stringified fields)
├── src/
│   ├── app/
│   │   ├── layout.tsx             # root layout + Toaster
│   │   ├── page.tsx               # 2-col UI: weekly grid + shopping list (client)
│   │   ├── globals.css
│   │   └── api/
│   │       ├── profiles/          # POST/GET list, GET/PATCH [id]
│   │       ├── plans/             # GET list, POST generate, GET [id], POST [id]/swap
│   │       ├── recipes/           # GET list (filters), GET [id]
│   │       └── stats/            # GET { profiles, plans, recipes }
│   ├── components/ui/             # shadcn/ui (copied subset)
│   ├── hooks/use-toast.ts
│   └── lib/
│       ├── types.ts               # domain types + DEFAULT_PROFILE
│       ├── recipe-data.ts         # 45 recipes
│       ├── allergy-filter.ts      # pure
│       ├── cuisine-filter.ts      # pure
│       ├── cook-time-filter.ts    # pure
│       ├── macro-targeter.ts      # pure
│       ├── cost-estimator.ts      # pure
│       ├── planner.ts             # generateWeeklyPlan — constraint-satisfaction
│       ├── shopping-list.ts       # generateShoppingList — pantry-aware
│       ├── ai.ts                   # ChatProvider (Zai + Mock) for swap suggestions
│       ├── serialize.ts           # DB row ⇄ domain object
│       ├── db.ts                  # Prisma client
│       └── __tests__/             # 9 test files
├── package.json
└── README.md
```

## Case study

### Constraint-satisfaction planning

The planner is a **deterministic, layered greedy** algorithm — no randomness, no
backtracking, fully reproducible (important for tests). It runs in five phases:

1. **Hard-filter** — remove recipes that contain any user allergen, that match
   an excluded cuisine, or whose `cookTime > 30`. (If this leaves nothing, relax
   to the cook-time filter only, so the plan is always fillable.)
2. **Greedy fill** — for each of the 21 slots in day-then-meal order, compute the
   per-meal macro target as `remaining daily target ÷ remaining meals`, then
   pick the eligible recipe whose macros minimise the *normalised* Euclidean
   distance to that target, with a tiny usage penalty to nudge variety on ties.
   A recipe already used ≥3× this week is excluded from candidates (relaxed
   only when no fresh candidate exists, to guarantee 21 slots).
3. **Macro rebalance pass** — for each day whose totals are >10% off any target,
   swap the single worst-contributing slot for the candidate that most reduces
   the day's distance to target (still respecting the variety cap).
4. **Cost rebalance pass** — if the weekly total exceeds the budget, repeatedly
   swap the most expensive slot for its cheapest eligible same-meal alternative
   until under budget or no more beneficial swaps exist.
5. **Summarise** — return the 21 slots, the per-day average macros, the total
   cost, and an `overBudget` flag.

The normalised distance `macroDistance(a, b)` divides each macro's absolute
delta by the target so that 100 kcal off on a 2000 kcal target is comparable to
5 g off on a 100 g protein target — otherwise calories (large numbers) would
dominate the fit and the planner would ignore protein/carbs/fat.

### Pantry-aware shopping list

`generateShoppingList` walks every slot's recipe, scales each ingredient by
`scaledServings ÷ recipe.servings`, aggregates by *normalised* ingredient name
(lowercased, whitespace-collapsed — so `Greek Yogurt` and `greek yogurt` merge),
then subtracts the pantry quantity. The result is the **buy quantity** and
`estimatedCostCents = buyQty × unitCostCents` per ingredient, sorted by
supermarket aisle (produce → dairy → meat → pantry).

This is what turns "here are 21 recipes" into "here is your shopping list" —
the single feature that makes the app usable instead of a recipe catalog.

### What I'd do differently

- **Real ML meal planning.** The greedy + rebalance heuristic is fast and
  deterministic but myopic: it can't reason about the *combination* of meals
  across the week the way a constraint solver (OR-Tools CP-SAT) or a learned
  sequence model could. I'd model the problem as a CP-SAT instance (21 slot
  vars, allergen/cuisine/cook-time constraints, macro-balance objective,
  budget constraint, variety constraint) and let the solver find the optimal
  week.
- **Real voice TTS for cooking mode.** The recipe view shows steps; I'd add
  `z-ai-web-dev-sdk` text-to-speech to read each step and a wake-word / tap to
  advance, so cooks don't touch a screen with messy hands.
- **Real grocery delivery.** POST the shopping list to an Instacart/Kroger
  basket API so "plan" → "order" is one click.
- **Real Spoonacular.** The 45-recipe dataset is enough to demonstrate the
  planner but not enough for real life. A Spoonacular adapter with a cost +
  macro normalizer would unlock thousands of recipes.
- **Scaled servings.** The MVP sets `scaledServings = 1` for every slot; a
  smarter planner would scale servings per slot to actually hit the per-meal
  calorie target (and the shopping list + cost would scale linearly with it).

### Resume bullet

> Built a constraint-satisfaction weekly meal planner (Next.js 16, TypeScript,
> Prisma/SQLite) that generates a 7-day × 3-meal plan respecting per-day macro
> targets, allergies, a 30-min cook-time cap, a weekly $ budget, and a
> "no recipe used >3×/week" variety rule, with a pantry-aware shopping list;
> 67 unit tests covering the pure planning core (filter, target, plan, shop).

## License

MIT — see [LICENSE](LICENSE).

## Push

```bash
gh repo create ai-recipe-meal-planner --public --source=. --remote=origin --push
```
