import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(process.cwd(), 'supabase/personal_baseline/014_saved_outfits_metrics.sql');

describe('014 saved outfits migration contract', () => {
  it('defines a profile-owned generic OOTD/SOS save with duplicate prevention and owner-only RLS', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toMatch(/CREATE TABLE public\.ootie_saved_outfits/i);
    expect(sql).toMatch(/profile_id uuid NOT NULL/i);
    expect(sql).toMatch(/target_type text NOT NULL/i);
    expect(sql).toMatch(/CHECK \(target_type IN \('OOTD', 'SOS'\)\)/i);
    expect(sql).toMatch(/UNIQUE \(profile_id, target_type, target_id\)/i);
    expect(sql).toMatch(/REFERENCES public\.ootie_profiles\(id\) ON DELETE CASCADE/i);
    expect(sql).toMatch(/CREATE INDEX ootie_saved_outfits_profile_created_idx/i);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.ootie_saved_outfits FROM anon, authenticated/i);
    expect(sql).toMatch(/GRANT SELECT, INSERT, DELETE ON TABLE public\.ootie_saved_outfits TO authenticated/i);
    expect(sql).not.toMatch(/FOR UPDATE TO authenticated/i);
    expect(sql).toMatch(/FOR INSERT[\s\S]*WITH CHECK/i);
    expect(sql).toMatch(/FOR DELETE[\s\S]*USING/i);
    expect(sql).toMatch(/CREATE FUNCTION public\.validate_ootie_saved_outfit_target\(\)/i);
    expect(sql).toMatch(/FROM public\.ootie_ootd_posts/i);
    expect(sql).toMatch(/FROM public\.ootie_sos_posts/i);
    expect(sql).toMatch(/CREATE TRIGGER trg_validate_ootie_saved_outfit_target/i);
    expect(sql).toMatch(/INSERT INTO public\.ootie_saved_outfits[\s\S]*FROM public\.ootie_saved_posts AS saved_post[\s\S]*JOIN public\.ootie_ootd_posts AS ootd_post[\s\S]*ON CONFLICT \(profile_id, target_type, target_id\) DO NOTHING/i);
    expect(sql).toMatch(/COALESCE\(saved_post\.created_at, now\(\)\)/i);
    expect(sql).not.toMatch(/DROP TABLE public\.ootie_saved_posts/i);
    expect(sql).not.toMatch(/DELETE FROM public\.ootie_saved_posts/i);
    expect(sql).not.toMatch(/CREATE TABLE public\.ootie_bookmarks/i);
  });
});
