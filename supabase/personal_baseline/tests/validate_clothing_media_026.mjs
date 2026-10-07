import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('supabase/personal_baseline/026_clothing_media_lifecycle.sql');
const sql = fs.readFileSync(file, 'utf8');
const required = [
  "'ootie-closet-media'",
  'public = false',
  'photo_original_path',
  'photo_display_path',
  'photo_processing_status',
  'FOR SELECT TO authenticated',
  'FOR INSERT TO authenticated',
  'FOR UPDATE TO authenticated',
  'FOR DELETE TO authenticated',
  "(storage.foldername(name))[2] = (SELECT auth.uid())::text",
  'SECURITY INVOKER',
  'ootie_clothing_delete_reference_guard'
];

for (const token of required) {
  if (!sql.includes(token)) throw new Error(`026 missing required contract: ${token}`);
}
if (/auth\.role\s*\(/i.test(sql)) throw new Error('026 must not use deprecated auth.role() policies');
if (/SECURITY\s+DEFINER/i.test(sql)) throw new Error('026 must not introduce SECURITY DEFINER');

console.log('PASS migration 026 clothing media lifecycle validation');
