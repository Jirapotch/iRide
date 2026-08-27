insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'foundation.owner@iride.test',
    '{"seed": "foundation", "persona": "owner"}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'foundation.viewer@iride.test',
    '{"seed": "foundation", "persona": "viewer"}'::jsonb
  )
on conflict (id) do update
set email = excluded.email,
    encrypted_password = null,
    email_confirmed_at = null,
    raw_app_meta_data = '{}'::jsonb,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();
