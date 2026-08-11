import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ModelRequest } from '../../src/llm/adapters/types'

export type CacheEntry = { reply: string; latencyMs: number }

export function cacheKey(
  model: string,
  request: ModelRequest,
  sampling: { temperature: number; maxTokens: number },
): string {
  return createHash('sha256')
    .update(JSON.stringify({ model, request, sampling }))
    .digest('hex')
}

export class ResponseCache {
  private entries = new Map<string, CacheEntry>()

  constructor(private filePath: string) {
    if (!existsSync(filePath)) return
    for (const line of readFileSync(filePath, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const { key, reply, latencyMs } = JSON.parse(line) as {
          key: string
          reply: string
          latencyMs: number
        }
        this.entries.set(key, { reply, latencyMs })
      } catch {
        // torn last line from an interrupted run — safe to ignore
      }
    }
  }

  get(key: string): CacheEntry | undefined {
    return this.entries.get(key)
  }

  put(key: string, entry: CacheEntry): void {
    this.entries.set(key, entry)
    mkdirSync(dirname(this.filePath), { recursive: true })
    appendFileSync(this.filePath, `${JSON.stringify({ key, ...entry })}\n`)
  }
}
