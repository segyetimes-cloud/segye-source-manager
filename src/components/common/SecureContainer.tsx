'use client'

/**
 * SecureContainer — 1단계 복사 차단 래퍼
 *
 * 민감 정보를 감싸면:
 *   - 마우스 드래그 선택(user-select: none)
 *   - 우클릭 컨텍스트 메뉴 차단
 *   - Ctrl+A / Ctrl+C 차단
 *
 * data-secure="true" 속성이 붙어 CopyGuard가 이 요소의
 * copy 이벤트에 visible 경고 푸터를 추가합니다.
 *
 * 사용법:
 *   <SecureContainer>
 *     <p>민감한 내용</p>
 *   </SecureContainer>
 *
 * disabled={true} 로 보호를 일시 해제할 수 있습니다.
 */

import { useCallback } from 'react'

interface Props {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  /** true 이면 보호 기능을 모두 끕니다 (편집 모드 등) */
  disabled?: boolean
}

export default function SecureContainer({ children, className, style, disabled = false }: Props) {
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!disabled) e.preventDefault()
  }, [disabled])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return
    const ctrl = e.ctrlKey || e.metaKey
    // Ctrl+A: 전체 선택 차단
    if (ctrl && e.key === 'a') {
      e.preventDefault()
      return
    }
    // Ctrl+C: 복사 차단 (CopyGuard가 copy 이벤트를 처리하므로 keydown 수준에서도 차단)
    if (ctrl && e.key === 'c') {
      e.preventDefault()
    }
  }, [disabled])

  // dragstart 차단: 드래그로 텍스트 추출 방지
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!disabled) e.preventDefault()
  }, [disabled])

  if (disabled) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'],
        ...style,
      }}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      onDragStart={handleDragStart}
      data-secure="true"
    >
      {children}
    </div>
  )
}
