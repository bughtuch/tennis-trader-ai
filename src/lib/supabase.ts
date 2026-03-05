import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (typeof window !== "undefined" && (!supabaseUrl || !supabaseKey)) {
    console.error(
      "[Supabase] Missing env vars:",
      { url: !!supabaseUrl, key: !!supabaseKey }
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        apikey: supabaseKey,
      },
    },
  });
}
