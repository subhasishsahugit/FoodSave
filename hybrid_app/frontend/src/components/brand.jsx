import { Link } from 'react-router-dom'
import { Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Brand({ className, to = '/home' }) {
  return (
    <Link
      to={to}
      className={cn('flex shrink-0 items-center gap-1.5 !text-[17px] font-semibold !tracking-[-0.011em]', className)}
    >
      <Leaf className="size-[19px] text-[var(--safe)]" strokeWidth={2} />
      <span>
        Food<span className="text-muted-foreground">Save</span>
      </span>
    </Link>
  )
}