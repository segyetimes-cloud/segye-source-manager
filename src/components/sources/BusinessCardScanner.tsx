'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

interface Props {
  onExtracted: (data: { [key: string]: string | null | undefined }) => void
}

export default function BusinessCardScanner({ onExtracted }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [mode, setMode] = useState<'idle' | 'camera' | 'preview'>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)

  // 카메라 스트림 종료
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }, [])

  // 컴포넌트 언마운트 시 카메라 정리
  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  // 카메라 시작
  async function startCamera() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // 후면 카메라
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setCameraReady(true)
        }
      }
      setMode('camera')
    } catch {
      // 카메라 권한 없으면 파일 선택으로 대체
      setError('')
      fileRef.current?.click()
    }
  }

  // 명함 영역 캡처 (가이드 박스 기준으로 크롭)
  function captureCard() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const vw = video.videoWidth
    const vh = video.videoHeight

    // 가이드 박스: 비디오 중앙, 가로 88%, 세로 55% (명함 비율 86:54≈1.59)
    const cardW = Math.round(vw * 0.88)
    const cardH = Math.round(cardW / 1.586) // 명함 표준 비율
    const cardX = Math.round((vw - cardW) / 2)
    const cardY = Math.round((vh - cardH) / 2)

    canvas.width = cardW
    canvas.height = cardH
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, cardX, cardY, cardW, cardH, 0, 0, cardW, cardH)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setPreview(dataUrl)
    stopCamera()
    setMode('preview')
  }

  // dataURL → File
  function dataUrlToFile(dataUrl: string, filename: string): File {
    const [header, data] = dataUrl.split(',')
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
    const bytes = atob(data)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    return new File([arr], filename, { type: mime })
  }

  async function sendToOCR(imageSource: File | string) {
    setError('')
    setLoading(true)
    try {
      let file: File
      if (typeof imageSource === 'string') {
        file = dataUrlToFile(imageSource, 'card.jpg')
      } else {
        file = imageSource
      }

      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/ocr/business-card', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'OCR 실패')
        return
      }
      onExtracted(json.data)
      setDone(true)
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 파일 선택 (갤러리 / 기존 사진)
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      setPreview(ev.target?.result as string)
      setMode('preview')
    }
    reader.readAsDataURL(file)
  }

  function reset() {
    stopCamera()
    setMode('idle')
    setPreview(null)
    setDone(false)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── 렌더링 ──────────────────────────────────────────────

  // 카메라 뷰
  if (mode === 'camera') {
    return (
      <div style={{
        border: '2px dashed #1A2838',
        borderRadius: '10px',
        padding: '12px',
        background: 'rgba(30,144,255,0.03)',
      }}>
        <p style={{ fontSize: '12px', color: '#687898', marginBottom: '8px', textAlign: 'center' }}>
          명함을 가이드 안에 맞춰주세요
        </p>

        {/* 카메라 + 오버레이 */}
        <div style={{ position: 'relative', width: '100%', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: '100%', display: 'block', maxHeight: '260px', objectFit: 'cover' }}
          />

          {/* 반투명 마스크 + 명함 가이드 박스 */}
          {cameraReady && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {/* 어두운 마스크 (명함 영역 제외) */}
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                <defs>
                  <mask id="card-mask">
                    <rect width="100%" height="100%" fill="white" />
                    {/* 명함 영역: 중앙 88% × 55% */}
                    <rect x="6%" y="22.5%" width="88%" height="55%" rx="6" fill="black" />
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#card-mask)" />
              </svg>

              {/* 코너 마크 */}
              {[
                { top: '22.5%', left: '6%' },
                { top: '22.5%', right: '6%' },
                { bottom: '22.5%', left: '6%' },
                { bottom: '22.5%', right: '6%' },
              ].map((pos, i) => (
                <div key={i} style={{
                  position: 'absolute', width: '18px', height: '18px',
                  borderColor: '#4A7CC0', borderStyle: 'solid', borderWidth: 0,
                  ...(i === 0 && { borderTopWidth: 3, borderLeftWidth: 3, borderRadius: '4px 0 0 0', ...pos }),
                  ...(i === 1 && { borderTopWidth: 3, borderRightWidth: 3, borderRadius: '0 4px 0 0', ...pos }),
                  ...(i === 2 && { borderBottomWidth: 3, borderLeftWidth: 3, borderRadius: '0 0 0 4px', ...pos }),
                  ...(i === 3 && { borderBottomWidth: 3, borderRightWidth: 3, borderRadius: '0 0 4px 0', ...pos }),
                }} />
              ))}

              {/* 중앙 안내 텍스트 */}
              <div style={{
                position: 'absolute', top: '22.5%', left: '6%', right: '6%', height: '55%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: '11px', color: 'rgba(255,255,255,0.6)',
                  background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '4px',
                }}>
                  명함을 이 안에 맞춰주세요
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 캡처 버튼 */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <button
            type="button"
            onClick={captureCard}
            disabled={!cameraReady}
            style={{
              flex: 1, padding: '10px',
              background: cameraReady ? '#4A7CC0' : '#1A2838',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 600, cursor: cameraReady ? 'pointer' : 'default',
            }}
          >
            📸 촬영
          </button>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '10px 16px',
              background: 'transparent', color: '#485870',
              border: '1px solid #1A2838', borderRadius: '8px',
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            취소
          </button>
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    )
  }

  // 미리보기 확인 화면
  if (mode === 'preview' && preview) {
    return (
      <div style={{
        border: `2px dashed ${done ? '#3D9E6A' : '#1A2838'}`,
        borderRadius: '10px',
        padding: '12px',
        background: done ? 'rgba(0,204,102,0.04)' : 'rgba(30,144,255,0.03)',
      }}>
        <img
          src={preview}
          alt="명함 미리보기"
          style={{
            width: '100%', maxHeight: '140px', objectFit: 'contain',
            borderRadius: '6px', border: '1px solid #1A2838', display: 'block',
          }}
        />

        {done ? (
          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <p style={{ fontSize: '13px', color: '#3D9E6A', fontWeight: 600 }}>✅ 정보 추출 완료 — 아래 필드를 확인하세요</p>
            <button type="button" onClick={reset} style={{
              marginTop: '6px', fontSize: '11px', color: '#485870',
              background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
            }}>다시 스캔</button>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%',
              border: '2px solid #1A2838', borderTopColor: '#4A7CC0',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: '13px', color: '#4A7CC0' }}>명함 분석 중...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => sendToOCR(preview)}
              style={{
                flex: 1, padding: '9px',
                background: '#4A7CC0', color: '#fff',
                border: 'none', borderRadius: '8px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              🔍 이 사진으로 분석
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '9px 14px',
                background: 'transparent', color: '#485870',
                border: '1px solid #1A2838', borderRadius: '8px',
                fontSize: '12px', cursor: 'pointer',
              }}
            >
              다시 찍기
            </button>
          </div>
        )}

        {error && (
          <p style={{ fontSize: '12px', color: '#C04040', marginTop: '8px', textAlign: 'center' }}>
            ⚠ {error}
          </p>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // 기본 (idle) 화면
  return (
    <div style={{
      border: '2px dashed #1A2838',
      borderRadius: '10px',
      padding: '14px',
      background: 'rgba(30,144,255,0.03)',
    }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', gap: '8px' }}>
        {/* 카메라 촬영 */}
        <button
          type="button"
          onClick={startCamera}
          style={{
            flex: 1, padding: '12px 8px',
            background: 'rgba(30,144,255,0.1)',
            border: '1px solid rgba(30,144,255,0.3)',
            borderRadius: '8px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          }}
        >
          <span style={{ fontSize: '24px' }}>📷</span>
          <span style={{ fontSize: '12px', color: '#687898', fontWeight: 500 }}>카메라 촬영</span>
          <span style={{ fontSize: '10px', color: '#485870' }}>명함 구역 자동 인식</span>
        </button>

        {/* 갤러리 / 파일 */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            flex: 1, padding: '12px 8px',
            background: 'rgba(30,144,255,0.05)',
            border: '1px solid #1A2838',
            borderRadius: '8px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          }}
        >
          <span style={{ fontSize: '24px' }}>🖼️</span>
          <span style={{ fontSize: '12px', color: '#687898', fontWeight: 500 }}>갤러리 선택</span>
          <span style={{ fontSize: '10px', color: '#485870' }}>저장된 사진 업로드</span>
        </button>
      </div>

      <p style={{ fontSize: '10px', color: '#485870', textAlign: 'center', marginTop: '8px' }}>
        AI가 명함 정보를 자동으로 입력합니다
      </p>

      {error && (
        <p style={{ fontSize: '12px', color: '#C04040', marginTop: '6px', textAlign: 'center' }}>
          ⚠ {error}
        </p>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
