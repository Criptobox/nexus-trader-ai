import { NextRequest, NextResponse } from 'next/server'
import { chat, listConversations, getConversation } from '@/lib/agents/chat-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { message?: string; conversationId?: string; agentId?: string; cgId?: string }
    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
    }
    const result = await chat({
      message: body.message.trim().slice(0, 4000),
      conversationId: body.conversationId,
      agentId: body.agentId as never,
      cgId: body.cgId,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error del agente' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const conversationId = new URL(req.url).searchParams.get('conversationId')
    if (conversationId) {
      const conv = await getConversation(conversationId)
      if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
      return NextResponse.json(conv)
    }
    return NextResponse.json({ conversations: await listConversations() })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}
