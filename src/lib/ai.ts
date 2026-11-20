/**
 * Pluggable swap-suggestion provider.
 *
 * The heuristic planner (planner.ts) handles the common cases deterministically.
 * When the planner can't satisfy a constraint (e.g. a budget so tight that no
 * combination of eligible recipes fits), the `/api/plans/[id]/swap` endpoint can
 * ask a ChatProvider for an alternative recipe suggestion in natural language.
 *
 * The interface is deliberately minimal and SDK-agnostic: `ZaiProvider`
 * implements it using the `z-ai-web-dev-sdk` (dynamic import so a missing
 * config in unit-test envs doesn't crash the module), and `MockProvider`
 * returns a deterministic echo so the UI stays demoable offline and the
 * `ai.test.ts` suite stays hermetic.
 *
 * This mirrors the ChatProvider pattern from the parent project's `ai.ts`
 * (Personal Knowledge Copilot) — same shape, different domain.
 */

import type { Recipe, UserProfile } from './types'

export interface SwapSuggestion {
  /** Recipe id of the suggested alternative, when determinable. */
  recipeId?: string
  /** Human-readable rationale / swap instruction. */
  message: string
}

export interface ChatProvider {
  /**
   * Suggest an alternative recipe for `current` that respects `constraints`.
   * `candidates` is the eligible pool (already filtered for allergies /
   * cuisine / cook-time) so the provider only needs to pick one.
   */
  suggestSwap(args: {
    current: Recipe
    candidates: Recipe[]
    constraints: string
    profile: UserProfile
  }): Promise<SwapSuggestion>
}

let cachedProvider: ChatProvider | null = null

class MockProvider implements ChatProvider {
  /**
   * Deterministic: pick the first candidate whose title differs from
   * `current.title`, preferring the cheapest one. Falls back to the first
   * candidate. The message always references the current recipe title so the
   * `ai.test.ts` "deterministic" assertion holds.
   */
  async suggestSwap(args: {
    current: Recipe
    candidates: Recipe[]
    constraints: string
    profile: UserProfile
  }): Promise<SwapSuggestion> {
    const { current, candidates, constraints } = args
    if (candidates.length === 0) {
      return {
        message: `No eligible swap for "${current.title}" under constraints: ${constraints}.`,
      }
    }
    const pool = candidates.filter((r) => r.id !== current.id)
    const sorted = [...pool].sort((a, b) => totalCents(a) - totalCents(b))
    const pick = sorted[0] ?? candidates[0]
    return {
      recipeId: pick.id,
      message:
        `[mock] Swap "${current.title}" for "${pick.title}" ` +
        `(${pick.cuisine}, ${totalCents(pick)}c/serving) — ` +
        `respects: ${constraints}.`,
    }
  }
}

function totalCents(r: Recipe): number {
  return r.ingredients.reduce((s, i) => s + i.qty * i.unitCostCents, 0)
}

class ZaiProvider implements ChatProvider {
  async suggestSwap(args: {
    current: Recipe
    candidates: Recipe[]
    constraints: string
    profile: UserProfile
  }): Promise<SwapSuggestion> {
    const { current, candidates, constraints, profile } = args
    if (candidates.length === 0) {
      return { message: `No eligible swap for "${current.title}".` }
    }
    const candidateLines = candidates
      .slice(0, 15)
      .map((r) => `- ${r.id}: ${r.title} (${r.cuisine}, ${r.macros.calories}cal, ${totalCents(r)}c)`)
      .join('\n')
    const systemPrompt = [
      'You are a meal-planning assistant. Pick ONE recipe from the candidate list',
      'to replace the current meal, respecting the user constraints. Reply with a',
      'single line: `recipeId | short reason`.',
    ].join(' ')
    const userPrompt = [
      `Current meal: ${current.id} — ${current.title} (${current.cuisine}).`,
      `Constraints: ${constraints}.`,
      `Profile: budget $${(profile.weeklyBudgetCents / 100).toFixed(2)}/wk, ` +
        `allergies [${profile.allergies.join(', ')}].`,
      'Candidates:',
      candidateLines,
    ].join('\n')

    let text = ''
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()
      const completion: any = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        thinking: { type: 'disabled' },
      })
      if (typeof completion === 'string') {
        text = completion
      } else if (completion?.body) {
        const raw = await streamToText(completion.body)
        text = raw
      } else {
        text = completion?.choices?.[0]?.message?.content ?? ''
      }
    } catch (e) {
      console.warn('[swap] ZaiProvider failed, falling back to Mock:', (e as Error).message)
      return new MockProvider().suggestSwap(args)
    }

    const m = text.match(/([A-Za-z0-9_-]+)\s*\|\s*(.+)/s)
    if (m) {
      const recipeId = m[1].trim()
      if (candidates.some((r) => r.id === recipeId)) {
        return { recipeId, message: m[2].trim() }
      }
    }
    // Couldn't parse — fall back to cheapest candidate so the UX still works.
    return new MockProvider().suggestSwap(args)
  }
}

async function streamToText(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let out = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value, { stream: true })
  }
  // The non-streaming create() with stream:false may return SSE-flavoured JSON.
  try {
    const parsed = JSON.parse(out)
    return parsed?.choices?.[0]?.message?.content ?? out
  } catch {
    return out
  }
}

export function getSwapProvider(): ChatProvider {
  if (cachedProvider) return cachedProvider
  if (process.env.PKC_DISABLE_LLM === '1' || process.env.ARP_DISABLE_LLM === '1') {
    cachedProvider = new MockProvider()
    return cachedProvider
  }
  cachedProvider = new ZaiProvider()
  return cachedProvider
}

/** Test-only. */
export function __setSwapProviderForTest(p: ChatProvider | null) {
  cachedProvider = p
}

export { MockProvider, ZaiProvider }
