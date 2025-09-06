import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'

// This is a browser client, safe to use in components
export const supabase = createPagesBrowserClient()
