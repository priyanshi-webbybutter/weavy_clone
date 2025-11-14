import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fcvklxgzvqqzexywrmry.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjdmtseGd6dnFxemV4eXdybXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMTQ1OTUsImV4cCI6MjA3ODY5MDU5NX0.nTNpalvuaIQPBoV3mAUP14Ip9wLoOFUYtGoDHpx4Br8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

