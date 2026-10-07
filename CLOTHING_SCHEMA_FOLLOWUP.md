# Clothing schema follow-up

These items were observed while reviewing 003. They are intentionally not changed in `SUPABASE-CLOTHING-OWNERSHIP-11`. The team evidence remains the source for all fields except the approved `owner_id` personal fix.

| Follow-up | Current evidenced state | Future question |
| --- | --- | --- |
| `last_worn` | nullable `text` | Decide whether the application requires a date/timestamp type and a migration path for existing values |
| `purchase_date` | nullable `text` | Define accepted format before considering a date type |
| `created_at` | nullable `timestamp with time zone`, no default | Decide whether creation time must be mandatory and server generated |
| `price` | nullable `bigint` | Define currency unit and range before adding checks or changing type |
| `wear_count` | nullable `bigint`, no default/check | Decide initial value, non-negative constraint, and overflow expectations |
| `category`, `brand`, `color_hex`, `primary_color`, `secondary_color`, `season`, `style` | nullable free text | Define canonical vocabularies and validation rules before adding constraints |
| Owner lookup performance | no separate `owner_id` index in team evidence | Measure actual query needs before proposing an index |
| Stats RPC ownership | existing RPC evidence may compare clothing `owner_id` with `auth.uid()` | Reconcile RPC logic with the profile-ID ownership model before executing or calling affected RPCs |
| Frontend write path | `src/services/supabase.js` currently writes the legacy `items.user_id` contract, while `src/stores/closet.js` creates a local row with `owner_id: 'profile-01'` and does not call the OOTIE clothing insert | In a separately scoped frontend change, replace this path with session → `ootie_profiles` lookup → explicit `ootie_clothing_items.owner_id`, and test `PROFILE_MISSING` without mock fallback |

No table column, type, default, constraint, index, function, policy, or frontend source was changed for these follow-ups in this phase.
