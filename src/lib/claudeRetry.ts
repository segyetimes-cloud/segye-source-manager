/**
 * Anthropic API 지수 백오프(Exponential Backoff) 재시도 유틸리티
 *
 * Claude API는 고부하 시 429(Rate Limit) 또는 529(Overloaded)를 반환합니다.
 * 재시도 없이 실패 처리하면 명함 배치 OCR처럼 동시 호출이 많은 경우
 * 일부 장이 에러로 빠지는 현상이 발생합니다.
 *
 * 재시도 정책:
 *  - 대상 오류: 429, 529, 500-503 (클라이언트 오류 4xx는 재시도 불필요)
 *  - 최대 재시도: MAX_RETRIES회
 *  - 대기 시간: Anthropic retry-after 헤더 우선, 없으면 지수 백오프 + 무작위 지터
 *    attempt 0 → 1s + jitter
 *    attempt 1 → 2s + jitter
 *    attempt 2 → 4s + jitter
 */

import Anthropic from '@anthropic-ai/sdk'

const MAX_RETRIES  = 3
const BASE_DELAY_MS = 1_000   // 1초

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

/**
 * anthropic.messages.create를 최대 maxRetries번 재시도합니다.
 * 스트리밍이 아닌 일반 응답 전용입니다.
 */
export async function createMessageWithRetry(
  anthropic: Anthropic,
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
  maxRetries = MAX_RETRIES,
): Promise<Anthropic.Messages.Message> {
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await anthropic.messages.create(params)
    } catch (err: unknown) {
      lastError = err

      const status = (err as { status?: number })?.status
      const isRetryable =
        status === 429 ||  // Rate Limit
        status === 529 ||  // Overloaded
        (status !== undefined && status >= 500 && status <= 503)

      // 재시도 불가능한 오류거나 재시도 횟수 소진 → 즉시 throw
      if (!isRetryable || attempt >= maxRetries) throw err

      // Anthropic SDK가 retry-after 헤더를 자동으로 파싱해 err.headers에 담아줌
      const retryAfterSec = Number(
        (err as { headers?: Record<string, string> })?.headers?.['retry-after'],
      )
      const delay = retryAfterSec > 0
        ? retryAfterSec * 1_000
        : BASE_DELAY_MS * (2 ** attempt) + Math.random() * 400

      await sleep(delay)
    }
  }

  throw lastError
}
