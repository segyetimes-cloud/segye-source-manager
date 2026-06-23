import type { ReportVisibility } from '@/types/database'

export interface VisibilityMeta {
  label: string
  shortLabel: string
  desc: string
  bg: string
  color: string
}

export const VISIBILITY_META: Record<ReportVisibility, VisibilityMeta> = {
  author_only: {
    label: '🔒 최고 보안',
    shortLabel: '최고 보안',
    desc: '작성자 본인 + 직속 부장 + 부국장·편집국장·편집인만 열람. 취재원 신변 위협 우려 시 선택',
    bg: 'rgba(255,68,68,0.1)',
    color: '#C04040',
  },
  desk_above: {
    label: '🏢 부장 이상',
    shortLabel: '부장 이상',
    desc: '전체 부장·부국장·편집국장·편집인 열람 가능. 타 부서 기자는 차단됨',
    bg: 'rgba(0,212,255,0.1)',
    color: '#3A90A8',
  },
  my_desk: {
    label: '👤 소속 부장',
    shortLabel: '소속 부장',
    desc: '작성자의 직속 부장과 부국장 이상 직급만 열람. 타 부서 부장은 차단됨',
    bg: 'rgba(138,90,200,0.1)',
    color: '#8A5AC8',
  },
  team: {
    label: '👥 팀 공개',
    shortLabel: '팀 공개',
    desc: '작성자와 같은 부서 기자 전원 열람 가능. 타 부서 기자는 차단됨',
    bg: 'rgba(168,114,40,0.1)',
    color: '#A87228',
  },
  all: {
    label: '🌐 사내 공유',
    shortLabel: '사내 공유',
    desc: '언론사 전체 공유. 부서 간 융합 취재가 필요한 사안에 사용',
    bg: 'rgba(0,204,102,0.1)',
    color: '#3D9E6A',
  },
}

export const VISIBILITY_OPTIONS = (
  Object.entries(VISIBILITY_META) as [ReportVisibility, VisibilityMeta][]
).map(([value, meta]) => ({ value, ...meta }))

// 보고서 작성/수정 폼에서 사용할 공개 범위 선택지 (3가지로 단순화)
export const GENERAL_VISIBILITY_OPTIONS: { value: ReportVisibility; label: string; desc: string }[] = [
  { value: 'all',     label: '편집국 전체',     desc: '로그인한 모든 구성원이 열람할 수 있습니다.' },
  { value: 'team',    label: '부서에만 공개',   desc: '작성자와 같은 부서 구성원이 열람할 수 있습니다.' },
  { value: 'my_desk', label: '소속 부장에게만', desc: '작성자의 직속 부장과 부국장 이상만 열람할 수 있습니다.' },
]
