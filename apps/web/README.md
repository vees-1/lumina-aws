# Lumina Web

Next.js 16 frontend. Stack: Tailwind 4, shadcn/ui, Clerk v7, Framer Motion.

## Dev
```bash
pnpm install && pnpm dev   # localhost:3000
pnpm typecheck && pnpm lint
```

Env: `apps/web/.env.local` with `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
API calls proxy to `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`) via `next.config.ts` rewrites.

## Routes
| Route | Auth | Description |
|---|---|---|
| `/` | No | Landing |
| `/dashboard` | Yes | Cases list |
| `/intake` | Yes | 4-modality intake form |
| `/case/[id]` | Yes | Top-5 differential + explainability |
| `/case/[id]/letter` | Yes | Referral letter editor (SSE stream) |
| `/disease/[orpha]` | No | Disease detail |
| `/demo` | No | 12 curated cases |

## Notes
- Auth: `proxy.ts` (not `middleware.ts`) — renamed in Next.js 16
- Dynamic params are a Promise: always `await params`
- Cases stored in localStorage only
