<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- as any 현황 (2026-05-22 기준): 생산코드 9개 — 모두 구조적 한계로 제거 불가
    - information_reports Relationships 버그: reports/[id]/route.ts(×2), review/route.ts(×1)
    - supabase textSearch 미지원: sources/route.ts(×1)
    - dynamic updateFields Record: sources/[id]/route.ts(×1)
    - RPC args 타입 한계: export/sources/route.ts(×1)
    - navigator.contacts 브라우저 API: ContactImporter.tsx(×2)
    - audit_logs 커스텀 action 허용: audit.ts(×1) ← 의도적 escape hatch
-->