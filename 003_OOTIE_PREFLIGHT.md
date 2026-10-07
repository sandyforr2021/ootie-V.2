# 003 ootie_clothing_items preflight

Status: `003_READY_NEW` for a future manual execution review. This document does not execute SQL and does not authorize 004–012.

## Reviewed source

- Execution source: `supabase/personal_baseline/003_ootie_clothing_items.sql`
- Current SHA-256: `C9E8C0A7C435FABF15F23159304F9B6D23147A5ED8E0635CF0A03668D829C170`
- Invalidated SHA-256: `39F294B4D2FB80691D6F18A4AFEAA3D2D03C0FDE0B9361430101DA38314CDB33`
- Evidence: `TEAM_SUPABASE_SCHEMA_SNAPSHOT.csv.csv`, `TEAM_SUPABASE_SCHEMA_EXTRA.csv.csv`, `SUPABASE_SCHEMA_04_COMPARISON.md`, `SUPABASE_PERSONAL_MIGRATION_BLUEPRINT.md`, and `TABLE_SCHEMA_REQUIREMENTS.md`

The old hash is permanently invalid because that version allowed a nullable `owner_id` with `DEFAULT gen_random_uuid()`.

## Migration content and evidence classification

003 creates only `public.ootie_clothing_items`.

| Column | PostgreSQL type | Nullable | Default | Evidence status |
| --- | --- | --- | --- | --- |
| `brand` | `text` | YES | none | `CONFIRMED` |
| `category` | `text` | YES | none | `CONFIRMED` |
| `color_hex` | `text` | YES | none | `CONFIRMED` |
| `created_at` | `timestamp with time zone` | YES | none | `CONFIRMED` |
| `favorite` | `boolean` | YES | none | `CONFIRMED` |
| `hidden` | `boolean` | YES | none | `CONFIRMED` |
| `id` | `uuid` | NO | `gen_random_uuid()` | `CONFIRMED` |
| `last_worn` | `text` | YES | none | `CONFIRMED` |
| `name` | `text` | YES | none | `CONFIRMED` |
| `name_zh` | `text` | YES | none | `CONFIRMED` |
| `notes` | `text` | YES | none | `CONFIRMED` |
| `owner_id` | `uuid` | NO | none | `PERSONAL_FIX` |
| `photo` | `text` | YES | none | `CONFIRMED` |
| `price` | `bigint` | YES | none | `CONFIRMED` |
| `primary_color` | `text` | YES | none | `CONFIRMED` |
| `purchase_date` | `text` | YES | none | `CONFIRMED` |
| `season` | `text` | YES | none | `CONFIRMED` |
| `secondary_color` | `text` | YES | none | `CONFIRMED` |
| `shape` | `text` | YES | none | `CONFIRMED` |
| `style` | `text` | YES | none | `CONFIRMED` |
| `wear_count` | `bigint` | YES | none | `CONFIRMED` |

Team evidence is retained as: `owner_id uuid`, nullable, `DEFAULT gen_random_uuid()`. The personal baseline deliberately changes only its nullability and default. This is a `PERSONAL_FIX`, not a claim about the original team schema.

| Element | Definition | Status |
| --- | --- | --- |
| Primary key | `ootie_clothing_items_pkey PRIMARY KEY (id)` | `CONFIRMED` |
| Foreign key | `ootie_clothing_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.ootie_profiles(id) ON DELETE NO ACTION` | FK target `CONFIRMED`; explicit default delete action preserved |
| Explicit UNIQUE / CHECK / index | none | `CONFIRMED` |
| Implicit index | PK creates `public.ootie_clothing_items_pkey` | `CONFIRMED` |
| Function / trigger / policy | none | confirmed from 003 source |
| RLS | neither enabled nor forced by 003 | team snapshot state preserved until 011 |
| GRANT | none | confirmed from 003 source |

Identity chain:

`auth.users.id -> ootie_profiles.user_id -> ootie_profiles.id -> ootie_clothing_items.owner_id`

003 never references `auth.users`. An application insert must resolve the signed-in user's `ootie_profiles.id` and explicitly provide it as `owner_id`. The contract is documented in `CLOTHING_OWNERSHIP_CONTRACT.md`.

## Destructive-operation and dependency review

