/**
 * Read-only queries the anon client is allowed to run (RLS-permitted). Kept inside
 * lib/transport so the Supabase SDK stays encapsulated here.
 */

import { getSupabaseBrowser } from "@/lib/transport/browser-client";

export interface PlaylistSummary {
  id: string;
  name: string;
  theme: string | null;
}

export async function fetchPlaylists(): Promise<PlaylistSummary[]> {
  const { data, error } = await getSupabaseBrowser()
    .from("playlists")
    .select("id, name, theme")
    .order("name");
  if (error) throw error;
  return (data as PlaylistSummary[]) ?? [];
}
