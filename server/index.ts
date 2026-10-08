import { serve } from 'bun'

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL = 'EventLucky <noreply@eventlucky.app>'

// In-memory store (replace with DB in production)
const playerRegistry: Map<string, { email: string; chosenNumber: number; eventId: string; playerAddress: string }[]> = new Map()

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.log('[email] RESEND_API_KEY not set, skipping email to', to)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
  if (!res.ok) {
    console.error('[email] Failed to send:', await res.text())
  } else {
    console.log('[email] Sent to', to)
  }
}

serve({
  port: 3001,
  async fetch(req) {
    const url = new URL(req.url)

    // CORS headers for local dev
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers })
    }

    // POST /register-player
    if (req.method === 'POST' && url.pathname === '/register-player') {
      try {
        const body = await req.json() as { eventId: string; playerAddress: string; email: string; chosenNumber: number }
        const { eventId, playerAddress, email, chosenNumber } = body
        if (!eventId || !playerAddress || !email || chosenNumber == null) {
          return new Response(JSON.stringify({ error: 'missing fields' }), { status: 400, headers })
        }

        const key = eventId
        const entries = playerRegistry.get(key) ?? []
        // avoid duplicates
        if (!entries.find(e => e.playerAddress.toLowerCase() === playerAddress.toLowerCase())) {
          entries.push({ email, chosenNumber, eventId, playerAddress })
          playerRegistry.set(key, entries)
        }

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
      } catch (_err) {
        return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers })
      }
    }

    // POST /notify-winners  (called after draw event is detected)
    if (req.method === 'POST' && url.pathname === '/notify-winners') {
      try {
        const body = await req.json() as {
          eventId: string
          eventName: string
          winningNumber: number
          winners: { address: string; amount: string }[]
          claimDeadline: string
          claimUrl: string
        }
        const { eventId, eventName, winningNumber, winners, claimDeadline, claimUrl } = body

        const entries = playerRegistry.get(eventId) ?? []

        for (const winner of winners) {
          const entry = entries.find(e => e.playerAddress.toLowerCase() === winner.address.toLowerCase())
          if (!entry) continue

          const html = `
            <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f9f9fc;">
              <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 24px rgba(18,45,69,0.08);">
                <h1 style="font-size: 24px; font-weight: 700; color: #122d45; margin: 0 0 8px;">Chuc mung! Ban da thang!</h1>
                <p style="color: #6b6580; margin: 0 0 24px;">Sự kiện: <strong style="color: #122d45;">${eventName}</strong></p>

                <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
                  <p style="margin: 0 0 8px; color: #6b6580; font-size: 14px;">Giải thưởng của bạn</p>
                  <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1a8047;">${winner.amount} USDC</p>
                  <p style="margin: 8px 0 0; font-size: 13px; color: #6b6580;">Số trúng: <strong>${winningNumber}</strong></p>
                </div>

                <a href="${claimUrl}"
                   style="display: block; text-align: center; background: #122d45; color: white; text-decoration: none; padding: 14px 24px; border-radius: 12px; font-weight: 600; font-size: 15px; margin-bottom: 16px;">
                  Nhận thưởng ngay
                </a>

                <p style="color: #ba2b4c; font-size: 13px; text-align: center; margin: 0;">
                  Hết hạn: ${claimDeadline}. Sau thời hạn tiền sẽ được hoàn về host.
                </p>

                <hr style="border: none; border-top: 1px solid rgba(18,45,69,0.08); margin: 24px 0;" />
                <p style="color: #8a849c; font-size: 12px; text-align: center; margin: 0;">
                  Email này được gửi từ EventLucky. Link chỉ dành cho địa chỉ ví ${entry.playerAddress.slice(0, 6)}...${entry.playerAddress.slice(-4)}.
                </p>
              </div>
            </div>
          `

          await sendEmail(entry.email, `EventLucky: Ban da thang ${winner.amount} USDC!`, html)
        }

        return new Response(JSON.stringify({ ok: true, notified: winners.length }), { status: 200, headers })
      } catch (err) {
        console.error('[notify-winners]', err)
        return new Response(JSON.stringify({ error: 'internal error' }), { status: 500, headers })
      }
    }

    // GET /health
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
    }

    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers })
  },
})

console.log('[server] EventLucky backend running on port 3001')
