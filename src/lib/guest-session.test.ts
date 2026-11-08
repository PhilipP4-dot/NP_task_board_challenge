import { describe, expect, it, vi } from 'vitest'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createGuestSessionInitializer } from './guest-session'

const session = { user: { id: 'guest-123' } } as Session
function mockClient(existing: Session | null = null) {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: existing }, error: null }),
    signInAnonymously: vi.fn().mockResolvedValue({ data: { session }, error: null }),
  }
  return { auth, client: { auth } as unknown as SupabaseClient }
}

describe('guest session initialization', () => {
  it('restores an existing session without creating another guest', async () => {
    const { auth, client } = mockClient(session)
    expect(await createGuestSessionInitializer(client)()).toBe(session)
    expect(auth.signInAnonymously).not.toHaveBeenCalled()
  })

  it('shares simultaneous initialization to avoid duplicate guest accounts', async () => {
    const { auth, client } = mockClient()
    const initialize = createGuestSessionInitializer(client)
    const [first, second] = await Promise.all([initialize(), initialize()])
    expect(first).toBe(session)
    expect(second).toBe(session)
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1)
  })

  it('surfaces sign-in failure and allows a later retry', async () => {
    const { auth, client } = mockClient()
    auth.signInAnonymously.mockResolvedValueOnce({ data: { session: null }, error: new Error('Anonymous sign-ins disabled') })
    const initialize = createGuestSessionInitializer(client)
    await expect(initialize()).rejects.toThrow('Anonymous sign-ins disabled')
    await expect(initialize()).resolves.toBe(session)
  })

  it('does not create a replacement guest if restoring the session fails', async () => {
    const { auth, client } = mockClient()
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: new Error('Storage unavailable') })
    await expect(createGuestSessionInitializer(client)()).rejects.toThrow('Storage unavailable')
    expect(auth.signInAnonymously).not.toHaveBeenCalled()
  })
})
