import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { setupError, supabase } from '../lib/supabase'
import { createGuestSessionInitializer } from '../lib/guest-session'

const initialize = supabase ? createGuestSessionInitializer(supabase) : null
type State = { status: 'setup' | 'loading' | 'ready' | 'error'; session: Session | null; message: string }

export function useGuestSession() {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<State>({ status: setupError ? 'setup' : 'loading', session: null, message: setupError ?? '' })
  const retry = useCallback(() => setAttempt(value => value + 1), [])

  useEffect(() => {
    if (!supabase || !initialize) return
    let active = true
    setState({ status: 'loading', session: null, message: '' })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (session) setState({ status: 'ready', session, message: '' })
      else if (_event === 'SIGNED_OUT') setState({ status: 'error', session: null, message: 'Your guest session ended. Reconnect to continue.' })
    })
    initialize().then(session => {
      if (active) setState({ status: 'ready', session, message: '' })
    }).catch((error: unknown) => {
      if (active) setState({ status: 'error', session: null, message: error instanceof Error ? error.message : 'Unable to connect. Check your connection and try again.' })
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [attempt])

  return { ...state, retry }
}
