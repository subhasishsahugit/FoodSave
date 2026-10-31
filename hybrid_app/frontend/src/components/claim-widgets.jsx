import { useEffect, useRef, useState } from 'react'
import { Check, Clock, MessageSquare, Send, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { ListGroup, SafetyBadge } from '@/components/common'
import { useApp } from '@/lib/store'
import { formatCountdown, formatNumber, formatRelative } from '@/lib/format'

/* ----------------------------------------------------------- feed card */
export function FeedCard({ row, selected, onSelect }) {
  const stats = [
    ['Quantity', `${formatNumber(row.qty)} kg`],
    ['Temp', `${formatNumber(row.temp, 0)}°C`],
    ['Age', `${formatNumber(row.hours_ago)}h`],
    ...(row.distance_km != null ? [['Distance', `${formatNumber(row.distance_km, 1)} km`]] : []),
  ]

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid="feed-card"
      aria-pressed={selected}
      className={`hig-group w-full text-left transition-shadow ${selected ? 'ring-2 ring-primary' : ''}`}
    >
      <span className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
        <span className="min-w-0">
          <span className="hig-row__title block truncate !font-[590]">{row.food_name}</span>
          <span className="hig-row__subtitle block truncate">
            {row.donor_name} · {row.donor_location_text || 'Odisha'}
          </span>
        </span>
        <SafetyBadge hours={row.safe_hours} />
      </span>
      <span className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--hig-separator)] px-4 py-2.5 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <span key={label}>
            <span className="block text-[11px] text-muted-foreground">{label}</span>
            <span className="block text-[13px] tabular-nums">{value}</span>
          </span>
        ))}
      </span>
    </button>
  )
}

