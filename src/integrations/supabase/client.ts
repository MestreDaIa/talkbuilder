import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://fwoescubnnagdvwasbjl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3b2VzY3Vibm5hZ2R2d2FzYmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NzA1OTYsImV4cCI6MjA5MjU0NjU5Nn0.IetF2dz-c_D8gY_KWkhTXBO3wuQz4fm4h_kAhfUOxJA";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});