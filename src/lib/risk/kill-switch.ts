// ─────────────────────────────────────────────────────────────
// Kill Switch — corte de emergencia en 4 niveles
// · manual: el usuario pulsa el botón rojo
// · daily_loss: pérdida diaria superada (soft_stop)
// · drawdown: drawdown global superado (full_stop)
// · consecutive_losses: racha de pérdidas (soft_stop)
// ─────────────────────────────────────────────────────────────
import { db } from '@/lib/db'
import type { KillSwitchStatus } from '@/lib/types'
import { logRiskEvent, dailyPnlPct, currentDrawdownPct, getRiskConfig } from '@/lib/risk/risk-engine'

export async function getStatus(): Promise<KillSwitchStatus> {
  let ks = await db.killSwitchState.findFirst()
  if (!ks) {
    ks = await db.killSwitchState.create({ data: {} })
  }
  return {
    active: ks.active,
    level: ks.level as KillSwitchStatus['level'],
    reason: ks.reason,
    triggeredBy: ks.triggeredBy,
    activatedAt: ks.activatedAt?.toISOString() ?? null,
    autoResumeAt: ks.autoResumeAt?.toISOString() ?? null,
  }
}

async function setStatus(level: 'normal' | 'soft_stop' | 'full_stop', triggeredBy: string, reason: string, meta?: Record<string, unknown>) {
  const existing = await db.killSwitchState.findFirst()
  const data = {
    active: level !== 'normal',
    level,
    triggeredBy: level === 'normal' ? null : triggeredBy,
    reason: level === 'normal' ? null : reason,
    activatedAt: level === 'normal' ? null : new Date(),
    meta: meta ? JSON.stringify(meta) : null,
    updatedAt: new Date(),
  }
  if (existing) {
    await db.killSwitchState.update({ where: { id: existing.id }, data })
  } else {
    await db.killSwitchState.create({ data })
  }
}

export async function manualActivate(reason: string): Promise<KillSwitchStatus> {
  await setStatus('full_stop', 'manual', reason || 'Activación manual del Kill Switch')
  await logRiskEvent('kill_switch_manual', 'critical', `Kill Switch activado manualmente: ${reason}`)
  // cierra posiciones abiertas del paper trading (protección total)
  await closeAllPaperPositions('killswitch')
  return getStatus()
}

export async function deactivate(): Promise<KillSwitchStatus> {
  await setStatus('normal', 'manual', '')
  await logRiskEvent('kill_switch_off', 'info', 'Kill Switch desactivado — operativa reanudada')
  return getStatus()
}

export async function closeAllPaperPositions(source: string): Promise<number> {
  const positions = await db.paperPosition.findMany({ where: { status: 'open' } })
  let closed = 0
  const { closePosition } = await import('@/lib/trading/paper-engine')
  for (const p of positions) {
    try {
      await closePosition(p.id, source)
      closed++
    } catch { /* posición individual falla, continúa con las demás */ }
  }
  return closed
}

// Evaluación continua: la llaman las APIs de mercado/paper tras cada evento
export async function evaluateTriggers(): Promise<KillSwitchStatus> {
  const cfg = await getRiskConfig()
  const ks = await getStatus()

  if (ks.active && ks.triggeredBy === 'manual') return ks // el manual solo se apaga a mano

  // 1. pérdida diaria
  const dayPnl = await dailyPnlPct()
  if (dayPnl <= -cfg.maxDailyLoss) {
    if (ks.level !== 'soft_stop') {
      await setStatus('soft_stop', 'daily_loss', `Pérdida diaria ${dayPnl.toFixed(2)}% superó el límite ${cfg.maxDailyLoss}%`, { dayPnl })
      await logRiskEvent('kill_switch_daily_loss', 'critical', `Soft stop por pérdida diaria: ${dayPnl.toFixed(2)}%`)
    }
    return getStatus()
  }

  // 2. drawdown global
  const dd = await currentDrawdownPct()
  if (dd >= cfg.maxDrawdown) {
    if (ks.level !== 'full_stop') {
      await setStatus('full_stop', 'drawdown', `Drawdown ${dd.toFixed(1)}% superó el máximo ${cfg.maxDrawdown}% — posiciones cerradas`, { dd })
      await logRiskEvent('kill_switch_drawdown', 'critical', `Full stop por drawdown: ${dd.toFixed(1)}%`)
      await closeAllPaperPositions('risk_engine')
    }
    return getStatus()
  }

  // 3. racha de pérdidas consecutivas
  const lastClosed = await db.paperOrder.findMany({
    where: { realizedPnl: { not: null } },
    orderBy: { filledAt: 'desc' },
    take: cfg.consecutiveLossLimit,
  })
  if (
    lastClosed.length >= cfg.consecutiveLossLimit &&
    lastClosed.every((o) => (o.realizedPnl ?? 0) < 0)
  ) {
    if (ks.level !== 'soft_stop') {
      await setStatus('soft_stop', 'consecutive_losses', `${cfg.consecutiveLossLimit} pérdidas consecutivas — pausa obligatoria`, {})
      await logRiskEvent('kill_switch_streak', 'warning', `Soft stop: ${cfg.consecutiveLossLimit} pérdidas seguidas`)
    }
    return getStatus()
  }

  // sin disparadores: si estaba en soft_stop automático se reanuda
  if (ks.active && ks.triggeredBy !== 'manual') {
    await setStatus('normal', '', '')
  }
  return getStatus()
}
