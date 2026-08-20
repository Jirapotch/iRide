# iRide

iRide is a bilingual community for people who love cars and the stories behind every drive. Phase 1 includes Google and email OTP authentication, public profiles and garages, a member-only chronological feed, single-photo posts, comments, likes, and follows.

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- Supabase Auth, Postgres, Storage, and Row Level Security
- Vitest, Testing Library, Playwright, GitHub Actions
- Vercel hosting

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
3. Apply `supabase/migrations/202608200001_phase_1.sql` to the Supabase project.
4. Enable Google in Supabase Auth and add `http://localhost:3000/auth/callback` as a redirect URL.
5. Run `npm run dev` and open `http://localhost:3000`.

Without Supabase variables the app runs in read-only demo mode so the product and responsive design can still be reviewed.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## Deployment

Connect the repository to Vercel, configure the two public Supabase environment variables for Preview and Production, and add the Vercel callback URLs to the Supabase Auth allow list. Production deploys from `main`.
