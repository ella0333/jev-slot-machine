/**
 * TypeSafe System One client.
 *
 * Deliberately not the published SDK. One fetch call against a documented
 * endpoint is less to install, less to break, and less to audit in a public
 * repo. Retry behaviour follows the API reference: back off on 429 and 529,
 * honour retry-after when it is present, fail fast on everything else.
 *
 * https://docs.typesafe.ai/api
 */

export const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const MODEL = 'jev-latest';

const RETRYABLE = new Set([429, 529]);
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 400;

export class JevError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'JevError';
    this.status = status;
    this.body = body;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ask Jev a batch of questions about one state.
 *
 * Everything is sent in a single request on purpose. The model ingests the
 * state once and evaluates every question against it in parallel, so a
 * speculative question that turns out to be irrelevant costs almost nothing
 * while saving a round trip when it is relevant.
 *
 * @param {object|string|Array} state
 * @param {Record<string, object>} questions
 * @returns {Promise<{model: string, answers: Record<string, object>, usage: object, latencyMs: number}>}
 */
export async function ask(state, questions, options = {}) {
  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new JevError('TYPESAFE_API_KEY is not set', 0, null);
  }

  const body = JSON.stringify({ state, model: options.model ?? MODEL, questions });
  const startedAt = Date.now();
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(options.timeoutMs ?? 20000),
      });
    } catch (cause) {
      // Network failure or timeout. Worth one more try.
      lastError = new JevError(`Request failed: ${cause.message}`, 0, null);
      if (attempt === MAX_ATTEMPTS) throw lastError;
      await sleep(backoff(attempt));
      continue;
    }

    if (response.ok) {
      const json = await response.json();
      return { ...json, latencyMs: Date.now() - startedAt };
    }

    const text = await response.text().catch(() => '');

    if (!RETRYABLE.has(response.status) || attempt === MAX_ATTEMPTS) {
      throw new JevError(
        `TypeSafe returned ${response.status}: ${text.slice(0, 500)}`,
        response.status,
        text,
      );
    }

    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
  }

  throw lastError ?? new JevError('Exhausted retries', 0, null);
}

function backoff(attempt) {
  // Exponential with jitter, so a burst of ticks does not resynchronise.
  return BASE_DELAY_MS * 2 ** (attempt - 1) * (0.75 + Math.random() * 0.5);
}

/* Question constructors. Thin, but they keep the shape honest at the call site. */

export const choice = (instructions, criteria) => ({ type: 'choice', instructions, criteria });
export const score = (instructions, criteria) => ({ type: 'score', instructions, criteria });
export const noul = (instructions, criteria) =>
  criteria ? { type: 'noul', instructions, criteria } : { type: 'noul', instructions };

/**
 * Read a Choice, falling back when the model says it is not sure.
 *
 * Confidence is the second axis the docs talk about: the answer tells you what,
 * confidence tells you whether to act on it. Below the floor we take the
 * fallback rather than pretending a coin flip was a decision.
 */
export function decide(answer, { floor = 0.5, fallback = null } = {}) {
  if (!answer || answer.type !== 'choice') return { value: fallback, confident: false, answer };
  if (answer.confidence < floor && fallback !== null) {
    return { value: fallback, confident: false, answer };
  }
  return { value: answer.choice, confident: answer.confidence >= floor, answer };
}

/** Score answers land between levels. This maps one onto a real range. */
export function scaleScore(answer, min, max) {
  if (!answer || answer.type !== 'score') return (min + max) / 2;
  const levels = Object.keys(answer.legend ?? {}).length;
  if (levels < 2) return (min + max) / 2;
  const t = Math.max(0, Math.min(1, answer.score / (levels - 1)));
  return min + t * (max - min);
}
