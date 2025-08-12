import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Lazily create admin Supabase client
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.NEXT_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase admin credentials')
  }
  return createClient(url, serviceKey)
}

// Twilio client creator
function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) {
    throw new Error('Missing Twilio credentials')
  }
  // Dynamically import twilio to avoid bundling in edge envs
  // eslint-disable-next-line global-require
  const twilio = require('twilio')
  return twilio(sid, token)
}

async function processReminders({ approverId = null, dryRun = false } = {}) {
  const supabase = getAdminClient()

  const { data: pending, error } = await supabase
    .from('posts')
    .select('approver_id, id')
    .eq('status', 'pending_approval')

  if (error) {
    return { error: error.message }
  }

  const byApprover = new Map()
  for (const row of pending || []) {
    if (!row.approver_id) continue
    if (approverId && row.approver_id !== approverId) continue
    const current = byApprover.get(row.approver_id) || []
    current.push(row.id)
    byApprover.set(row.approver_id, current)
  }

  if (byApprover.size === 0) {
    return { sent: 0, details: [] }
  }

  const approverIds = Array.from(byApprover.keys())
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, phone_number, sms_opt_in, full_name')
    .in('id', approverIds)

  if (profilesError) {
    return { error: profilesError.message }
  }

  const profilesById = new Map((profiles || []).map(p => [p.id, p]))
  const messages = []
  for (const [id, postIds] of byApprover.entries()) {
    const profile = profilesById.get(id)
    if (!profile?.sms_opt_in) continue
    if (!profile?.phone_number) continue
    const count = postIds.length
    const name = profile.full_name ? `, ${profile.full_name}` : ''
    const msg = `You have ${count} post${count === 1 ? '' : 's'} pending approval${name}. Review: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.scriib.ai'}/approval-portal`
    messages.push({ to: profile.phone_number, body: msg, approverId: id, count })
  }

  if (dryRun) {
    return { sent: 0, details: messages, dryRun: true }
  }

  if (messages.length === 0) {
    return { sent: 0, details: [] }
  }

  const twilioClient = getTwilioClient()
  const fromNumber = process.env.TWILIO_FROM_NUMBER
  if (!fromNumber) {
    return { error: 'Missing TWILIO_FROM_NUMBER' }
  }

  const results = []
  for (const m of messages) {
    try {
      const res = await twilioClient.messages.create({ from: fromNumber, to: m.to, body: m.body })
      results.push({ approverId: m.approverId, to: m.to, sid: res.sid, status: res.status, count: m.count })
    } catch (e) {
      results.push({ approverId: m.approverId, to: m.to, error: e.message, count: m.count })
    }
  }

  return { sent: results.filter(r => r.sid).length, details: results }
}

// POST allows triggering for a specific approver or dry-run
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const approverId = body?.approverId || null
    const dryRun = !!body?.dryRun
    const result = await processReminders({ approverId, dryRun })
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET triggers a non-dry-run send (for cron compatibility)
export async function GET() {
  const result = await processReminders({ approverId: null, dryRun: false })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json(result)
}


