import { VISIBILITY_META } from '@/lib/reportVisibility'
import type { ReportVisibility } from '@/types/database'

export default function VisibilityBadge({ visibility }: { visibility: ReportVisibility }) {
  const m = VISIBILITY_META[visibility] ?? VISIBILITY_META.author_only
  return (
    <span style={{
      background: m.bg, color: m.color,
      border: `1px solid ${m.color}44`,
      borderRadius: '6px', padding: '2px 8px',
      fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  )
}
