import { createBrowserClient } from '@supabase/ssr'

// This is a browser client, safe to use in components
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)