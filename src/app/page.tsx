'use client'

import * as React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { RECIPES, RECIPES_BY_ID } from '@/lib/recipe-data'
import { generateWeeklyPlan } from '@/lib/planner'
import { generateShoppingList, totalShoppingCostCents } from '@/lib/shopping-list'
import { filterByAllergy } from '@/lib/allergy-filter'
import { estimateRecipeCost } from '@/lib/cost-estimator'
import { computeDayMacros } from '@/lib/macro-targeter'
import {
  DEFAULT_PROFILE,
  ALL_ALLERGENS,
  ALL_CUISINES,
  MEAL_ORDER,
  CATEGORY_ORDER,
  type UserProfile,
  type Allergen,
  type Cuisine,
  type PlanSlot,
  type MealType,
  type ShoppingListItem,
  type Macros,
  type IngredientCategory,
  type Recipe,
  type WeeklyPlanResult,
} from '@/lib/types'
import {
  RefreshCw,
  Settings2,
  ShoppingBasket,
  CalendarDays,
  ChefHat,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MEAL_ICONS: Record<MealType, string> = { breakfast: 'B', lunch: 'L', dinner: 'D' }

function formatCents(c: number): string {
  return `$${(c / 100).toFixed(2)}`
}
function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}

export default function Page() {
  const { toast } = useToast()
  const [profile, setProfile] = React.useState<UserProfile>(DEFAULT_PROFILE)
  const [plan, setPlan] = React.useState<WeeklyPlanResult>(() =>
    generateWeeklyPlan(DEFAULT_PROFILE, RECIPES),
  )
  const [shoppingList, setShoppingList] = React.useState<ShoppingListItem[]>(() =>
    generateShoppingList(plan.slots, DEFAULT_PROFILE.pantry),
  )
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [swapSlot, setSwapSlot] = React.useState<number | null>(null)
  const [savedProfiles, setSavedProfiles] = React.useState<UserProfile[]>([])
  const [persistedPlanId, setPersistedPlanId] = React.useState<string | null>(null)

  // Load saved profiles (best-effort) for the picker.
  React.useEffect(() => {
    fetch('/api/profiles')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.profiles) && d.profiles.length > 0) setSavedProfiles(d.profiles)
      })
      .catch(() => {})
  }, [])

  function recompute(p: UserProfile) {
    const newPlan = generateWeeklyPlan(p, RECIPES)
    const list = generateShoppingList(newPlan.slots, p.pantry)
    setPlan(newPlan)
    setShoppingList(list)
  }

  function handleNewPlan() {
    recompute(profile)
    // Persist (best-effort).
    fetch('/api/plans/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: profile.id }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.plan?.id && d.plan.id !== 'demo') {
          setPersistedPlanId(d.plan.id)
          toast({ title: 'Plan saved', description: `Weekly plan persisted (id ${d.plan.id.slice(0, 6)}…).` })
        } else if (d.warning) {
          setPersistedPlanId(null)
          toast({ title: 'Plan computed (demo mode)', description: 'Run bun run db:push to persist plans.' })
        }
      })
      .catch(() => {
        setPersistedPlanId(null)
      })
  }

  function handleSaveProfile(updated: UserProfile) {
    setProfile(updated)
    recompute(updated)
    setEditorOpen(false)
    fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) toast({ title: 'Profile saved', description: `Profile "${d.profile.name}" persisted.` })
        else if (d.error) toast({ title: 'Profile applied (demo mode)', description: 'Run bun run db:push to persist.' })
      })
      .catch(() => {})
  }

  function handleSwap(slotIndex: number, newRecipeId: string) {
    const slots = plan.slots.map((s) => ({ ...s }))
    const slot = slots[slotIndex]
    const recipe = RECIPES_BY_ID[newRecipeId]
    if (!recipe) return
    slot.recipeId = recipe.id
    slot.macros = { ...recipe.macros }
    slot.cost = estimateRecipeCost(recipe, 1)
    const totalCostCents = slots.reduce((s, sl) => s + sl.cost, 0)
    // Recompute per-day average macros.
    const avgCal = slots.reduce((s, sl) => s + sl.macros.calories, 0) / 7
    const avgPro = slots.reduce((s, sl) => s + sl.macros.protein, 0) / 7
    const avgCar = slots.reduce((s, sl) => s + sl.macros.carbs, 0) / 7
    const avgFat = slots.reduce((s, sl) => s + sl.macros.fat, 0) / 7
    const newPlan: WeeklyPlanResult = {
      slots,
      totalMacros: { calories: avgCal, protein: avgPro, carbs: avgCar, fat: avgFat },
      totalCostCents,
      overBudget: totalCostCents > profile.weeklyBudgetCents,
    }
    setPlan(newPlan)
    setShoppingList(generateShoppingList(slots, profile.pantry))
    setSwapSlot(null)
    if (persistedPlanId) {
      fetch(`/api/plans/${persistedPlanId}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotIndex, newRecipeId }),
      }).catch(() => {})
    }
  }

  const eligibleSwapRecipes = React.useMemo<Recipe[]>(() => {
    if (swapSlot === null) return []
    const slot = plan.slots[swapSlot]
    if (!slot) return []
    return filterByAllergy(
      RECIPES.filter((r) => r.suitableMeals.includes(slot.meal) && r.id !== slot.recipeId),
      profile.allergies,
    ).filter((r) => !profile.excludedCuisines.includes(r.cuisine))
  }, [swapSlot, plan.slots, profile])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ChefHat className="size-6 text-primary" />
            <div>
              <h1 className="text-lg font-semibold leading-none">AI-Powered Recipe &amp; Meal Planner</h1>
              <p className="text-xs text-muted-foreground">Weekly plans that hit your macros, allergies &amp; budget — all under 30 min.</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Select
              value={profile.id}
              onValueChange={(id) => {
                const found = savedProfiles.find((p) => p.id === id)
                if (found) {
                  setProfile(found)
                  recompute(found)
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default profile</SelectItem>
                {savedProfiles.filter((p) => p.id !== 'default').map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
              <Settings2 className="size-4" /> Edit profile
            </Button>
            <Button size="sm" onClick={handleNewPlan}>
              <RefreshCw className="size-4" /> New plan
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Left: weekly plan */}
        <div className="lg:col-span-2 space-y-4">
          <WeekOverview plan={plan} profile={profile} />
          {plan.slots.map((_, day) => (
            <DayCard
              key={day}
              day={day}
              slots={plan.slots.filter((s) => s.day === day)}
              profile={profile}
              onSwap={(mealIdx) => setSwapSlot(day * 3 + mealIdx)}
            />
          ))}
        </div>

        {/* Right: shopping list */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <ShoppingListPanel items={shoppingList} budget={profile.weeklyBudgetCents} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-6">
        <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <CalendarDays className="size-3" />
          <span>{RECIPES.length} recipes · {plan.slots.length} weekly slots · 30-min cook cap</span>
          <Separator orientation="vertical" className="h-3" />
          <span>MVP: weekly plan, macros, allergies, budget, pantry-aware shopping list. Stretch: voice-guided cooking, family picky-eater mode.</span>
        </div>
      </footer>

      {/* Profile editor */}
      <ProfileEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={profile}
        onSave={handleSaveProfile}
      />

      {/* Swap dialog */}
      <Dialog open={swapSlot !== null} onOpenChange={(o) => !o && setSwapSlot(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Swap meal</DialogTitle>
            <DialogDescription>
              Pick a different recipe for this slot. Filtered by your allergies &amp; excluded cuisines.
            </DialogDescription>
          </DialogHeader>
          {swapSlot !== null && plan.slots[swapSlot] && (
            <div className="text-sm text-muted-foreground">
              Current: <span className="font-medium text-foreground">{RECIPES_BY_ID[plan.slots[swapSlot].recipeId]?.title}</span>{' '}
              ({plan.slots[swapSlot].meal})
            </div>
          )}
          <div className="grid gap-2 max-h-[50vh] overflow-y-auto pr-1">
            {eligibleSwapRecipes.length === 0 && (
              <div className="text-sm text-muted-foreground">No eligible alternatives for this slot.</div>
            )}
            {eligibleSwapRecipes.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSwap(swapSlot!, r.id)}
                className="text-left rounded-md border p-3 hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{r.title}</span>
                  <Badge variant="secondary">{r.cuisine}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {r.macros.calories} cal · {r.macros.protein}p · {r.macros.carbs}c · {r.macros.fat}f
                  {' · '}{r.cookTime} min · {formatCents(estimateRecipeCost(r, 1))}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ───────────────────────── Sub-components ───────────────────────── */

function WeekOverview({ plan, profile }: { plan: WeeklyPlanResult; profile: UserProfile }) {
  const t = profile.macroTargets
  const budgetPct = Math.min(100, Math.round((plan.totalCostCents / profile.weeklyBudgetCents) * 100))
  const over = plan.overBudget
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4" /> Week overview
        </CardTitle>
        <CardDescription>
          Avg per-day macros across the 7-day plan vs your daily targets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MacroStat label="Calories" value={plan.totalMacros.calories} target={t.calories} unit="kcal" />
          <MacroStat label="Protein" value={plan.totalMacros.protein} target={t.protein} unit="g" />
          <MacroStat label="Carbs" value={plan.totalMacros.carbs} target={t.carbs} unit="g" />
          <MacroStat label="Fat" value={plan.totalMacros.fat} target={t.fat} unit="g" />
        </div>
        <Separator />
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="flex items-center gap-2">
              <ShoppingBasket className="size-4" /> Weekly cost
            </span>
            <span className={over ? 'text-destructive font-medium' : 'font-medium'}>
              {formatCents(plan.totalCostCents)} / {formatCents(profile.weeklyBudgetCents)}
            </span>
          </div>
          <Progress value={budgetPct} className={over ? '[&_[data-slot=progress-indicator]]:bg-destructive' : ''} />
          <div className="text-xs mt-1 text-muted-foreground flex items-center gap-1">
            {over ? (
              <><AlertTriangle className="size-3 text-destructive" /> Over budget — try swapping expensive meals.</>
            ) : (
              <><CheckCircle2 className="size-3 text-emerald-600" /> Within budget.</>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MacroStat({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold leading-tight">{round1(value)}<span className="text-xs font-normal text-muted-foreground"> / {target}{unit}</span></div>
      <Progress value={pct} className="mt-2 h-1.5" />
    </div>
  )
}

function DayCard({
  day,
  slots,
  profile,
  onSwap,
}: {
  day: number
  slots: PlanSlot[]
  profile: UserProfile
  onSwap: (mealIdx: number) => void
}) {
  const dayMacros = computeDayMacros(slots)
  const dayCost = slots.reduce((s, sl) => s + sl.cost, 0)
  const t = profile.macroTargets
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>{DAYS[day]}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {round1(dayMacros.calories)} kcal · {round1(dayMacros.protein)}p · {round1(dayMacros.carbs)}c · {round1(dayMacros.fat)}f · {formatCents(dayCost)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {slots.map((slot, i) => (
            <MealCard key={slot.meal} slot={slot} onSwap={() => onSwap(i)} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function MealCard({ slot, onSwap }: { slot: PlanSlot; onSwap: () => void }) {
  const recipe = RECIPES_BY_ID[slot.recipeId]
  if (!recipe) return null
  return (
    <div className="rounded-lg border p-3 flex flex-col gap-2 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{slot.meal}</div>
          <div className="text-sm font-medium leading-snug">{recipe.title}</div>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">{recipe.cuisine}</Badge>
      </div>
      <div className="flex flex-wrap gap-1">
        {recipe.tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        {slot.macros.calories} cal · {slot.macros.protein}p · {slot.macros.carbs}c · {slot.macros.fat}f
      </div>
      <div className="text-xs text-muted-foreground">
        Cook {recipe.cookTime} min · {formatCents(slot.cost)}
      </div>
      <Button variant="ghost" size="sm" className="w-full mt-auto justify-start" onClick={onSwap}>
        <RefreshCw className="size-3" /> Swap
      </Button>
    </div>
  )
}

function ShoppingListPanel({ items, budget }: { items: ShoppingListItem[]; budget: number }) {
  const total = totalShoppingCostCents(items)
  const byCategory = React.useMemo(() => {
    const m = new Map<IngredientCategory, ShoppingListItem[]>()
    for (const it of items) {
      if (!m.has(it.category)) m.set(it.category, [])
      m.get(it.category)!.push(it)
    }
    return m
  }, [items])

  return (
    <Card className="h-[calc(100vh-7rem)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShoppingBasket className="size-4" /> Shopping list
        </CardTitle>
        <CardDescription>Pantry-aware — only what you still need to buy.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[calc(100vh-16rem)] pr-3">
          {items.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nothing to buy — your pantry covers everything!
            </div>
          )}
          {CATEGORY_ORDER.map((cat) => {
            const list = byCategory.get(cat)
            if (!list || list.length === 0) return null
            return (
              <div key={cat} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={
                    'inline-block size-2 rounded-full ' +
                    (cat === 'produce' ? 'bg-emerald-500' : cat === 'dairy' ? 'bg-amber-400' : cat === 'meat' ? 'bg-rose-500' : 'bg-sky-500')
                  } />
                  <span className="text-xs font-semibold uppercase tracking-wide">{cat}</span>
                </div>
                <div className="space-y-1">
                  {list.map((it) => (
                    <div key={it.ingredient} className="flex items-center justify-between text-sm py-1 border-b border-dashed last:border-0">
                      <div>
                        <span className="font-medium">{it.ingredient}</span>
                        <span className="text-muted-foreground ml-1 text-xs">
                          {it.buyQty} {it.unit}
                          {it.haveQty > 0 && <span className="text-muted-foreground/70"> (have {it.haveQty})</span>}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-xs">{formatCents(it.estimatedCostCents)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </ScrollArea>
        <Separator className="my-3" />
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Estimated total</span>
          <span className="font-semibold">{formatCents(total)} <span className="text-xs font-normal text-muted-foreground">/ {formatCents(budget)}</span></span>
        </div>
      </CardContent>
    </Card>
  )
}

function ProfileEditorDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: UserProfile
  onSave: (p: UserProfile) => void
}) {
  const [draft, setDraft] = React.useState<UserProfile>(initial)
  const [pantryText, setPantryText] = React.useState(
    initial.pantry.map((p) => `${p.name}, ${p.qty}, ${p.unit}`).join('\n'),
  )

  React.useEffect(() => {
    if (open) {
      setDraft(initial)
      setPantryText(initial.pantry.map((p) => `${p.name}, ${p.qty}, ${p.unit}`).join('\n'))
    }
  }, [open, initial])

  function toggleAllergen(a: Allergen, checked: boolean) {
    setDraft((d) => ({
      ...d,
      allergies: checked ? [...d.allergies, a] : d.allergies.filter((x) => x !== a),
    }))
  }
  function toggleCuisine(c: Cuisine, checked: boolean) {
    setDraft((d) => ({
      ...d,
      excludedCuisines: checked
        ? [...d.excludedCuisines, c]
        : d.excludedCuisines.filter((x) => x !== c),
    }))
  }

  function handleSave() {
    const pantry = pantryText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(',').map((s) => s.trim())
        return { name: parts[0] ?? '', qty: Number(parts[1] ?? 0) || 0, unit: parts[2] ?? 'piece' }
      })
      .filter((p) => p.name.length > 0)
    onSave({ ...draft, pantry })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Your macro targets, allergies, pantry, weekly budget, and excluded cuisines power the planner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Macros */}
          <div>
            <Label className="mb-2 block">Daily macro targets</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <Label className="text-xs">Calories</Label>
                <Input
                  type="number"
                  value={draft.macroTargets.calories}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, macroTargets: { ...d.macroTargets, calories: Number(e.target.value) || 0 } }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Protein (g)</Label>
                <Input
                  type="number"
                  value={draft.macroTargets.protein}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, macroTargets: { ...d.macroTargets, protein: Number(e.target.value) || 0 } }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Carbs (g)</Label>
                <Input
                  type="number"
                  value={draft.macroTargets.carbs}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, macroTargets: { ...d.macroTargets, carbs: Number(e.target.value) || 0 } }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Fat (g)</Label>
                <Input
                  type="number"
                  value={draft.macroTargets.fat}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, macroTargets: { ...d.macroTargets, fat: Number(e.target.value) || 0 } }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Budget */}
          <div>
            <Label className="mb-2 block">Weekly budget (USD)</Label>
            <Input
              type="number"
              value={draft.weeklyBudgetCents / 100}
              step={5}
              onChange={(e) =>
                setDraft((d) => ({ ...d, weeklyBudgetCents: Math.round((Number(e.target.value) || 0) * 100) }))
              }
            />
          </div>

          {/* Allergies */}
          <div>
            <Label className="mb-2 block">Allergies (avoid list)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALL_ALLERGENS.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm capitalize">
                  <Checkbox
                    checked={draft.allergies.includes(a)}
                    onCheckedChange={(c) => toggleAllergen(a, c === true)}
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>

          {/* Excluded cuisines */}
          <div>
            <Label className="mb-2 block">Excluded cuisines</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_CUISINES.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.excludedCuisines.includes(c)}
                    onCheckedChange={(ch) => toggleCuisine(c, ch === true)}
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>

          {/* Pantry */}
          <div>
            <Label className="mb-2 block">Pantry (one item per line: name, qty, unit)</Label>
            <Textarea
              rows={5}
              value={pantryText}
              onChange={(e) => setPantryText(e.target.value)}
              placeholder={'olive oil, 16, tbsp\nrice, 6, cup\nsalt, 8, tsp'}
            />
            <p className="text-xs text-muted-foreground mt-1">
              The shopping list subtracts these from what each recipe needs.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save &amp; replan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
