import { NextRequest, NextResponse } from 'next/server'
import { saveKey, listKeys, deleteKey } from '@/lib/security/vault'
import { getProfiles, saveProfiles } from '@/lib/router/model-router'
import { getExchangeStatus, getAccountSnapshot } from '@/lib/exchange/adapter'
import { db } from '@/lib/db'
import type { RouterProfile } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [keys, profiles, exchanges] = await Promise.all([listKeys(), getProfiles(), getExchangeStatus()])
    return NextResponse.json({ keys, routerProfiles: profiles, exchanges })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action: 'addKey' | 'deleteKey' | 'toggleKey' | 'saveProfiles' | 'testAccount'
      label?: string; exchange?: string; scope?: string; secret?: string; id?: string
      profiles?: RouterProfile[]
    }

    if (body.action === 'addKey') {
      if (!body.secret || body.secret.length < 16) {
        return NextResponse.json({ ok: false, message: 'Clave inválida (mínimo 16 caracteres)' }, { status: 400 })
      }
      if (body.scope === 'withdraw') {
        return NextResponse.json({ ok: false, message: '⛔ Las claves con permiso de retiro están PROHIBIDAS por política de seguridad' }, { status: 422 })
      }
      const entry = await saveKey({
        label: body.label ?? 'Mi clave',
        exchange: body.exchange ?? 'binance',
        scope: body.scope === 'trade' ? 'trade' : 'read',
        secret: body.secret,
      })
      await db.riskEvent.create({ data: { type: 'vault_key_added', severity: 'info', message: `Clave "${entry.label}" añadida al vault (${entry.exchange}, ${entry.scope})` } })
      return NextResponse.json({ ok: true, key: entry })
    }

    if (body.action === 'deleteKey' && body.id) {
      await deleteKey(body.id)
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'toggleKey' && body.id) {
      const key = await db.vaultKey.findUnique({ where: { id: body.id } })
      if (key) await db.vaultKey.update({ where: { id: key.id }, data: { active: !key.active } })
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'saveProfiles' && body.profiles) {
      await saveProfiles(body.profiles)
      return NextResponse.json({ ok: true, profiles: body.profiles })
    }

    if (body.action === 'testAccount') {
      return NextResponse.json(await getAccountSnapshot())
    }

    return NextResponse.json({ ok: false, message: 'Acción inválida' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