/* ---------------------------------------------------------- pickup pass */
export function PickupPass({ row, onChat }) {
  const pass = row.pickup_pass || {}
  const expiresAt = pass.expires_at || null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!expiresAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  const msLeft = expiresAt ? new Date(expiresAt).getTime() - now : Number(row.safe_hours || 0) * 3600000
  const verified = !!pass.is_verified
  const expired = msLeft <= 0

  return (
    <div
      data-testid="pickup-pass"
      className="overflow-hidden rounded-xl border border-[var(--hig-separator)] bg-card"
      style={{ background: `linear-gradient(160deg, ${verified ? 'var(--safe-soft)' : 'var(--hig-fill-quaternary)'}, transparent 60%), var(--card)` }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <p className="hig-section-label">Pickup pass</p>
          <p className="truncate font-mono text-base font-semibold tracking-[0.06em]">
            {pass.pass_code || <span className="font-sans text-sm font-normal text-muted-foreground">No pass issued</span>}
          </p>
          <p className="mt-1 truncate text-[13px] text-muted-foreground">
            {row.food_name} · {formatNumber(row.qty)} kg
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Badge
            variant="outline"
            className="border-transparent"
            style={{
              background: verified ? 'var(--safe-soft)' : expired ? 'var(--unsafe-soft)' : 'var(--caution-soft)',
              color: verified ? 'var(--safe)' : expired ? 'var(--unsafe)' : 'var(--caution)',
            }}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {verified ? 'Verified' : expired ? 'Expired' : 'Active'}
          </Badge>
          <p className="mt-1.5 text-[22px] leading-tight font-semibold tabular-nums tracking-[-0.012em]">
            {expired ? '00m' : formatCountdown(msLeft)}
          </p>
          <p className="text-[10px] text-muted-foreground">remaining</p>
        </div>
      </div>

      <div className="space-y-1 px-4 pb-4 text-[13px] text-muted-foreground">
        <p>Donor {row.donor_name}</p>
        <p className="truncate">{row.donor_location_text || 'Odisha, India'}</p>
        <p>
          Safe for {Number(row.safe_hours).toFixed(1)}h from listing · claimed by {row.claimed_by || '—'}
        </p>
        {pass.verified_by ? (
          <p>
            Verified by {pass.verified_by}
            {pass.verified_at ? ` · ${formatRelative(pass.verified_at)}` : ''}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--hig-separator)] bg-[var(--hig-fill-quaternary)] px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Show this code at pickup
        </span>
        {onChat ? (
          <Button size="sm" variant="secondary" onClick={() => onChat(row)}>
            <MessageSquare /> Chat
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- claim chat */
const STATUS_ICON = {
  sending: Clock,
  failed: TriangleAlert,
  sent: Check,
  delivered: Check,
  read: Check,
}

function MessageStatus({ status, failed }) {
  const Icon = STATUS_ICON[status] || Check
  return <Icon className="size-3 shrink-0" style={failed ? { color: 'var(--unsafe)' } : undefined} />
}

export function ClaimChat() {
  const { chat, user, setActiveChatFoodId, sendChatMessage, setChatDraft } = useApp()
  const logRef = useRef(null)
  const [stick, setStick] = useState(true)

  const active = chat.threads.find((t) => t.food_id === chat.activeChatFoodId)

  useEffect(() => {
    const el = logRef.current
    if (el && stick) el.scrollTop = el.scrollHeight
  }, [chat.messages.length, chat.activeChatFoodId, stick])

  function onScroll(e) {
    const el = e.currentTarget
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 90)
  }

  function send() {
    const draft = (chat.draft || '').trim()
    if (!draft) return
    sendChatMessage(draft)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim chat</CardTitle>
        <CardDescription>Coordinate pickup with the other party</CardDescription>
      </CardHeader>
      <CardContent className="!px-0">
        <div className="grid min-h-[420px] md:grid-cols-[260px_1fr]">
          <ScrollArea className="max-h-[420px] border-b border-[var(--hig-separator)] md:max-h-[460px] md:border-r md:border-b-0">
            {chat.threads.length === 0 ? (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Send />
                  </EmptyMedia>
                  <EmptyTitle>No conversations</EmptyTitle>
                  <EmptyDescription>Chats open once a listing is claimed.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ListGroup className="rounded-none border-0">
                {chat.threads.map((t) => (
                  <button
                    key={t.food_id}
                    type="button"
                    onClick={() => setActiveChatFoodId(t.food_id)}
                  data-testid="chat-thread"
                    className={`hig-row !border-b !border-[var(--hig-separator)] ${
                      t.food_id === chat.activeChatFoodId ? 'bg-[var(--hig-fill-tertiary)]' : ''
                    }`}
                  >
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback>{t.counterpart.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="hig-row__title min-w-0 truncate !font-[590]">{t.counterpart}</span>
                        {t.unread_count > 0 ? <Badge className="shrink-0 !text-[10px]">{t.unread_count}</Badge> : null}
                      </span>
                      <span className="hig-row__subtitle block truncate">
                        {t.food_name} · {t.last_message || 'No messages yet'}
                      </span>
                    </span>
                  </button>
                ))}
              </ListGroup>
            )}
          </ScrollArea>

          <div className="flex flex-col">
            {!active ? (
              <Empty className="flex-1 py-16">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Send />
                  </EmptyMedia>
                  <EmptyTitle>Select a conversation</EmptyTitle>
                  <EmptyDescription>Pick a claimed listing on the left to open its chat.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-[var(--hig-separator)] px-4 py-2.5">
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback>{active.counterpart.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="hig-row__title truncate !font-[590]">{active.counterpart}</p>
                    <p className="hig-row__subtitle truncate">
                      {active.food_name} · {formatNumber(active.qty)} kg
                    </p>
                  </div>
                  <SafetyBadge hours={active.safe_hours} />
                </div>

                <ScrollArea ref={logRef} onScroll={onScroll} className="flex-1">
                  <div className="flex flex-col gap-2 p-4">
                    {chat.loading ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">Loading conversation…</p>
                    ) : chat.messages.length === 0 ? (
                      <Empty className="py-10">
                        <EmptyHeader>
                          <EmptyTitle>No messages yet</EmptyTitle>
                          <EmptyDescription>Say hello to {active.counterpart} to arrange the pickup.</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    ) : (
                      chat.messages.map((m) => {
                        const mine = m.sender === user.username
                        return (
                          <div
                            key={m.id || m.client_nonce}
                            data-testid={mine ? 'chat-bubble-out' : 'chat-bubble-in'}
                            className={`max-w-[76%] rounded-lg px-3 py-2 text-[15px] leading-snug tracking-[-0.008em] ${
                              mine
                                ? 'self-end bg-primary text-primary-foreground'
                                : 'self-start bg-[var(--hig-fill-tertiary)] text-foreground'
                            } ${m.failed ? 'ring-1 ring-destructive' : ''}`}
                          >
                            <span>{m.message}</span>
                            <span
                              className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
                                mine ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              }`}
                            >
                              {formatRelative(m.created_at)}
                              {mine ? <MessageStatus status={m.status || 'sending'} failed={m.failed} /> : null}
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>

                <div className="flex items-end gap-2 border-t border-[var(--hig-separator)] bg-[var(--hig-fill-quaternary)] p-3">
                  <Textarea
                    value={chat.draft || ''}
                    placeholder="Write a message…"
                    aria-label="Message"
                    rows={1}
                    className="!min-h-10 resize-none"
                    onChange={(e) => setChatDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        send()
                      }
                    }}
                  />
                  <Button disabled={!(chat.draft || '').trim()} onClick={send}>
                    <Send /> Send
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
