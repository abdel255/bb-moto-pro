import { createClient } from '@supabase/supabase-js'

// ⚠️ REPLACE THESE WITH YOUR OWN VALUES FROM SUPABASE DASHBOARD
// Go to: Project Settings → API → Copy "Project URL" and "anon public" key
const SUPABASE_URL = 'https://ysihfkrkqwyhahejbwzf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzaWhma3JrcXd5aGFoZWpid3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDk1NDcsImV4cCI6MjA5MDkyNTU0N30.OXoYLIz_tkkDzTPsIrNoUtpipeOfD4p2M-DP2MQmo6A'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
