'use client'

/**
 * BusinessCardBatchScanner
 *
 * 명함 여러 장을 한꺼번에 찍거나 선택해서 일괄 OCR → 취재원 일괄 등록
 *
 * 흐름:
 *  1. 수집  — 카메라 연속 촬영 or 파일 다중 선택 → 썸네일 큐
 *  2. 분석  — [한꺼번에 분석] → 병렬 OCR API 호출 → 진행 표시
 *  3. 리뷰  — 카드별 추출 결과 + 필드 수정 + 체크박스 선택
 *  4. 저장  — [선택한 명함 등록] → /api/sources 병렬 POST
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ── 타입 ────────────────────────────────────────────────────────────────────

interface ExtractedCard {
  full_name:             string
  name_en:               string
  current_organization:  string
  current_position:      string
  department:            string
  phone_primary:         string
  phone_secondary:       string
  email_primary:         string
  address:               string
  website:               string
}

type CardState =
  | { phase: 'pending' }
  | { phase: 'analyzing' }
  | { phase: 'done';  data: ExtractedCard }
  | { phase: 'error'; error: string }
  | { phase: 'saved'; sourceId: string }

interface QueueItem {
  id:        string          // 임시 UUID
  dataUrl:   string          // 미리보기용 base64
  file:      File
  state:     CardState
  checked:   boolean         // 저장 대상 선택 여부
}

// ── 상수 ────────────────────────────────────────────────────────────────────

const MAX_CARDS = 20
const FIELD_LABELS: Record<keyof ExtractedCard, string> = {
  full_name:            '이름',
  name_en:              '영문이름',
  current_organization: '소속',
  current_position:     '직책',
  department:           '부서',
  phone_primary:        '전화(주)',
  phone_secondary:      '전화(보조)',
  email_primary:        '이메일',
  address:              '주소',
  website:              '웹사이트',
}
const REQUIRED_FIELDS: Array<keyof ExtractedCard> = ['full_name']

// ── 유틸 ────────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload  = e => res(e.target!.result as string)
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bytes = atob(data)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new File([arr], filename, { type: mime })
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function BusinessCardBatchScanner() {
  const router   = useRouter()
  const fileRef  = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [queue,        setQueue]        = useState<QueueItem[]>([])
  const [cameraOpen,   setCameraOpen]   = useState(false)
  const [cameraReady,  setCameraReady]  = useState(false)
  const [analyzing,    setAnalyzing]    = useState(false)   // 전체 분석 진행 중
  const [analyzeCount, setAnalyzeCount] = useState(0)       // 분석 완료 건수
  const [saving,       setSaving]       = useState(false)
  const [globalError,  setGlobalError]  = useState('')

  // ── 카메라 ───────────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraReady(false)
    setCameraOpen(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  async function openCamera() {
    if (queue.length >= MAX_CARDS) {
      setGlobalError(`최대 ${MAX_CARDS}장까지 추가할 수 있습니다.`)
      return
    }
    setGlobalError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current!.play()
          setCameraReady(true)
        }
      }
      setCameraOpen(true)
    } catch {
      // 카메라 권한 없으면 파일 선택으로 대체
      fileRef.current?.click()
    }
  }

  function captureCard() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const vw = video.videoWidth,  vh = video.videoHeight
    const cardW = Math.round(vw * 0.88)
    const cardH = Math.round(cardW / 1.586)
    const cardX = Math.round((vw - cardW) / 2)
    const cardY = Math.round((vh - cardH) / 2)

    canvas.width = cardW;  canvas.height = cardH
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, cardX, cardY, cardW, cardH, 0, 0, cardW, cardH)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const file = dataUrlToFile(dataUrl, `card_${Date.now()}.jpg`)

    const item: QueueItem = {
      id: uid(), dataUrl, file,
      state: { phase: 'pending' },
      checked: true,
    }
    setQueue(prev => [...prev, item])
    // 카메라 유지 (연속 촬영)
  }

  // ── 파일 다중 선택 ───────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const remaining = MAX_CARDS - queue.length
    const picked = files.slice(0, remaining)
    if (files.length > remaining) {
      setGlobalError(`${files.length}장 중 ${picked.length}장만 추가했습니다 (최대 ${MAX_CARDS}장).`)
    }

    const items: QueueItem[] = await Promise.all(
      picked.filter(f => f.type.startsWith('image/')).map(async file => ({
        id:      uid(),
        dataUrl: await fileToDataUrl(file),
        file,
        state:   { phase: 'pending' as const },
        checked: true,
      }))
    )
    setQueue(prev => [...prev, ...items])
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── 큐 아이템 관리 ───────────────────────────────────────────────────────

  function removeItem(id: string) {
    setQueue(prev => prev.filter(item => item.id !== id))
  }

  function toggleCheck(id: string) {
    setQueue(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ))
  }

  function updateField(id: string, field: keyof ExtractedCard, value: string) {
    setQueue(prev => prev.map(item => {
      if (item.id !== id || item.state.phase !== 'done') return item
      return { ...item, state: { phase: 'done', data: { ...item.state.data, [field]: value } } }
    }))
  }

  // ── OCR 분석 ────────────────────────────────────────────────────────────

  async function analyzeAll() {
    const targets = queue.filter(item => item.state.phase === 'pending')
    if (!targets.length) return

    setAnalyzing(true)
    setAnalyzeCount(0)
    setGlobalError('')

    // 상태를 analyzing으로 변경
    setQueue(prev => prev.map(item =>
      item.state.phase === 'pending'
        ? { ...item, state: { phase: 'analyzing' } }
        : item
    ))

    const form = new FormData()
    targets.forEach(item => form.append('images', item.file))

    try {
      const res = await fetch('/api/ocr/business-card/batch', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) {
        setGlobalError(json.error ?? 'OCR 오류')
        // analyzing → pending으로 복구
        setQueue(prev => prev.map(item =>
          item.state.phase === 'analyzing'
            ? { ...item, state: { phase: 'pending' } }
            : item
        ))
        return
      }

      const resultMap = new Map<number, typeof json.results[0]>()
      for (const r of json.results ?? []) resultMap.set(r.index, r)

      setQueue(prev => {
        let analysisIdx = 0
        return prev.map(item => {
          if (item.state.phase !== 'analyzing') return item
          const r = resultMap.get(analysisIdx++)
          if (!r) return { ...item, state: { phase: 'error', error: '응답 없음' } }
          return {
            ...item,
            checked: !r.error,
            state: r.error
              ? { phase: 'error', error: r.error }
              : { phase: 'done', data: r.data as ExtractedCard },
          }
        })
      })

      setAnalyzeCount(targets.length)
    } catch (e: any) {
      setGlobalError(e?.message ?? '서버 오류')
      setQueue(prev => prev.map(item =>
        item.state.phase === 'analyzing'
          ? { ...item, state: { phase: 'pending' } }
          : item
      ))
    } finally {
      setAnalyzing(false)
    }
  }

  // ── 취재원 일괄 저장 ─────────────────────────────────────────────────────

  async function saveSelected() {
    const targets = queue.filter(
      item => item.checked && item.state.phase === 'done'
    )
    if (!targets.length) return

    // 필수 필드(이름) 없는 카드 검증
    const invalid = targets.filter(item =>
      item.state.phase === 'done' && !item.state.data.full_name?.trim()
    )
    if (invalid.length) {
      setGlobalError(`이름이 없는 명함 ${invalid.length}장이 있습니다. 이름을 직접 입력해주세요.`)
      return
    }

    setSaving(true)
    setGlobalError('')

    const results = await Promise.allSettled(
      targets.map(async item => {
        if (item.state.phase !== 'done') throw new Error('not done')
        const d = item.state.data
        const body = {
          full_name:            d.full_name?.trim()             || null,
          current_organization: d.current_organization?.trim()  || null,
          current_position:     d.current_position?.trim()      || null,
          current_department:   d.department?.trim()            || null,
          phone_primary:        d.phone_primary?.trim()         || null,
          phone_secondary:      d.phone_secondary?.trim()       || null,
          email_primary:        d.email_primary?.trim()         || null,
          visibility:           'personal',
          sensitivity:          'public',
        }
        const res = await fetch('/api/sources', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? '저장 실패')
        return { id: item.id, sourceId: json.id as string }
      })
    )

    // 성공/실패 결과를 큐에 반영
    setQueue(prev => {
      const savedMap = new Map<string, string>()
      const errorMap = new Map<string, string>()

      results.forEach((result, i) => {
        const qid = targets[i].id
        if (result.status === 'fulfilled') savedMap.set(qid, result.value.sourceId)
        else errorMap.set(qid, String(result.reason?.message ?? '저장 실패'))
      })

      return prev.map(item => {
        if (savedMap.has(item.id)) return { ...item, state: { phase: 'saved', sourceId: savedMap.get(item.id)! }, checked: false }
        if (errorMap.has(item.id)) return { ...item, state: { phase: 'error', error: errorMap.get(item.id)! } }
        return item
      })
    })

    const savedCount  = results.filter(r => r.status === 'fulfilled').length
    const failedCount = results.filter(r => r.status === 'rejected').length

    if (failedCount > 0) {
      setGlobalError(`${savedCount}명 저장 완료 / ${failedCount}명 실패 (오류 항목 확인)`)
    }

    setSaving(false)

    // 전부 저장 성공 → 목록으로 이동
    if (failedCount === 0 && savedCount > 0) {
      router.push(`/sources?batch_imported=${savedCount}`)
    }
  }

  // ── 파생 상태 ────────────────────────────────────────────────────────────

  const pendingCount   = queue.filter(i => i.state.phase === 'pending').length
  const analyzingCount = queue.filter(i => i.state.phase === 'analyzing').length
  const doneCount      = queue.filter(i => i.state.phase === 'done').length
  const errorCount     = queue.filter(i => i.state.phase === 'error').length
  const savedCount     = queue.filter(i => i.state.phase === 'saved').length
  const checkedCount   = queue.filter(i => i.checked && i.state.phase === 'done').length

  // ── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>

      {/* ── 수집 도구바 ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
        padding: '12px 16px', borderRadius: '10px',
        background: 'rgba(30,144,255,0.04)', border: '1px solid rgba(30,144,255,0.15)',
        marginBottom: '16px',
      }}>
        <input
          ref={fileRef} type="file" accept="image/*" multiple
          onChange={handleFileChange} style={{ display: 'none' }}
        />

        {/* 카메라 */}
        <button
          type="button" onClick={cameraOpen ? stopCamera : openCamera}
          disabled={analyzing || saving}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
            background: cameraOpen ? 'rgba(192,64,64,0.15)' : 'rgba(30,144,255,0.15)',
            color:      cameraOpen ? '#C04040' : '#4A7CC0',
            border:    `1px solid ${cameraOpen ? 'rgba(192,64,64,0.35)' : 'rgba(30,144,255,0.35)'}`,
            cursor: 'pointer',
          }}
        >
          {cameraOpen ? '📷 카메라 닫기' : '📷 카메라로 촬영'}
        </button>

        {/* 파일 선택 */}
        <button
          type="button" onClick={() => fileRef.current?.click()}
          disabled={analyzing || saving || queue.length >= MAX_CARDS}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
            background: 'rgba(30,144,255,0.08)',
            color: '#687898', border: '1px solid #1A2838', cursor: 'pointer',
          }}
        >
          🖼️ 사진 파일 선택 (여러 장)
        </button>

        {/* 통계 */}
        {queue.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', fontSize: '12px', flexWrap: 'wrap' }}>
            {pendingCount  > 0 && <span style={{ color: '#687898' }}>대기 {pendingCount}장</span>}
            {analyzingCount > 0 && <span style={{ color: '#4A7CC0' }}>분석 중 {analyzingCount}장</span>}
            {doneCount     > 0 && <span style={{ color: '#3D9E6A' }}>완료 {doneCount}장</span>}
            {errorCount    > 0 && <span style={{ color: '#C04040' }}>오류 {errorCount}장</span>}
            {savedCount    > 0 && <span style={{ color: '#7E6E48' }}>저장됨 {savedCount}장</span>}
          </div>
        )}
      </div>

      {/* ── 카메라 뷰 ─────────────────────────────────────────────────────── */}
      {cameraOpen && (
        <div style={{
          marginBottom: '16px', borderRadius: '10px', overflow: 'hidden',
          border: '1px solid rgba(30,144,255,0.25)', background: '#000',
        }}>
          <div style={{ position: 'relative' }}>
            <video
              ref={videoRef} playsInline muted
              style={{ width: '100%', display: 'block', maxHeight: '280px', objectFit: 'cover' }}
            />
            {/* 명함 가이드 */}
            {cameraReady && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                  <defs>
                    <mask id="batch-card-mask">
                      <rect width="100%" height="100%" fill="white" />
                      <rect x="6%" y="22.5%" width="88%" height="55%" rx="6" fill="black" />
                    </mask>
                  </defs>
                  <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#batch-card-mask)" />
                </svg>
                {/* 코너 마크 */}
                {[
                  { top: '22.5%', left: '6%' },
                  { top: '22.5%', right: '6%' },
                  { bottom: '22.5%', left: '6%' },
                  { bottom: '22.5%', right: '6%' },
                ].map((pos, i) => (
                  <div key={i} style={{
                    position: 'absolute', width: '20px', height: '20px',
                    borderColor: '#4A7CC0', borderStyle: 'solid', borderWidth: 0,
                    ...(i === 0 && { borderTopWidth: 3, borderLeftWidth: 3, borderRadius: '4px 0 0 0', ...pos }),
                    ...(i === 1 && { borderTopWidth: 3, borderRightWidth: 3, borderRadius: '0 4px 0 0', ...pos }),
                    ...(i === 2 && { borderBottomWidth: 3, borderLeftWidth: 3, borderRadius: '0 0 0 4px', ...pos }),
                    ...(i === 3 && { borderBottomWidth: 3, borderRightWidth: 3, borderRadius: '0 0 4px 0', ...pos }),
                  }} />
                ))}
                {/* 촬영 횟수 표시 */}
                <div style={{
                  position: 'absolute', top: '8px', right: '8px',
                  background: 'rgba(0,0,0,0.6)', borderRadius: '12px',
                  padding: '2px 10px', fontSize: '11px', color: '#4A7CC0', fontWeight: 700,
                }}>
                  {queue.length}/{MAX_CARDS}장
                </div>
              </div>
            )}
          </div>

          {/* 카메라 버튼 */}
          <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', background: '#0D1520' }}>
            <button
              type="button" onClick={captureCard}
              disabled={!cameraReady || queue.length >= MAX_CARDS}
              style={{
                flex: 1, padding: '10px',
                background: (cameraReady && queue.length < MAX_CARDS) ? '#4A7CC0' : '#1A2838',
                color: '#fff', border: 'none', borderRadius: '8px',
                fontSize: '14px', fontWeight: 700, cursor: cameraReady ? 'pointer' : 'default',
              }}
            >
              📸 촬영 {queue.length > 0 && `(${queue.length}장 누적)`}
            </button>
            <button
              type="button" onClick={stopCamera}
              style={{
                padding: '10px 18px', background: 'transparent',
                color: '#485870', border: '1px solid #1A2838',
                borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
              }}
            >
              완료
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── 글로벌 오류 ───────────────────────────────────────────────────── */}
      {globalError && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
          background: 'rgba(192,64,64,0.08)', border: '1px solid rgba(192,64,64,0.3)',
          fontSize: '13px', color: '#C04040',
        }}>
          ⚠ {globalError}
        </div>
      )}

      {/* ── 큐 없을 때 안내 ────────────────────────────────────────────────── */}
      {queue.length === 0 && !cameraOpen && (
        <div style={{
          padding: '40px', textAlign: 'center',
          border: '2px dashed #1A2838', borderRadius: '10px',
          background: 'rgba(30,144,255,0.02)',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📇</div>
          <p style={{ fontSize: '14px', color: '#687898', fontWeight: 600 }}>
            명함 사진을 추가해주세요
          </p>
          <p style={{ fontSize: '12px', color: '#485870', marginTop: '6px' }}>
            카메라로 연속 촬영하거나, 갤러리에서 여러 장을 한꺼번에 선택할 수 있습니다
          </p>
        </div>
      )}

      {/* ── 명함 썸네일 큐 (분석 전) ──────────────────────────────────────── */}
      {queue.some(i => i.state.phase === 'pending') && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '10px',
          }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#CDD5E0' }}>
              📋 분석 대기 — {pendingCount}장
            </p>
            <button
              type="button" onClick={analyzeAll}
              disabled={analyzing || saving || pendingCount === 0}
              style={{
                padding: '9px 20px', borderRadius: '8px',
                background: pendingCount > 0 ? 'linear-gradient(135deg,#4A7CC0,#0066CC)' : '#1A2838',
                color: '#fff', border: 'none', fontWeight: 700,
                fontSize: '13px', cursor: pendingCount > 0 ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {analyzing ? (
                <>
                  <span style={{
                    display: 'inline-block', width: '14px', height: '14px',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                  }} />
                  분석 중...
                </>
              ) : `🔍 ${pendingCount}장 한꺼번에 분석`}
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '8px',
          }}>
            {queue.filter(i => i.state.phase === 'pending').map(item => (
              <div key={item.id} style={{
                position: 'relative', borderRadius: '8px', overflow: 'hidden',
                border: '1px solid #1A2838', background: '#0D1520',
              }}>
                <img
                  src={item.dataUrl} alt="명함"
                  style={{ width: '100%', height: '80px', objectFit: 'cover', display: 'block' }}
                />
                <button
                  type="button" onClick={() => removeItem(item.id)}
                  style={{
                    position: 'absolute', top: '4px', right: '4px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: 'rgba(0,0,0,0.7)', color: '#fff',
                    border: 'none', fontSize: '12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 분석 중 오버레이 ──────────────────────────────────────────────── */}
      {analyzingCount > 0 && (
        <div style={{
          padding: '16px', borderRadius: '10px', marginBottom: '16px', textAlign: 'center',
          background: 'rgba(30,144,255,0.06)', border: '1px solid rgba(30,144,255,0.2)',
        }}>
          <div style={{ fontSize: '13px', color: '#4A7CC0', fontWeight: 600 }}>
            AI가 명함을 분석하고 있습니다...
          </div>
          <div style={{
            marginTop: '8px', height: '6px', borderRadius: '3px',
            background: '#1A2838', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: '3px', background: '#4A7CC0',
              width: `${(analyzeCount / (analyzingCount + analyzeCount)) * 100}%`,
              transition: 'width 0.3s',
              animation: 'shimmer 1.5s infinite',
            }} />
          </div>
        </div>
      )}

      {/* ── 분석 결과 카드 리뷰 ───────────────────────────────────────────── */}
      {queue.some(i => i.state.phase === 'done' || i.state.phase === 'error' || i.state.phase === 'saved') && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '12px', flexWrap: 'wrap', gap: '8px',
          }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#CDD5E0', margin: 0 }}>
                📝 추출 결과 확인 · 수정
              </p>
              {checkedCount > 0 && (
                <p style={{ fontSize: '11px', color: '#3D9E6A', marginTop: '3px' }}>
                  {checkedCount}장 선택됨 — 저장 전 내용을 확인해주세요
                </p>
              )}
            </div>
            {checkedCount > 0 && (
              <button
                type="button" onClick={saveSelected}
                disabled={saving}
                style={{
                  padding: '10px 24px', borderRadius: '8px',
                  background: saving ? '#1A2838' : 'linear-gradient(135deg,#3D9E6A,#2E7D52)',
                  color: '#fff', border: 'none', fontWeight: 700,
                  fontSize: '13px', cursor: saving ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {saving ? (
                  <>
                    <span style={{
                      display: 'inline-block', width: '14px', height: '14px',
                      border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                    }} />
                    저장 중...
                  </>
                ) : `💾 선택한 ${checkedCount}명 취재원 등록`}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {queue
              .filter(i => ['done', 'error', 'saved'].includes(i.state.phase))
              .map(item => (
                <ResultCard
                  key={item.id}
                  item={item}
                  onToggleCheck={() => toggleCheck(item.id)}
                  onUpdateField={(field, value) => updateField(item.id, field, value)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes shimmer { 0%,100% { opacity: 1 } 50% { opacity: 0.6 } }
      `}</style>
    </div>
  )
}

// ── 결과 카드 컴포넌트 ────────────────────────────────────────────────────────

function ResultCard({
  item, onToggleCheck, onUpdateField, onRemove,
}: {
  item:          QueueItem
  onToggleCheck: () => void
  onUpdateField: (field: keyof ExtractedCard, value: string) => void
  onRemove:      () => void
}) {
  const { state } = item

  // 저장 완료
  if (state.phase === 'saved') {
    return (
      <div style={{
        padding: '12px 16px', borderRadius: '10px',
        background: 'rgba(61,158,106,0.06)', border: '1px solid rgba(61,158,106,0.25)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <img src={item.dataUrl} alt="" style={{ width: '60px', height: '38px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
        <p style={{ fontSize: '13px', color: '#3D9E6A', fontWeight: 600, margin: 0 }}>
          ✅ 저장 완료 —{' '}
          <a href={`/sources/${state.sourceId}`} style={{ color: '#4A7CC0', textDecoration: 'underline' }}>
            취재원 보기
          </a>
        </p>
      </div>
    )
  }

  // 오류
  if (state.phase === 'error') {
    return (
      <div style={{
        padding: '12px 16px', borderRadius: '10px',
        background: 'rgba(192,64,64,0.06)', border: '1px solid rgba(192,64,64,0.25)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <img src={item.dataUrl} alt="" style={{ width: '60px', height: '38px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '13px', color: '#C04040', fontWeight: 600, margin: '0 0 4px' }}>
            ⚠ OCR 실패
          </p>
          <p style={{ fontSize: '12px', color: '#685070', margin: 0 }}>{state.error}</p>
        </div>
        <button type="button" onClick={onRemove}
          style={{ background: 'none', border: 'none', color: '#485870', fontSize: '16px', cursor: 'pointer' }}>
          ✕
        </button>
      </div>
    )
  }

  // done — 편집 카드
  if (state.phase !== 'done') return null
  const d = state.data

  return (
    <div style={{
      borderRadius: '10px', overflow: 'hidden',
      border: `1px solid ${item.checked ? 'rgba(30,144,255,0.3)' : '#1A2838'}`,
      background: item.checked ? 'rgba(30,144,255,0.03)' : 'rgba(13,21,32,0.8)',
      transition: 'border-color 0.2s, background 0.2s',
    }}>
      {/* 카드 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 14px',
        background: item.checked ? 'rgba(30,144,255,0.07)' : 'rgba(26,40,56,0.6)',
        borderBottom: '1px solid #1A2838',
      }}>
        {/* 체크박스 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}>
          <input
            type="checkbox" checked={item.checked} onChange={onToggleCheck}
            style={{ width: '16px', height: '16px', accentColor: '#4A7CC0' }}
          />
          <span style={{ fontSize: '12px', color: item.checked ? '#4A7CC0' : '#485870', fontWeight: 600 }}>
            {item.checked ? '등록 포함' : '등록 제외'}
          </span>
        </label>

        {/* 썸네일 */}
        <img
          src={item.dataUrl} alt="명함"
          style={{
            width: '72px', height: '45px', objectFit: 'cover',
            borderRadius: '4px', border: '1px solid #1A2838', flexShrink: 0,
          }}
        />

        {/* 요약 정보 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#CDD5E0', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {d.full_name || <span style={{ color: '#C04040' }}>이름 없음 ← 필수 입력</span>}
          </p>
          <p style={{ fontSize: '12px', color: '#687898', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[d.current_organization, d.current_position].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>

        <button type="button" onClick={onRemove}
          style={{ background: 'none', border: 'none', color: '#485870', fontSize: '18px', cursor: 'pointer', flexShrink: 0 }}>
          ✕
        </button>
      </div>

      {/* 필드 편집 그리드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '8px', padding: '12px 14px',
      }}>
        {(Object.keys(FIELD_LABELS) as Array<keyof ExtractedCard>).map(field => (
          <div key={field}>
            <label style={{ display: 'block', fontSize: '10px', color: '#485870', marginBottom: '3px' }}>
              {FIELD_LABELS[field]}
              {REQUIRED_FIELDS.includes(field) && <span style={{ color: '#C04040' }}> *</span>}
            </label>
            <input
              type="text"
              value={(d[field] as string) ?? ''}
              onChange={e => onUpdateField(field, e.target.value)}
              placeholder={`${FIELD_LABELS[field]} 입력`}
              style={{
                width: '100%', padding: '6px 9px', fontSize: '12px',
                background: '#182035',
                border: `1px solid ${REQUIRED_FIELDS.includes(field) && !d[field] ? 'rgba(192,64,64,0.5)' : '#1A2838'}`,
                borderRadius: '6px', color: '#CDD5E0', outline: 'none',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
