# iRide Phase 1 database

The canonical baseline is [`supabase/migrations/202608200001_phase_1.sql`](../supabase/migrations/202608200001_phase_1.sql). The application stores Storage object paths, never permanent media URLs. Server-only data access maps database rows to camelCase UI DTOs.

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
  }
  VEHICLES {
    uuid id PK
    uuid owner_id FK
    text nickname
    text make
    text model
    int year
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
  }
```

## Data dictionary and lifecycle

| Model | Required ownership | Nullable fields | Delete behavior | Read visibility |
| --- | --- | --- | --- | --- |
| `profiles` | `id = auth.users.id` | bio, location, avatar path | deleting auth user cascades through all owned data | anon + authenticated |
| `vehicles` | `owner_id = auth.uid()` | trim, color, description, cover path | owner/profile delete cascades; linked posts retain and set vehicle to null | anon + authenticated |
| `posts` | `author_id = auth.uid()`; selected vehicle must belong to author | vehicle, photo path | author/profile delete cascades to post, comments, likes | authenticated |
| `comments` | `author_id = auth.uid()` | none | post or author delete cascades | authenticated |
| `likes` | `user_id = auth.uid()` | none | user or post delete cascades; pair is unique | authenticated |
| `follows` | `follower_id = auth.uid()` and follower differs from following | none | either profile delete cascades; pair is unique | authenticated records; aggregate counts are public through `profile_stats` |

All editable content tables use `updated_at` triggers. `handle_new_user` creates the one-to-one profile. `ensure_post_vehicle_owner` enforces vehicle ownership in addition to RLS.

## Storage

| Bucket | Visibility | Limit | Database column |
| --- | --- | --- | --- |
| `avatars` | public read; owner-folder writes | 8 MiB, JPEG/PNG/WebP | `profiles.avatar_path` |
| `vehicle-media` | public read; owner-folder writes | 8 MiB, JPEG/PNG/WebP | `vehicles.cover_path` |
| `post-media` | authenticated read; owner-folder writes | 8 MiB, JPEG/PNG/WebP | `posts.photo_path` |

Avatar and vehicle URLs are derived with `getPublicUrl`. Post media uses one-hour signed URLs. Application delete services remove Storage objects after the owning row is deleted; failed row writes remove newly uploaded objects as compensation.

## Type generation and database tests

After applying the migration, regenerate the checked-in schema types with:

```powershell
npm run db:types
```

The command requires a logged-in Supabase CLI. Run the pgTAP contract and RLS suite against the local Supabase stack with `npm run db:test`.
