import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wymlckdkrwdxyexrxxka.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bWxja2RrcndkeHlleHJ4eGthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MTY3ODEsImV4cCI6MjEwMDA5Mjc4MX0.w62ZvKcltz1f6qUx2s2dD0l7wJGnyR-a-iUigGk_zpk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
