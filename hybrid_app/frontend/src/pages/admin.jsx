import { useMemo, useState } from 'react'
import { RefreshCw, Shield, Users, Cpu, TriangleAlert, CheckCircle2, List } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card,  CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ActionTile, KpiRow, PageHeader, SectionHeader } from '@/components/common'
import {  ScatterCard, TreemapCard } from '@/components/charts'
import { LeaderboardCard, LiveBoard } from '@/components/portal'
import { apiSend } from '@/lib/api'
import { useApp } from '@/lib/store'
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format'

/* ======================================================= ADMIN OVERVIEW */
export function AdminOverview() {
  const { analytics, rows, loading, refresh } = useApp()
  const m = analytics?.metrics

  const points = useMemo(
    () =>
      rows.map((r) => ({
        x: Number(r.temp),
        y: Number(r.safe_hours),
        z: Number(r.qty),
        label: `${r.food_name} · ${r.donor_name}`,
      })),
    [rows],
  )

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Platform overview"
        description="Everything happening across donors, NGOs and the safety model."
        actions={
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      {m ? (
        <KpiRow
          items={[
            { label: 'Listings', value: formatNumber(m.total_listings), icon: List },
            { label: 'Claims', value: formatNumber(m.claimed_listings), icon: CheckCircle2, tone: 'safe' },
            { label: 'Avg safe window', value: `${m.avg_safe_hours}h`, icon: Cpu },
            { label: 'High-risk open', value: formatNumber(m.high_risk_available), icon: TriangleAlert, tone: 'unsafe' },
          ]}
        />
      ) : null}

      <section>
        <SectionHeader eyebrow="Quick actions" title="Administration" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionTile to="/admin/users" icon={Users} title="Manage users" description="Verify, unverify, ban or restore" />
          <ActionTile to="/admin/ai-logs" icon={Cpu} title="AI & audit logs" description="Predictions and admin actions" />
          <ActionTile to="/leaderboard" icon={Shield} title="Leaderboard" description="Community ranking" />
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ScatterCard
          title="Storage temperature vs safe window"
          description="Every listing, sized by quantity"
          points={points}
          threshold={5}
          caption="Source: /api/food/all"
        />
        <TreemapCard
          title="Donor contribution"
          description="Kilograms published"
          data={(analytics?.donor_volume ?? []).map((d) => ({ label: d.name, value: d.qty }))}
          caption="Source: /api/analytics → donor_volume"
        />
      </div>

      <LiveBoard rows={rows} analytics={analytics} />
      <LeaderboardCard analytics={analytics} rows={rows} />
    </>
  )
}

