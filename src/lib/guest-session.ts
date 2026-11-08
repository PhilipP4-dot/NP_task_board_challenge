import type { Session, SupabaseClient } from '@supabase/supabase-js'

// Share an in-flight initialization across React StrictMode remounts.
export function createGuestSessionInitializer(client: SupabaseClient) {
  let pending: Promise<Session> | null = null
  return function initialize(): Promise<Session> {
    if (pending) return pending
    pending = (async () => {
      const existing = await client.auth.getSession()
      if (existing.error) throw existing.error
      if (existing.data.session) return existing.data.session
      const result = await client.auth.signInAnonymously()
      if (result.error) throw result.error
      if (!result.data.session) throw new Error('No guest session was returned. Please try again.')
      return result.data.session
    })().finally(() => { pending = null })
    return pending
  }
}
