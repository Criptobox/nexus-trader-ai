// ─────────────────────────────────────────────────────────────
// Router multi-modelo — enruta cada tarea al mejor modelo
// disponible con cadena de fallback. Soporta el SDK Z.ai de
// fábrica y proveedores OpenAI-compatibles configurables.
// ─────────────────────────────────────────────────────────────
import ZAI from 'z-ai-web-dev-sdk'
import type { LLMRequest, RouterProfile } from '@/lib/types'
import { db } from '@/lib/db'

const DEFAULT_PROFILES: RouterProfile[] = [
  {
    id: 'flash', label: 'Z Flash (rápido)', provider: 'zai', model: 'glm-4.5-flash',
    temperature: 0.4, useFor: ['chat'], enabled: true,
  },
  {
    id: 'balanced', label: 'Z Balanced (análisis)', provider: 'zai', model: 'glm-4.5',
    temperature: 0.3, useFor: ['analysis'], enabled: true,
  },
  {
    id: 'deep', label: 'Z Deep (síntesis)', provider: 'zai',
    temperature: 0.2, useFor: ['summary'], enabled: true, // usa modelo por defecto del SDK
  },
]

export async function getProfiles(): Promise<RouterProfile[]> {
  const row = await db.setting.findUnique({ where: { key: 'router_profiles' } })
  if (!row) return DEFAULT_PROFILES
  try {
    const parsed = JSON.parse(row.value) as RouterProfile[]
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PROFILES
  } catch {
    return DEFAULT_PROFILES
  }
}

export async function saveProfiles(profiles: RouterProfile[]): Promise<void> {
  await db.setting.upsert({
    where: { key: 'router_profiles' },
    create: { key: 'router_profiles', value: JSON.stringify(profiles) },
    update: { value: JSON.stringify(profiles) },
  })
}

export interface LLMResult {
  content: string
  profileId: string
  attempts: { profileId: string; ok: boolean; error?: string }[]
}

async function callZai(req: LLMRequest, profile: RouterProfile): Promise<string> {
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: req.messages as Parameters<typeof zai.chat.completions.create>[0]['messages'],
    temperature: req.temperature ?? profile.temperature ?? 0.4,
    ...(profile.model ? { model: profile.model } : {}),
    ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
  })
  return completion.choices[0]?.message?.content ?? ''
}

async function callOpenAICompatible(req: LLMRequest, profile: RouterProfile, apiKey: string, baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: profile.model ?? 'gpt-4o-mini',
      messages: req.messages,
      temperature: req.temperature ?? profile.temperature ?? 0.4,
      ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Provider HTTP ${res.status}`)
  const data = (await res.json()) as { choices: { message: { content: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

export async function routeLLM(req: LLMRequest): Promise<LLMResult> {
  const profiles = await getProfiles()
  const candidates = profiles.filter(
    (p) => p.enabled && (!req.json || p.provider === 'zai') && (p.useFor.includes(req.task) || candidatesEmpty(profiles, req.task)),
  )
  const ordered = candidates.length ? candidates : profiles.filter((p) => p.enabled)
  const attempts: LLMResult['attempts'] = []

  for (const profile of ordered) {
    try {
      let content: string
      if (profile.provider === 'zai') {
        content = await callZai(req, profile)
      } else {
        // proveedor OpenAI-compatible: clave leída del vault por el llamante
        const baseUrl = process.env.NEXUS_OPENAI_BASE_URL || 'https://api.openai.com/v1'
        const apiKey = process.env.NEXUS_OPENAI_API_KEY || ''
        if (!apiKey) throw new Error('NEXUS_OPENAI_API_KEY no configurada')
        content = await callOpenAICompatible(req, profile, apiKey, baseUrl)
      }
      if (content && content.trim()) {
        attempts.push({ profileId: profile.id, ok: true })
        return { content, profileId: profile.id, attempts }
      }
      attempts.push({ profileId: profile.id, ok: false, error: 'respuesta vacía' })
    } catch (err) {
      attempts.push({ profileId: profile.id, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  // Fallback final: llamada sin modelo explícito
  try {
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: req.messages as Parameters<typeof zai.chat.completions.create>[0]['messages'],
      temperature: req.temperature ?? 0.4,
    })
    const content = completion.choices[0]?.message?.content ?? ''
    attempts.push({ profileId: 'sdk-default', ok: true })
    return { content, profileId: 'sdk-default', attempts }
  } catch (err) {
    attempts.push({ profileId: 'sdk-default', ok: false, error: err instanceof Error ? err.message : String(err) })
    throw new Error(`Todos los modelos fallaron: ${attempts.map((a) => `${a.profileId}: ${a.error}`).join(' | ')}`)
  }
}

function candidatesEmpty(profiles: RouterProfile[], task: string): boolean {
  return !profiles.some((p) => p.enabled && p.useFor.includes(task as never))
}
