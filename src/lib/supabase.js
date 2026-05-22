import { createClient } from '@supabase/supabase-js';

export const STORAGE_BUCKET = import.meta.env.VITE_STORAGE_BUCKET || 'dm-assets';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(
  url &&
    key &&
    !url.includes('your-project') &&
    !key.includes('your-anon-public-key')
);

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  : null;

export function publicUrl(path) {
  if (!supabase) return '';
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadFile(folder, file) {
  if (!supabase) throw new Error('Supabase 尚未完成設定');

  const ext = file.name.split('.').pop() || 'png';
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${folder}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${safeExt}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '86400',
    upsert: false,
    contentType: file.type || 'image/png'
  });

  if (error) throw error;
  return { path, url: publicUrl(path) };
}
