'use client'

import { useRef, useState, useEffect } from 'react'

interface ContactData {
  full_name: string | null
  name_en: string | null
  current_organization: string | null
  current_position: string | null
  department: string | null
  phone: string | null
  office_phone: string | null
  email: string | null
  address: string | null
  website: string | null
  [key: string]: string | null | undefined
}

interface Props {
  onImported: (data: { [key: string]: string | null | undefined }) => void
}

// 단일 VCARD 블록 파싱
function parseOneVCard(block: string): ContactData {
  const get = (pattern: RegExp) => {
    const m = block.match(pattern)
    return m?.[1]?.trim().replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/=\r?\n/g, '') ?? null
  }

  const phones = [...block.matchAll(/TEL[^:]*:([0-9+\-\s().]+)/gi)].map(m => m[1].trim())
  let phone: string | null = null
  let office_phone: string | null = null
  for (const p of phones) {
    const cleaned = p.replace(/[-.\s()]/g, '')
    if (/^01[016789]/.test(cleaned)) { if (!phone) phone = p }
    else { if (!office_phone) office_phone = p }
  }

  const adr = get(/ADR[^:]*:([^\r\n]+)/i)
  const address = adr ? adr.split(';').filter(Boolean).join(' ') : null

  const orgRaw = get(/ORG:([^\r\n]+)/i)
  const orgParts = orgRaw?.split(';') ?? []

  return {
    full_name:            get(/FN:([^\r\n]+)/i),
    name_en:              null,
    current_organization: orgParts[0]?.trim() || null,
    current_position:     get(/TITLE:([^\r\n]+)/i),
    department:           orgParts[1]?.trim() || null,
    phone,
    office_phone,
    email:                get(/EMAIL[^:]*:([^\r\n]+)/i)?.toLowerCase() ?? null,
    address,
    website:              get(/URL:([^\r\n]+)/i),
  }
}

// .vcf 파일에서 모든 VCARD 파싱
function parseAllVCards(text: string): ContactData[] {
  const blocks = text.match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi) ?? []
  return blocks.map(parseOneVCard).filter(c => c.full_name)
}

