import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function configurationError(): string | null {
  if (!url || !key) return 'Add your Supabase project URL and public anon key to .env.local, then restart the app.'
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol')
  } catch {
    return 'The Supabase project URL must be a valid HTTP or HTTPS address. Update .env.local and restart the app.'
  }
  return null
}

export const setupError = configurationError()
export const supabase = setupError ? null : createClient(url!, key!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})