- No `DROP`, `DELETE`, `TRUNCATE`, `UPDATE`, `INSERT`, `CASCADE`, `REPLACE`, or `ALTER` appears in executable 003 SQL.
- It creates one OOTIE table inside its own transaction and does not alter an existing non-OOTIE object.
- 001 must already have passed so `gen_random_uuid()` is available for item `id` only.
- 002 must already have passed and `public.ootie_profiles(id)` must remain a UUID primary key.
- It has no dependency on a later OOTIE table.
- Possible relation, row-type, and primary-key index name collisions are checked immediately before execution.

## A. BEFORE CHECK

Run only in the manually verified `OOTIE-sandy-dev` SQL Editor. This is pure `SELECT`.

```sql
WITH checks AS (
  SELECT '01_public_schema_exists'::text AS check_name,
         to_regnamespace('public') IS NOT NULL AS passed
  UNION ALL
  SELECT '02_clothing_relation_name_available',
         to_regclass('public.ootie_clothing_items') IS NULL
  UNION ALL
  SELECT '03_clothing_row_type_name_available',
         to_regtype('public.ootie_clothing_items') IS NULL
  UNION ALL
  SELECT '04_clothing_pkey_index_name_available',
         to_regclass('public.ootie_clothing_items_pkey') IS NULL
  UNION ALL
  SELECT '05_profiles_table_exists',
         to_regclass('public.ootie_profiles') IS NOT NULL
  UNION ALL
  SELECT '06_profiles_id_is_uuid_not_null_primary_key',
         EXISTS (
           SELECT 1
           FROM pg_catalog.pg_attribute a
           JOIN pg_catalog.pg_constraint c
             ON c.conrelid = a.attrelid
            AND c.contype = 'p'
            AND c.conkey = ARRAY[a.attnum]::smallint[]
           WHERE a.attrelid = to_regclass('public.ootie_profiles')
             AND a.attname = 'id'
             AND a.atttypid = 'uuid'::regtype
             AND a.attnotnull
         )
  UNION ALL
  SELECT '07_profiles_auth_bridge_is_exact',
         (
           EXISTS (
             SELECT 1
             FROM pg_catalog.pg_attribute a
             LEFT JOIN pg_catalog.pg_attrdef d
               ON d.adrelid = a.attrelid AND d.adnum = a.attnum
             WHERE a.attrelid = to_regclass('public.ootie_profiles')
               AND a.attname = 'user_id'
               AND a.atttypid = 'uuid'::regtype
               AND a.attnotnull
               AND d.oid IS NULL
           )
           AND EXISTS (
             SELECT 1
             FROM pg_catalog.pg_constraint c
             JOIN pg_catalog.pg_attribute a
               ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
             WHERE c.conrelid = to_regclass('public.ootie_profiles')
               AND c.contype = 'u'
               AND cardinality(c.conkey) = 1
               AND a.attname = 'user_id'
           )
           AND EXISTS (
             SELECT 1
             FROM pg_catalog.pg_constraint c
             JOIN pg_catalog.pg_attribute local_a
               ON local_a.attrelid = c.conrelid AND local_a.attnum = c.conkey[1]
             JOIN pg_catalog.pg_class ref_c ON ref_c.oid = c.confrelid
             JOIN pg_catalog.pg_namespace ref_n ON ref_n.oid = ref_c.relnamespace
             JOIN pg_catalog.pg_attribute ref_a
               ON ref_a.attrelid = c.confrelid AND ref_a.attnum = c.confkey[1]
             WHERE c.conrelid = to_regclass('public.ootie_profiles')
               AND c.contype = 'f'
               AND cardinality(c.conkey) = 1
               AND local_a.attname = 'user_id'
               AND ref_n.nspname = 'auth'
               AND ref_c.relname = 'users'
               AND ref_a.attname = 'id'
               AND c.confdeltype = 'a'
           )
         )
  UNION ALL
  SELECT '08_gen_random_uuid_available',
         to_regprocedure('gen_random_uuid()') IS NOT NULL
)
SELECT check_name, passed
FROM checks
ORDER BY check_name;
```

Required result: exactly 8 rows and `8/8 true`.

## B. EXECUTION SOURCE

Execute only the complete, unchanged file:

`supabase/personal_baseline/003_ootie_clothing_items.sql`

Required SHA-256 immediately before execution:

`C9E8C0A7C435FABF15F23159304F9B6D23147A5ED8E0635CF0A03668D829C170`

Do not copy or reconstruct execution SQL from this preflight document. Do not use `supabase/migrations/`.

## C. AFTER CHECK

### C1. Table, seed, RLS, policy, and trigger state

