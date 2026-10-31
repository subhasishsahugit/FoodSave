import { useMemo, useState } from 'react'
import { Boxes, ChevronLeft, ChevronRight, Download, MessageSquare, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import { SafetyBadge } from '@/components/common'
import { downloadCsv, formatNumber, titleCase, toCsv } from '@/lib/format'

function EditListingDialog({ row, onClose, onSave }) {
  const [form, setForm] = useState({
    food_name: row.food_name || '',
    qty: row.qty,
    temp: row.temp,
    hours_ago: row.hours_ago,
  })
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit listing #{row.id}</DialogTitle>
          <DialogDescription>
            Changing temperature, age or packaging re-runs the safety model and recalculates the safe window.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field>
            <FieldLabel htmlFor="edit-name">Food name</FieldLabel>
            <Input id="edit-name" value={form.food_name} onChange={set('food_name')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="edit-qty">Quantity (kg)</FieldLabel>
              <Input id="edit-qty" type="number" min="0.1" step="0.1" value={form.qty} onChange={set('qty')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-temp">Temperature (°C)</FieldLabel>
              <Input id="edit-temp" type="number" step="1" value={form.temp} onChange={set('temp')} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="edit-hours">Hours since prepared</FieldLabel>
            <Input id="edit-hours" type="number" min="0" step="0.5" value={form.hours_ago} onChange={set('hours_ago')} />
            <FieldDescription>Used as the age input to the safety model.</FieldDescription>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true)
              onSave(row.id, form).finally(() => setBusy(false))
            }}
          >
            {busy ? <Spinner /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ListingsTable({
  rows = [],
  loading,
  title = 'Listings',
  subtitle,
  emptyTitle = 'No listings yet',
  emptyText,
  onClaim,
  onRetract,
  onOpenChat,
  onSave,
  allowEdit = true,
}) {
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const perPage = 8
  const pages = Math.max(1, Math.ceil(rows.length / perPage))
  const current = Math.min(page, pages)
  const visible = useMemo(
    () => rows.slice((current - 1) * perPage, current * perPage),
    [rows, current],
  )

  const columns = useMemo(() => {
    const cols = [
      {
        key: 'id',
        head: '#',
        cell: (r) => <span className="tabular-nums text-xs text-muted-foreground">{r.id}</span>,
      },
      {
        key: 'food_name',
        head: 'Food',
        cell: (r) => (
          <div className="min-w-0">
            <p className="truncate font-[590]">{r.food_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {titleCase(r.food_category)} · {titleCase(r.storage_conditions)} · {titleCase(r.packaging)}
            </p>
          </div>
        ),
      },
      {
        key: 'donor_name',
        head: 'Donor',
        cell: (r) => (
          <div className="min-w-0">
            <p className="truncate">{r.donor_name}</p>
            {r.donor_location_text ? (
              <p className="truncate text-xs text-muted-foreground">{r.donor_location_text}</p>
            ) : null}
          </div>
        ),
      },
      {
        key: 'qty',
        head: 'Qty',
        headClass: 'text-right',
        cellClass: 'text-right',
        cell: (r) => <span className="tabular-nums">{formatNumber(r.qty)} kg</span>,
      },
      { key: 'safe_hours', head: 'Safe window', cell: (r) => <SafetyBadge hours={r.safe_hours} /> },
      {
        key: 'status',
        head: 'Status',
        cell: (r) =>
          r.is_claimed ? (
            <Badge variant="secondary" className="gap-1">
              <span className="size-1.5 rounded-full bg-current" />
              {r.claimed_by ? `Claimed by ${r.claimed_by}` : 'Claimed'}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 !bg-[var(--safe-soft)] !text-[var(--safe)]"
            >
              <span className="size-1.5 rounded-full bg-current" />
              Available
            </Badge>
          ),
      },
    ]

    if (onOpenChat || onClaim || onRetract || allowEdit) {
      cols.push({
        key: 'actions',
        head: '',
        headClass: 'text-right',
        cellClass: 'text-right',
        cell: (r) => (
          <div className="flex justify-end gap-1">
            {onOpenChat && r.is_claimed ? (
              <Button variant="ghost" size="icon" className="size-8" aria-label="Open chat" onClick={() => onOpenChat(r)}>
                <MessageSquare className="size-3.5" />
              </Button>
            ) : null}
            {onClaim && !r.is_claimed ? (
              <Button size="sm" variant="secondary" onClick={() => onClaim(r)}>
                Claim
              </Button>
            ) : null}
            {onRetract && !r.is_claimed ? (
              <Button variant="ghost" size="icon" className="size-8 text-destructive" aria-label="Retract listing" onClick={() => onRetract(r)}>
                <Trash2 className="size-3.5" />
              </Button>
            ) : null}
            {allowEdit ? (
              <Button variant="ghost" size="icon" className="size-8" aria-label="Edit listing" onClick={() => setEditing(r)}>
                <Pencil className="size-3.5" />
              </Button>
            ) : null}
          </div>
        ),
      })
    }
    return cols
  }, [onOpenChat, onClaim, onRetract, allowEdit])

  function exportCsv() {
    downloadCsv(
      'foodsave-listings.csv',
      toCsv(rows, [
        { label: 'ID', key: 'id' },
        { label: 'Food', key: 'food_name' },
        { label: 'Donor', key: 'donor_name' },
        { label: 'Qty (kg)', key: 'qty' },
        { label: 'Temp (C)', key: 'temp' },
        { label: 'Hours ago', key: 'hours_ago' },
        { label: 'Safe hours', key: 'safe_hours' },
        { label: 'Status', csv: (r) => (r.is_claimed ? 'claimed' : 'available') },
        { label: 'Claimed by', csv: (r) => r.claimed_by || '' },
      ]),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
        <CardAction>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download />
            Export
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="!px-0">
        {loading && !rows.length ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Spinner /> Loading listings…
          </div>
        ) : rows.length === 0 ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Boxes />
              </EmptyMedia>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              {emptyText ? <EmptyDescription>{emptyText}</EmptyDescription> : null}
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key} className={c.headClass}>
                      {c.head}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <TableRow key={r.id}>
                    {columns.map((c) => (
                      <TableCell key={c.key} className={c.cellClass}>
                        {c.cell(r)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {rows.length > perPage ? (
        <div className="flex items-center justify-between gap-4 border-t border-[var(--hig-separator)] px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            {(current - 1) * perPage + 1}–{Math.min(current * perPage, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Previous page"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft />
            </Button>
            <span className="px-2 text-xs tabular-nums">
              {current} / {pages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Next page"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}

      {editing && onSave ? (
        <EditListingDialog row={editing} onClose={() => setEditing(null)} onSave={onSave} />
      ) : null}
    </Card>
  )
}