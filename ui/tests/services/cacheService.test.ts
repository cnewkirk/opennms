import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cached, invalidate, invalidatePrefix, _resetForTesting } from '@/services/cacheService'

beforeEach(() => {
  _resetForTesting()
})

describe('cached()', () => {
  it('calls the fetch function on first access', async () => {
    const fn = vi.fn().mockResolvedValue('hello')
    const result = await cached('key1', 60_000, fn)
    expect(result).toBe('hello')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('returns cached value within TTL without calling fetch', async () => {
    const fn = vi.fn().mockResolvedValue('hello')
    await cached('key2', 60_000, fn)
    const result = await cached('key2', 60_000, fn)
    expect(result).toBe('hello')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('re-fetches after invalidation', async () => {
    const fn = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second')
    await cached('key3', 100, fn)
    invalidate('key3')
    const result = await cached('key3', 100, fn)
    expect(result).toBe('second')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('deduplicates concurrent in-flight requests', async () => {
    let resolvePromise: (v: string) => void
    const fn = vi.fn().mockImplementation(() => new Promise(r => { resolvePromise = r }))
    const p1 = cached('key4', 60_000, fn)
    const p2 = cached('key4', 60_000, fn)
    expect(fn).toHaveBeenCalledTimes(1)
    resolvePromise!('deduped')
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe('deduped')
    expect(r2).toBe('deduped')
  })

  it('clears in-flight entry on rejection so next call retries', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('recovered')
    await expect(cached('key5', 60_000, fn)).rejects.toThrow('fail')
    const result = await cached('key5', 60_000, fn)
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('supports Infinity TTL for session-level caching', async () => {
    const fn = vi.fn().mockResolvedValue('static')
    await cached('key6', Infinity, fn)
    await cached('key6', Infinity, fn)
    await cached('key6', Infinity, fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('invalidate()', () => {
  it('forces re-fetch on next access', async () => {
    const fn = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new')
    await cached('inv1', 60_000, fn)
    invalidate('inv1')
    const result = await cached('inv1', 60_000, fn)
    expect(result).toBe('new')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('invalidatePrefix()', () => {
  it('clears all entries matching the prefix', async () => {
    const fn1 = vi.fn().mockResolvedValue('a')
    const fn2 = vi.fn().mockResolvedValue('b')
    const fn3 = vi.fn().mockResolvedValue('c')
    await cached('enlinkd:1', 60_000, fn1)
    await cached('enlinkd:2', 60_000, fn2)
    await cached('snmpIfaces:1', 60_000, fn3)

    invalidatePrefix('enlinkd:')

    await cached('enlinkd:1', 60_000, fn1)
    await cached('enlinkd:2', 60_000, fn2)
    await cached('snmpIfaces:1', 60_000, fn3)
    expect(fn1).toHaveBeenCalledTimes(2)
    expect(fn2).toHaveBeenCalledTimes(2)
    expect(fn3).toHaveBeenCalledTimes(1)
  })
})