```sql
SELECT
  c.relkind = 'r' AS ordinary_table_exists,
  to_regtype('public.ootie_clothing_items') IS NOT NULL AS row_type_exists,
  NOT c.relrowsecurity AS rls_disabled,
  NOT c.relforcerowsecurity AS forced_rls_disabled,
  NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'ootie_clothing_items'
  ) AS no_policies_yet,
  NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = c.oid AND NOT t.tgisinternal
  ) AS no_user_triggers,
  (SELECT count(*) FROM public.ootie_clothing_items) AS seeded_rows
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'ootie_clothing_items';
```

Expected: one row; all six booleans are `true`; `seeded_rows = 0`.

### C2. Exact 21 columns

```sql
WITH expected (column_name, data_type, is_nullable, default_expr) AS (
  VALUES
    ('brand',           'text',                     true,  NULL::text),
    ('category',        'text',                     true,  NULL::text),
    ('color_hex',       'text',                     true,  NULL::text),
    ('created_at',      'timestamp with time zone', true,  NULL::text),
    ('favorite',        'boolean',                  true,  NULL::text),
    ('hidden',          'boolean',                  true,  NULL::text),
    ('id',              'uuid',                     false, 'gen_random_uuid()'),
    ('last_worn',       'text',                     true,  NULL::text),
    ('name',            'text',                     true,  NULL::text),
    ('name_zh',         'text',                     true,  NULL::text),
    ('notes',           'text',                     true,  NULL::text),
    ('owner_id',        'uuid',                     false, NULL::text),
    ('photo',           'text',                     true,  NULL::text),
    ('price',           'bigint',                   true,  NULL::text),
    ('primary_color',   'text',                     true,  NULL::text),
    ('purchase_date',   'text',                     true,  NULL::text),
    ('season',          'text',                     true,  NULL::text),
    ('secondary_color', 'text',                     true,  NULL::text),
    ('shape',           'text',                     true,  NULL::text),
    ('style',           'text',                     true,  NULL::text),
    ('wear_count',      'bigint',                   true,  NULL::text)
),
actual AS (
  SELECT
    a.attname::text AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
    NOT a.attnotnull AS is_nullable,
    pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_expr
  FROM pg_catalog.pg_attribute a
  LEFT JOIN pg_catalog.pg_attrdef d
    ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = to_regclass('public.ootie_clothing_items')
    AND a.attnum > 0 AND NOT a.attisdropped
)
SELECT
  COALESCE(e.column_name, a.column_name) AS column_name,
  e.data_type AS expected_type,
  a.data_type AS actual_type,
  e.is_nullable AS expected_nullable,
  a.is_nullable AS actual_nullable,
  e.default_expr AS expected_default,
  a.default_expr AS actual_default,
  CASE
    WHEN e.column_name IS NULL THEN 'UNEXPECTED'
    WHEN a.column_name IS NULL THEN 'MISSING'
    WHEN e.data_type = a.data_type
     AND e.is_nullable = a.is_nullable
     AND e.default_expr IS NOT DISTINCT FROM a.default_expr THEN 'PASS'
    ELSE 'MISMATCH'
  END AS status
FROM expected e
FULL OUTER JOIN actual a USING (column_name)
ORDER BY COALESCE(e.column_name, a.column_name);
```

Expected: exactly 21 rows, all `PASS`; `owner_id` is `uuid`, not nullable, and has a `NULL` default expression.

### C3. Exact constraints and delete action