/* ========================================================= ADMIN USERS */
export function AdminUsers() {
  const { adminUsers, loading, refresh, user } = useApp()
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)

  const counts = useMemo(
    () => ({
      all: adminUsers.length,
      DONOR: adminUsers.filter((u) => u.role === 'DONOR').length,
      NGO: adminUsers.filter((u) => u.role === 'NGO').length,
      ADMIN: adminUsers.filter((u) => u.role === 'ADMIN').length,
      unverified: adminUsers.filter((u) => !u.is_verified).length,
      banned: adminUsers.filter((u) => u.is_banned).length,
    }),
    [adminUsers],
  )

  const shown = adminUsers.filter((u) => {
    if (filter === 'all') return true
    if (filter === 'unverified') return !u.is_verified
    if (filter === 'banned') return u.is_banned
    return u.role === filter
  })

  function act(target, action) {
    setBusyId(target.id)
    apiSend(`/api/admin/users/${target.id}/status`, 'PATCH', { action })
      .then(() => {
        toast.success('Account updated', { description: `${target.username} → ${action}` })
        refresh()
      })
      .catch((err) => toast.error('Action failed', { description: err.message }))
      .finally(() => setBusyId(null))
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="User management"
        description="Verify pending accounts and restrict access. Every action is written to the audit log."
        actions={
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="max-w-full justify-start overflow-x-auto">
          {[
            ['all', `All (${counts.all})`],
            ['DONOR', `Donors (${counts.DONOR})`],
            ['NGO', `NGOs (${counts.NGO})`],
            ['ADMIN', `Admins (${counts.ADMIN})`],
            ['unverified', `Unverified (${counts.unverified})`],
            ['banned', `Banned (${counts.banned})`],
          ].map(([v, label]) => (
            <TabsTrigger key={v} value={v}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="!px-0">
          {shown.length === 0 ? (
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyTitle>No accounts</EmptyTitle>
                <EmptyDescription>Nobody matches this filter.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 shrink-0">
                            <AvatarFallback>{u.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-[590]">{u.username}</p>
                            <p className="text-xs text-muted-foreground">#{u.id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{u.role === 'DONOR' ? 'Donor' : u.role === 'NGO' ? 'NGO' : 'Admin'}</Badge>
                      </TableCell>
                      <TableCell>
                        {u.is_verified ? (
                          <Badge
                            variant="outline"
                            className="gap-1 !bg-[var(--safe-soft)] !text-[var(--safe)]"
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 !bg-[var(--caution-soft)] !text-[var(--caution)]"
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.is_banned ? (
                          <Badge variant="outline" className="gap-1 !bg-[var(--unsafe-soft)] !text-[var(--unsafe)]">
                            <span className="size-1.5 rounded-full bg-current" />
                            Banned
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <span className="size-1.5 rounded-full bg-current" />
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.username === user.username ? (
                          <span className="text-xs text-muted-foreground">This account</span>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[var(--system-blue)]"
                              disabled={busyId === u.id}
                              onClick={() => act(u, u.is_verified ? 'unverify' : 'verify')}
                            >
                              {u.is_verified ? 'Unverify' : 'Verify'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={busyId === u.id}
                              onClick={() => act(u, u.is_banned ? 'unban' : 'ban')}
                            >
                              {u.is_banned ? 'Unban' : 'Ban'}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/* ====================================================== ADMIN AI LOGS */
export function AdminAiLogs() {
  const { aiLogs, auditLogs, loading, refresh } = useApp()
  const flagged = aiLogs.filter((l) => l.risk_flag === 'HIGH').length

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="AI & audit logs"
        description="Every prediction the model produced, and every action taken on the platform."
        actions={
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      <KpiRow
        items={[
          { label: 'Predictions logged', value: aiLogs.length, icon: Cpu },
          { label: 'High-risk flagged', value: flagged, icon: TriangleAlert, tone: 'unsafe' },
          { label: 'Rescued', value: aiLogs.filter((l) => l.is_claimed).length, icon: CheckCircle2, tone: 'safe' },
          { label: 'Audit events', value: auditLogs.length, icon: List },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Model predictions</CardTitle>
          <CardDescription>Newest first, from the AI log endpoint</CardDescription>
        </CardHeader>
        <CardContent className="!px-0">
          {aiLogs.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyTitle>No predictions yet</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Prediction</TableHead>
                    <TableHead>Safe hours</TableHead>
                    <TableHead>Flag</TableHead>
                    <TableHead className="text-right">Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aiLogs.slice(0, 40).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="tabular-nums text-xs text-muted-foreground">{l.id}</TableCell>
                      <TableCell>
                        <p className="truncate font-[590]">{l.food_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {l.donor_name} · {formatNumber(l.temp, 0)}°C · {formatNumber(l.hours_ago)}h old
                        </p>
                      </TableCell>
                      <TableCell className="tabular-nums">{Number(l.safe_hours).toFixed(1)}h</TableCell>
                      <TableCell>
                        {l.risk_flag === 'HIGH' ? (
                          <Badge
                            variant="outline"
                            className="gap-1 !bg-[var(--unsafe-soft)] !text-[var(--unsafe)]"
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            High risk
                          </Badge>
                        ) : (
                          <Badge variant="outline">Normal</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {l.is_claimed ? (
                          <Badge
                            variant="outline"
                            className="!bg-[var(--safe-soft)] !text-[var(--safe)]"
                          >
                            Rescued
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Awaiting claim</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit trail</CardTitle>
          <CardDescription>Logins, claims, listings and admin actions</CardDescription>
        </CardHeader>
        <CardContent className="!p-0">
          {auditLogs.length === 0 ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyTitle>No audit events</EmptyTitle>
                <EmptyDescription>Activity will appear here as it happens.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ol>
              {auditLogs.slice(0, 40).map((log) => {
                let meta = {}
                try {
                  meta = JSON.parse(log.meta || '{}')
                } catch {
                  meta = {}
                }
                const detail = Object.entries(meta)
                  .filter(([, v]) => v != null && v !== '')
                  .slice(0, 3)
                  .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                  .join(' · ')
                return (
                  <li key={log.id} className="hig-row !items-start !gap-3 !py-2.5">
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="hig-row__title !font-[590] capitalize">
                        {String(log.action || '').replace(/_/g, ' ')}
                        {log.actor ? <span className="font-[400] text-muted-foreground"> · {log.actor}</span> : null}
                      </p>
                      <p className="hig-row__subtitle truncate">
                        {log.entity ? `${log.entity}${log.entity_id ? ` #${log.entity_id}` : ''}` : ''}
                        {detail ? ` · ${detail}` : ''}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-xs text-muted-foreground"
                      title={formatDateTime(log.created_at)}
                    >
                      {formatRelative(log.created_at)}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </>
  )
}