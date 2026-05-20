# 취재원 관리시스템 — 백업 & 복구 런북

> 최종 수정: 2026-05-20  
> 관리자: 세계일보 시스템팀  
> 대상 환경: Supabase (PostgreSQL 15, Cloud)

---

## 1. 백업 전략 개요

| 레이어 | 방법 | 주기 | 보존 기간 |
|--------|------|------|----------|
| **DB 자동 백업** | Supabase 내장 PITR (Point-in-Time Recovery) | 연속 | Pro: 7일, Team: 14일 |
| **수동 스냅샷** | pg_dump → AWS S3 / NAS | 매일 02:00 KST | 90일 |
| **앱 소프트 딜리트** | `is_deleted = true` (물리 삭제 없음) | 즉시 | 영구 |
| **감사 로그** | `audit_logs` (삭제·수정 불가 트리거) | 즉시 | 영구 |

---

## 2. Supabase PITR (자동 복구)

### 2-1. 특정 시점으로 복구

```bash
# Supabase CLI 사용 (프로젝트 ref: <YOUR_PROJECT_REF>)
supabase db restore --project-ref <REF> --target-time "2026-05-20T14:00:00Z"
```

또는 **Supabase Dashboard → Settings → Database → Restore**에서 날짜/시간 선택.

### 2-2. PITR 활성화 확인

```sql
-- Supabase SQL Editor에서 실행
SELECT pg_is_in_recovery();  -- f (primary) = 정상
SELECT pg_last_xact_replay_timestamp();  -- 마지막 복제 시간
```

---

## 3. 수동 pg_dump 백업 스크립트

### scripts/backup.sh

```bash
#!/bin/bash
set -euo pipefail

# ─── 환경 변수 ────────────────────────────────────────────────────────────
DB_URL="${DATABASE_URL}"           # postgresql://user:pass@host:5432/dbname
BACKUP_DIR="/backup/segye-source"
RETENTION_DAYS=90
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="backup_${TIMESTAMP}.sql.gz"

# ─── 디렉터리 생성 ─────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ─── 덤프 실행 ─────────────────────────────────────────────────────────────
echo "[$(date)] 백업 시작: $FILENAME"
pg_dump "$DB_URL" \
  --format=plain \
  --no-owner \
  --no-acl \
  --exclude-table-data='audit_logs'  \  # audit_logs는 별도 보관 (용량 절약)
  | gzip > "$BACKUP_DIR/$FILENAME"

# audit_logs 별도 덤프 (감사 불변 기록)
AUDIT_FILE="audit_logs_${TIMESTAMP}.sql.gz"
pg_dump "$DB_URL" \
  --format=plain \
  --table=public.audit_logs \
  | gzip > "$BACKUP_DIR/$AUDIT_FILE"

# ─── S3 업로드 (선택사항) ──────────────────────────────────────────────────
# aws s3 cp "$BACKUP_DIR/$FILENAME" "s3://segye-backup/db/$FILENAME"

# ─── 오래된 백업 정리 ──────────────────────────────────────────────────────
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete
echo "[$(date)] 백업 완료: $FILENAME"
```

```bash
# 매일 02:00 KST 자동 실행 (crontab -e)
0 17 * * * /scripts/backup.sh >> /var/log/segye-backup.log 2>&1
```

---

## 4. 복구 시나리오

### 시나리오 A: 실수로 취재원 삭제

```sql
-- 소프트 딜리트된 취재원 복구
UPDATE public.sources
SET is_deleted = false, updated_at = NOW()
WHERE id = '<SOURCE_UUID>';

-- 감사 로그에서 삭제 기록 확인
SELECT user_email, action, created_at, metadata
FROM audit_logs
WHERE resource_type = 'source'
  AND resource_id = '<SOURCE_UUID>'
  AND action = 'delete'
ORDER BY created_at DESC
LIMIT 5;
```

### 시나리오 B: DB 전체 장애 (Supabase PITR 사용)

1. **Supabase Dashboard** → Settings → Database → Restore to Point in Time
2. 장애 발생 시각 직전 시간 선택
3. 복구 완료 후 애플리케이션 재연결 확인

```bash
# 복구 후 연결 확인
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM sources WHERE is_deleted = false;"
```

### 시나리오 C: pg_dump 파일로 복구

```bash
# 1. 백업 파일 선택
ls -lt /backup/segye-source/backup_*.sql.gz | head -5

# 2. 새 DB에 복구
createdb segye_restore
gunzip -c /backup/segye-source/backup_20260520_020000.sql.gz | psql segye_restore

# 3. 특정 테이블만 복구 (운영 DB에 신중하게)
pg_restore --data-only --table=sources -d "$DATABASE_URL" /tmp/sources_dump
```

### 시나리오 D: 감사 로그 위변조 탐지

```sql
-- audit_logs 불변성 트리거 동작 확인
-- 아래 쿼리는 항상 오류를 발생시켜야 함
UPDATE audit_logs SET action = 'tampered' WHERE id = 1;
-- ERROR: audit_logs는 삭제하거나 수정할 수 없습니다 (불변 감사 기록)

-- audit_logs 행수 추이로 누락 여부 확인
SELECT DATE(created_at) AS day, COUNT(*) AS cnt
FROM audit_logs
GROUP BY day
ORDER BY day DESC
LIMIT 30;
```

---

## 5. RTO / RPO 목표

| 지표 | 목표 | 달성 방법 |
|------|------|----------|
| **RPO** (데이터 손실 허용) | < 1시간 | Supabase PITR (연속 WAL 스트리밍) |
| **RTO** (서비스 복구 시간) | < 4시간 | Supabase PITR + 절차 문서화 |
| 개별 취재원 복구 | < 5분 | 소프트 딜리트 → UPDATE 1줄 |

---

## 6. 복구 후 체크리스트

```
□ 취재원 수 확인: SELECT COUNT(*) FROM sources WHERE is_deleted = false
□ 감사 로그 수 확인: SELECT COUNT(*) FROM audit_logs
□ 북마크 정합성: SELECT COUNT(*) FROM source_bookmarks
□ 사용자 계정 정상 확인: SELECT COUNT(*) FROM profiles WHERE is_active = true
□ RLS 정책 활성화 확인: SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'
□ 트리거 활성화 확인: SELECT tgname, tgenabled FROM pg_trigger WHERE tgname LIKE 'audit_%'
□ 애플리케이션 로그인 테스트 (테스트 계정)
□ 감사 로그 INSERT 테스트 (감사 기록 정상 동작)
```

---

## 7. 담당자 연락처 및 에스컬레이션

| 단계 | 담당자 | 연락 |
|------|--------|------|
| 1차 | IT 인프라팀 | 내선 XXXX |
| 2차 | Supabase Support | support@supabase.io (Pro 티켓) |
| 3차 | CTO | 비상 연락망 |

---

> **주의**: 복구 작업 전 반드시 현재 상태의 스냅샷을 먼저 생성하세요.  
> `pg_dump "$DATABASE_URL" | gzip > /tmp/pre_restore_$(date +%s).sql.gz`