```sql
WITH actual AS (
  SELECT
    c.conname::text AS constraint_name,
    c.contype::text AS constraint_type,
    ARRAY(
      SELECT a.attname::text
      FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_catalog.pg_attribute a
        ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      ORDER BY k.ord
    ) AS local_columns,
    ref_n.nspname::text AS referenced_schema,
    ref_c.relname::text AS referenced_table,
    CASE WHEN c.contype = 'f' THEN ARRAY(
      SELECT a.attname::text
      FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_catalog.pg_attribute a
        ON a.attrelid = c.confrelid AND a.attnum = k.attnum
      ORDER BY k.ord
    ) END AS referenced_columns,
    CASE c.confdeltype
      WHEN 'a' THEN 'NO ACTION'
      WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT'
    END AS delete_action
  FROM pg_catalog.pg_constraint c
  LEFT JOIN pg_catalog.pg_class ref_c ON ref_c.oid = c.confrelid
  LEFT JOIN pg_catalog.pg_namespace ref_n ON ref_n.oid = ref_c.relnamespace
  WHERE c.conrelid = to_regclass('public.ootie_clothing_items')
),
expected (constraint_name, constraint_type, local_columns,
          referenced_schema, referenced_table, referenced_columns, delete_action) AS (
  VALUES
    ('ootie_clothing_items_pkey', 'p', ARRAY['id']::text[],
     NULL::text, NULL::text, NULL::text[], NULL::text),
    ('ootie_clothing_items_owner_id_fkey', 'f', ARRAY['owner_id']::text[],
     'public', 'ootie_profiles', ARRAY['id']::text[], 'NO ACTION')
)
SELECT
  COALESCE(e.constraint_name, a.constraint_name) AS constraint_name,
  CASE
    WHEN e.constraint_name IS NULL THEN 'UNEXPECTED'
    WHEN a.constraint_name IS NULL THEN 'MISSING'
    WHEN e.constraint_type = a.constraint_type
     AND e.local_columns = a.local_columns
     AND e.referenced_schema IS NOT DISTINCT FROM a.referenced_schema
     AND e.referenced_table IS NOT DISTINCT FROM a.referenced_table
     AND e.referenced_columns IS NOT DISTINCT FROM a.referenced_columns
     AND e.delete_action IS NOT DISTINCT FROM a.delete_action THEN 'PASS'
    ELSE 'MISMATCH'
  END AS status,
  a.referenced_schema,
  a.referenced_table,
  a.referenced_columns,
  a.delete_action
FROM expected e
FULL OUTER JOIN actual a USING (constraint_name)
ORDER BY COALESCE(e.constraint_name, a.constraint_name);
```

Expected: exactly two rows, both `PASS`; the owner FK targets `public.ootie_profiles(id)` with `NO ACTION`.

### C4. Exact indexes

```sql
SELECT
  idx.relname AS index_name,
  i.indisunique AS is_unique,
  i.indisprimary AS is_primary,
  am.amname AS access_method,
  ARRAY(
    SELECT pg_catalog.pg_get_indexdef(i.indexrelid, k, true)
    FROM generate_series(1, i.indnkeyatts) AS k ORDER BY k
  ) AS key_columns,
  pg_catalog.pg_get_expr(i.indpred, i.indrelid) AS predicate
FROM pg_catalog.pg_index i
JOIN pg_catalog.pg_class idx ON idx.oid = i.indexrelid
JOIN pg_catalog.pg_am am ON am.oid = idx.relam
WHERE i.indrelid = to_regclass('public.ootie_clothing_items')
ORDER BY idx.relname;
```

Expected: exactly one row: `ootie_clothing_items_pkey`, unique `true`, primary `true`, access method `btree`, key columns `{id}`, predicate `NULL`.

## D. SUCCESS CRITERIA

003 passes only when all conditions hold:

1. Target is manually confirmed as `OOTIE-sandy-dev`.
2. BEFORE CHECK returns exactly 8 rows and `8/8 true`.
3. Source path and SHA-256 match this document and the manifest.
4. The complete unchanged 003 source executes without error and commits.
5. C1 shows the table and row type, RLS disabled/not forced, no policy, no user trigger, and zero seed rows.
6. C2 returns exactly 21 rows, all `PASS`; `owner_id` is `uuid NOT NULL` with no default.
7. C3 returns exactly two rows, both `PASS`; owner FK is `public.ootie_profiles(id) ON DELETE NO ACTION`.
8. C4 returns only the expected primary-key index.
9. No query returns `MISSING`, `MISMATCH`, or `UNEXPECTED`.

## E. STOP CONDITIONS

Stop and do not enter 004 if any condition occurs:

- Target identity is not visibly confirmed as `OOTIE-sandy-dev`.
- Any BEFORE result is false, or there are not exactly eight results.
- The current hash differs, or the invalidated old hash is encountered.
- 003 reports any SQL error or transaction outcome is unclear.
- There are not exactly 21 columns, or any column other than the approved `owner_id` fix differs from evidence.
- `owner_id` is nullable, has any default, references `auth.users`, does not reference `public.ootie_profiles(id)`, or does not use `NO ACTION`.
- Rows, extra columns, constraints, indexes, triggers, policies, or RLS changes appear.
- Any AFTER result is missing or mismatched.

On failure, preserve the error and results, do not patch the remote database, do not retry automatically, and do not execute 004–012.
