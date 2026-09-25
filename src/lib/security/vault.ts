// ─────────────────────────────────────────────────────────────
// Vault de claves API — AES-256-GCM con derivación scrypt
// Las claves NUNCA se guardan en texto plano y jamás se
// devuelven completas al cliente (solo vista enmascarada).
// ─────────────────────────────────────────────────────────────
import crypto from 'node:crypto'
import { db } from '@/lib/db'

const SECRET = process.env.NEXUS_MASTER_SECRET || 'nexus-dev-master-secret-change-me'

function deriveKey(salt: Buffer): Buffer {
  return crypto.scryptSync(SECRET, salt, 32, { N: 16384, r: 8, p: 1 })
}

export function encryptSecret(plaintext: string): { cipherText: string; iv: string; authTag: string } {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = deriveKey(salt)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // salt se antepone al ciphertext para descifrado autónomo
  return {
    cipherText: Buffer.concat([salt, enc]).toString('hex'),
    iv: iv.toString('hex'),
    authTag: tag.toString('hex'),
  }
}

export function decryptSecret(cipherText: string, iv: string, authTag: string): string {
  const raw = Buffer.from(cipherText, 'hex')
  const salt = raw.subarray(0, 16)
  const data = raw.subarray(16)
  const key = deriveKey(salt)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 8) return '••••••••'
  return `${plaintext.slice(0, 4)}••••••••${plaintext.slice(-4)}`
}

export interface VaultEntry {
  id: string
  label: string
  exchange: string
  scope: string
  masked: string
  active: boolean
  createdAt: Date
}

export async function saveKey(input: { label: string; exchange: string; scope: string; secret: string }): Promise<VaultEntry> {
  const { cipherText, iv, authTag } = encryptSecret(input.secret)
  const row = await db.vaultKey.create({
    data: {
      label: input.label, exchange: input.exchange, scope: input.scope,
      cipherText, iv, authTag, masked: maskSecret(input.secret),
    },
  })
  return toEntry(row)
}

export async function listKeys(): Promise<VaultEntry[]> {
  const rows = await db.vaultKey.findMany({ orderBy: { createdAt: 'desc' } })
  return rows.map(toEntry)
}

export async function deleteKey(id: string): Promise<void> {
  await db.vaultKey.delete({ where: { id } })
}

export async function getKeySecret(id: string): Promise<string | null> {
  const row = await db.vaultKey.findUnique({ where: { id } })
  if (!row || !row.active) return null
  try {
    return decryptSecret(row.cipherText, row.iv, row.authTag)
  } catch {
    return null
  }
}

function toEntry(row: { id: string; label: string; exchange: string; scope: string; masked: string; active: boolean; createdAt: Date }): VaultEntry {
  return {
    id: row.id, label: row.label, exchange: row.exchange,
    scope: row.scope, masked: row.masked, active: row.active,
    createdAt: row.createdAt,
  }
}