export default function ContactImporter({ onImported }: Props) {
  const vcfRef = useRef<HTMLInputElement>(null)
  const [hasPickerApi, setHasPickerApi] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [contactName, setContactName] = useState('')
  const [candidates, setCandidates] = useState<ContactData[]>([]) // 여러 명 선택 UI
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setHasPickerApi(
      typeof navigator !== 'undefined' &&
      'contacts' in navigator &&
      typeof (navigator as any).contacts?.select === 'function'
    )
  }, [])

  // ── Contact Picker API ────────────────────────────────────────────────────
  async function pickFromContacts() {
    setError('')
    try {
      const contactsApi = (navigator as any).contacts
      const wantedFields = ['name', 'email', 'tel', 'address', 'organization']
      let requestFields = wantedFields
      if (typeof contactsApi.getProperties === 'function') {
        const supported: string[] = await contactsApi.getProperties()
        requestFields = wantedFields.filter(f => supported.includes(f))
      }

      const contacts: any[] = await contactsApi.select(requestFields, { multiple: false })
      if (!contacts.length) return
      const c = contacts[0]

      let address: string | null = null
      if (c.address?.length) {
        const a = c.address[0]
        address = [a.addressLine?.join(' '), a.city, a.region].filter(Boolean).join(' ') || null
      }

      const phones: string[] = c.tel ?? []
      let phone: string | null = null
      let office_phone: string | null = null
      for (const p of phones) {
        const cleaned = p.replace(/[-.\s()]/g, '')
        if (/^01[016789]/.test(cleaned)) { if (!phone) phone = p }
        else { if (!office_phone) office_phone = p }
      }

      const data: ContactData = {
        full_name: c.name?.[0] ?? null,
        name_en: null,
        current_organization: c.organization?.[0] ?? null,
        current_position: null,
        department: null,
        phone,
        office_phone,
        email: c.email?.[0]?.toLowerCase() ?? null,
        address,
        website: null,
      }
      applyContact(data)
    } catch (e: any) {
      if (e.name === 'AbortError') return
      setError('직접 연결이 지원되지 않는 브라우저입니다. 파일로 가져와주세요.')
    }
  }

  // ── vCard 파일 처리 ────────────────────────────────────────────────────────
  function handleVcf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string
        const all = parseAllVCards(text)
        if (all.length === 0) {
          setError('연락처를 찾지 못했습니다. 올바른 .vcf 파일인지 확인해주세요.')
        } else if (all.length === 1) {
          applyContact(all[0])
        } else {
          // 여러 명 → 선택 UI 표시
          setCandidates(all)
          setSearchQuery('')
        }
      } catch {
        setError('파일을 읽지 못했습니다.')
      }
    }
    reader.readAsText(file, 'UTF-8')
    if (vcfRef.current) vcfRef.current.value = ''
  }

  function applyContact(data: ContactData) {
    onImported(data)
    setContactName(data.full_name ?? '연락처')
    setCandidates([])
    setDone(true)
  }

  function reset() {
    setDone(false)
    setContactName('')
    setCandidates([])
    setError('')
    setSearchQuery('')
  }

  // ── 여러 연락처 선택 UI ───────────────────────────────────────────────────
  if (candidates.length > 0) {
    const filtered = searchQuery.trim()
      ? candidates.filter(c =>
          c.full_name?.includes(searchQuery) ||
          c.current_organization?.includes(searchQuery) ||
          c.phone?.includes(searchQuery)
        )
      : candidates

    return (
      <div style={{
        border: '2px solid #1A2838', borderRadius: '10px',
        background: '#111A28', overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '10px 14px', background: 'rgba(30,144,255,0.08)',
          borderBottom: '1px solid #1A2838',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#8AAAC8' }}>
            📋 {candidates.length}명 검색됨 — 등록할 연락처를 선택하세요
          </p>
          <button type="button" onClick={reset}
            style={{ fontSize: '12px', color: '#607898', background: 'none', border: 'none', cursor: 'pointer' }}>
            취소
          </button>
        </div>

        {/* 검색 */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #1A2838' }}>
          <input
            type="text"
            placeholder="이름·소속·전화번호 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px',
              background: '#1A2838', border: '1px solid #202C3A',
              borderRadius: '6px', color: '#DCE8F4', fontSize: '13px',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* 목록 */}
        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <p style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#607898' }}>
              검색 결과 없음
            </p>
          ) : filtered.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applyContact(c)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 14px',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: '1px solid rgba(26,48,80,0.6)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,144,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(30,144,255,0.2)', border: '1px solid rgba(30,144,255,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', color: '#4A7CC0', fontWeight: 700,
                }}>
                  {c.full_name?.[0] ?? '?'}
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#DCE8F4', margin: 0 }}>
                    {c.full_name}
                    {c.current_position && (
                      <span style={{ marginLeft: '6px', fontSize: '11px', color: '#607898', fontWeight: 400 }}>
                        {c.current_position}
                      </span>
                    )}
                  </p>
                  <p style={{ fontSize: '11px', color: '#607898', margin: 0 }}>
                    {[c.current_organization, c.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── 완료 상태 ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{
        border: '2px dashed #3D9E6A', borderRadius: '10px',
        padding: '12px 16px', background: 'rgba(0,204,102,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>✅</span>
          <div>
            <p style={{ fontSize: '13px', color: '#3D9E6A', fontWeight: 600 }}>
              {contactName} 연락처 불러오기 완료
            </p>
            <p style={{ fontSize: '11px', color: '#607898' }}>아래 필드를 확인하세요</p>
          </div>
        </div>
        <button type="button" onClick={reset} style={{
          fontSize: '11px', color: '#607898', background: 'none',
          border: 'none', cursor: 'pointer', textDecoration: 'underline',
        }}>
          다시 가져오기
        </button>
      </div>
    )
  }

  // ── 기본 UI ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      border: '2px dashed #1A2838', borderRadius: '10px',
      padding: '12px', background: 'rgba(30,144,255,0.02)',
    }}>
      <input
        ref={vcfRef}
        type="file"
        accept=".vcf,text/vcard"
        onChange={handleVcf}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', gap: '8px' }}>
        {hasPickerApi && (
          <button type="button" onClick={pickFromContacts} style={{
            flex: 1, padding: '12px 8px',
            background: 'rgba(0,204,102,0.1)',
            border: '1px solid rgba(0,204,102,0.3)',
            borderRadius: '8px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          }}>
            <span style={{ fontSize: '22px' }}>👤</span>
            <span style={{ fontSize: '12px', color: '#8AAAC8', fontWeight: 500 }}>전화번호부에서</span>
            <span style={{ fontSize: '10px', color: '#607898' }}>연락처 바로 선택</span>
          </button>
        )}

        <button type="button" onClick={() => vcfRef.current?.click()} style={{
          flex: 1, padding: '12px 8px',
          background: 'rgba(30,144,255,0.05)',
          border: '1px solid #1A2838',
          borderRadius: '8px', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
        }}>
          <span style={{ fontSize: '22px' }}>📂</span>
          <span style={{ fontSize: '12px', color: '#8AAAC8', fontWeight: 500 }}>연락처 파일(.vcf)</span>
          <span style={{ fontSize: '10px', color: '#607898' }}>1명 또는 전체 내보내기 후 업로드</span>
        </button>
      </div>

      {/* iOS 안내 */}
      <details style={{ marginTop: '8px' }}>
        <summary style={{ fontSize: '11px', color: '#607898', cursor: 'pointer' }}>
          📱 연락처 파일 내보내는 방법
        </summary>
        <div style={{
          marginTop: '6px', padding: '8px 10px',
          background: 'rgba(255,255,255,0.03)', borderRadius: '6px',
          fontSize: '11px', color: '#607898', lineHeight: '1.8',
        }}>
          <strong style={{ color: '#8AAAC8' }}>iPhone:</strong> 연락처 앱 → 해당 연락처 열기 → 하단 <strong style={{ color: '#8AAAC8' }}>연락처 공유</strong> → 파일로 저장 → 업로드<br />
          <strong style={{ color: '#8AAAC8' }}>Android:</strong> 연락처 앱 → 해당 연락처 열기 → ⋮ 메뉴 → <strong style={{ color: '#8AAAC8' }}>공유</strong> → .vcf 파일 → 업로드<br />
          <span style={{ color: '#384860' }}>※ 전체 연락처를 업로드해도 여기서 한 명씩 선택할 수 있습니다</span>
        </div>
      </details>

      {error && (
        <div style={{
          marginTop: '8px', padding: '8px 12px',
          background: 'rgba(255,68,68,0.08)', borderRadius: '8px',
          border: '1px solid rgba(255,68,68,0.2)',
        }}>
          <p style={{ fontSize: '12px', color: '#C07070', marginBottom: '4px' }}>⚠ {error}</p>
          <button type="button" onClick={() => vcfRef.current?.click()} style={{
            fontSize: '12px', color: '#4A7CC0', background: 'none',
            border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0,
          }}>
            📂 파일로 가져오기
          </button>
        </div>
      )}
    </div>
  )
}
