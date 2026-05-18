# 세계일보 취재원 관리시스템 — 배포 가이드

## 1. Supabase 프로젝트 설정

### 1-1. 프로젝트 생성
1. https://supabase.com/dashboard 접속 → 새 프로젝트 생성
2. 프로젝트명: `segye-source-manager`
3. 지역: `Northeast Asia (Seoul)` 선택
4. 비밀번호 설정 후 생성

### 1-2. 스키마 실행
1. 좌측 메뉴 → **SQL Editor** 클릭
2. `supabase/migrations/001_initial_schema.sql` 전체 내용 복사 → 붙여넣기 → **Run** 실행
3. 성공 확인 (테이블 15개 생성 확인)

### 1-3. Auth 설정
1. 좌측 **Authentication** → **Providers**
2. **Email** 활성화 (기본값)
3. **Phone** 활성화 → Twilio 또는 다른 SMS 공급자 연결
   - Twilio 무료 계정: https://www.twilio.com
   - Account SID, Auth Token, From 번호 입력

### 1-4. Storage 버킷 생성
1. **Storage** → **New bucket**
2. 이름: `excel-imports`, Private 설정

### 1-5. API 키 확인
**Settings** → **API** 에서 확인:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon/public` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (절대 클라이언트 노출 금지!)

---

## 2. Anthropic API 키 발급

1. https://console.anthropic.com 접속
2. **API Keys** → **Create Key**
3. 키 복사 → `ANTHROPIC_API_KEY`

---

## 3. Vercel 배포

### 3-1. GitHub 연동 (권장)
```bash
cd segye-source-manager
git init
git add .
git commit -m "Initial commit: 세계일보 취재원 관리시스템"
git remote add origin https://github.com/YOUR_USERNAME/segye-source-manager
git push -u origin main
```

### 3-2. Vercel 배포
1. https://vercel.com/new 접속
2. GitHub 저장소 선택 → **Import**
3. **Environment Variables** 설정:

```
NEXT_PUBLIC_SUPABASE_URL        = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJxxxx...
SUPABASE_SERVICE_ROLE_KEY       = eyJxxxx...
ANTHROPIC_API_KEY               = sk-ant-xxxx...
VPN_CIDR_RANGES                 = 10.0.0.0/8        ← 사내 VPN IP 대역
EXPORT_MAX_ROWS_REPORTER        = 100
EXPORT_MAX_ROWS_ADMIN           = 500
EXPORT_MAX_ROWS_SUPERADMIN      = 2000
EXPORT_DAILY_LIMIT_REPORTER     = 3
EXPORT_DAILY_LIMIT_ADMIN        = 10
```

4. **Deploy** 클릭 → 배포 완료

---

## 4. 첫 관리자 계정 생성

### 4-1. 회원가입
1. 배포된 URL 접속 → `/login`
2. 이메일/비밀번호로 회원가입 (Supabase Auth → Sign Up)
   - 또는 Supabase Dashboard → Authentication → Users → Invite User

### 4-2. superadmin 권한 부여
Supabase SQL Editor에서 실행:
```sql
UPDATE public.profiles
SET role = 'superadmin', full_name = '홍길동', department = '편집국'
WHERE email = 'admin@segye.com';
```

### 4-3. 다른 기자 계정 생성
- Supabase Dashboard → Authentication → Users → **Invite User**
- 또는 관리자 페이지 `/admin/users`에서 초대 이메일 발송

---

## 5. VPN 설정 확인

### 사내 VPN IP 대역 확인 방법
IT 부서에 문의하여 VPN 게이트웨이 IP 대역 확인:
```
예시:
- 10.10.0.0/16 (사내망)
- 172.16.0.0/12 (VPN 게이트웨이)
```

### Vercel 환경변수 업데이트
```
VPN_CIDR_RANGES = 10.10.0.0/16,172.16.0.0/12
```

> ⚠️ 개발 환경(`NODE_ENV=development`)에서는 VPN 체크가 비활성화됩니다.

---

## 6. 보안 체크리스트

- [ ] `SUPABASE_SERVICE_ROLE_KEY`가 Vercel 환경변수에만 있는지 확인 (코드에 하드코딩 금지)
- [ ] Supabase Dashboard → RLS 정책 활성화 확인 (모든 테이블)
- [ ] VPN IP 대역 설정 확인
- [ ] Supabase Auth → Email Confirm 활성화 여부 결정
- [ ] 퇴사자 발생 시 Supabase Auth → Disable User 처리
- [ ] 월 1회 audit_logs 검토 (비정상 접근 여부)

---

## 7. 데이터 백업

Supabase Pro 플랜 이상에서 자동 백업 가능:
- Dashboard → Settings → Backups
- 일일 자동 백업 활성화

수동 백업:
```bash
# Supabase CLI 설치 후
supabase db dump --db-url postgresql://... > backup_$(date +%Y%m%d).sql
```

---

## 8. 로컬 개발

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local 편집하여 실제 값 입력

# 개발 서버 실행
npm run dev
# → http://localhost:3000
```

---

## 9. 주요 URL 구조

| URL | 설명 |
|-----|------|
| `/login` | 로그인 |
| `/otp` | 외부접속 OTP 인증 |
| `/dashboard` | 메인 대시보드 |
| `/sources` | 취재원 목록 |
| `/sources/new` | 취재원 등록 |
| `/sources/:id` | 취재원 상세 |
| `/sources/import` | 엑셀 가져오기 |
| `/network` | 관계망 그래프 |
| `/help` | 도움 요청 게시판 |
| `/admin/approvals` | 민감정보 열람 승인 |
| `/admin/users` | 계정 관리 |
| `/admin/audit` | 접근 로그 |

---

## 10. 트러블슈팅

### 로그인 안 되는 경우
- Supabase Auth → Email Confirm이 활성화되어 있으면 이메일 인증 필요
- 비활성화: Authentication → Settings → Email Confirm 토글 OFF

### OTP 안 오는 경우
- Supabase → Authentication → Providers → Phone 설정 확인
- Twilio 잔액 확인
- 개발 환경에서는 Supabase Dashboard → Authentication → Users에서 직접 OTP 확인 가능

### RLS 오류 (데이터 조회 안 됨)
- Supabase SQL Editor에서 RLS 정책 확인:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'sources';
  ```
- 정책 누락 시 `001_initial_schema.sql`의 RLS 섹션 재실행

### 엑셀 가져오기 실패
- Claude API 키 유효성 확인
- 엑셀 파일 첫 행이 헤더인지 확인
- 파일 크기 10MB 이하인지 확인
