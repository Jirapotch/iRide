# iRide Phase 1 database

The canonical baseline is [`supabase/migrations/202608200001_phase_1.sql`](../supabase/migrations/202608200001_phase_1.sql), with authentication/feed hardening and profile privacy changes applied by later migrations. The application stores Storage object paths, never permanent media URLs. Server-only data access maps database rows to camelCase UI DTOs.

## Entity relationship diagram

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "creates / cascades"
  PROFILES ||--o{ VEHICLES : owns
  PROFILES ||--o{ POSTS : authors
  VEHICLES o|--o{ POSTS : "optional subject"
  POSTS ||--o{ COMMENTS : contains
  PROFILES ||--o{ COMMENTS : authors
  PROFILES ||--o{ LIKES : gives
  POSTS ||--o{ LIKES : receives
  PROFILES ||--o{ FOLLOWS : follower
  PROFILES ||--o{ FOLLOWS : following

  PROFILES {
    uuid id PK,FK
    text username UK
    text display_name
    text bio nullable
    text location nullable
    text locale
    text avatar_path nullable
    text cover_path nullable
    boolean is_private
  }
  VEHICLES {
    uuid id PK
    uuid owner_id FK
    text nickname
    text make nullable
    text model nullable
    int year nullable
    text cover_path nullable
  }
  POSTS {
    uuid id PK
    uuid author_id FK
    uuid vehicle_id FK,nullable
    text body
    text photo_path nullable
  }
  COMMENTS {
    uuid id PK
    uuid post_id FK
    uuid author_id FK
    text body
  }
  LIKES {
    uuid user_id PK,FK
    uuid post_id PK,FK
  }
  FOLLOWS {
    uuid follower_id PK,FK
    uuid following_id PK,FK
    text status
  }
```

## Data dictionary and lifecycle

| Model | Required ownership | Nullable fields | Delete behavior | Read visibility |
| --- | --- | --- | --- | --- |
| `profiles` | `id = auth.users.id` | bio, location, avatar path, cover path | deleting auth user cascades through all owned data | authenticated; basic profile details remain visible to members |
| `vehicles` | `owner_id = auth.uid()` | brand/make, model, year, trim, color, description, cover path | owner/profile delete cascades; linked posts retain and set vehicle to null | owner, public-profile viewers, or accepted followers |
| `posts` | `author_id = auth.uid()`; selected vehicle must belong to author | vehicle, photo path | author/profile delete cascades to post, comments, likes | public-profile viewers or accepted followers; anonymous feed excludes private authors |
| `comments` | `author_id = auth.uid()` | none | post or author delete cascades | authenticated |
| `likes` | `user_id = auth.uid()` | none | user or post delete cascades; pair is unique | authenticated |
| `follows` | `follower_id = auth.uid()` and follower differs from following | none | either profile delete cascades; pair is unique | participants only; private profiles create pending requests and counts include accepted relationships only |

All editable content tables use `updated_at` triggers. `handle_new_user` creates the one-to-one profile. `ensure_post_vehicle_owner` enforces vehicle ownership in addition to RLS.

## Media storage (Release A transition)

| Logical bucket | R2 visibility | Stored limit | Database column |
| --- | --- | --- | --- |
| `avatars` | private; seven-day signed GET | 3 MB WebP | `profiles.avatar_path`, `profiles.cover_path` |
| `vehicle-media` | private; seven-day signed GET | 3 MB WebP | `vehicles.cover_path` |
| `post-media` | private; ten-minute signed GET | 3 MB WebP | `posts.photo_path` |

New uploads use Cloudflare R2 and store `r2:<object-key>` in the existing path columns. During Release A, unprefixed paths continue to resolve through Supabase Storage so the resumable migration can copy and verify each object before updating its row. Uploads and signed reads use server-only credentials; failed row writes remove newly uploaded R2 objects as compensation.

Run `npm run media:migrate -- --dry-run`, then `--apply`, and finally `--verify`. The migration never overwrites a mismatched R2 object and updates a database path only after `HeadObject` confirms size and content type.

## Type generation and database tests

After applying the migration, regenerate the checked-in schema types with:

```powershell
npm run db:types
```

The command requires a logged-in Supabase CLI. Run the pgTAP contract and RLS suite against the local Supabase stack with `npm run db:test`.
