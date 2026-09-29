# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm start         # Start Expo dev server (then press a/i/w for Android/iOS/Web)
npm run android   # Start targeting Android
npm run ios       # Start targeting iOS
npm run web       # Start targeting Web
```

No test runner is configured. There is no lint script; TypeScript (`tsc`) is the primary static check.

Required `.env` in project root:
```
EXPO_PUBLIC_WP_URL=    # WordPress site base URL
EXPO_PUBLIC_WP_API=    # WordPress REST API base URL
EXPO_PUBLIC_JOIN_URL=  # Membership join/checkout URL
```

## Architecture

**Stack:** React Native + Expo (SDK 54), Expo Router v6 (file-based routing), TanStack Query v5, React Context for auth, TypeScript strict mode.

**Backend:** WordPress + BuddyPress + custom `coral-social-api` plugin (in `coral-social-api/`). All API calls go through `lib/api.ts` using JWT tokens. The three relevant API namespaces are:
- `/wp/v2/*` — WordPress core
- `/buddypress/v1/*` — Social features (friends, groups, activity)
- `/coral/v1/*` — Custom endpoints (activity feed, mentions, push tokens, membership)

### Key layers

| Layer | Location | Role |
|---|---|---|
| Routing / Screens | `app/` | Expo Router file-based pages; `(tabs)/` for main nav, `(auth)/` for membership screens |
| Reusable UI | `components/` | Shared widgets (`RequireAuth`, `CommentsModal`, `MentionInput`, etc.) |
| Data hooks | `hooks/` | TanStack Query hooks — `useActivity.ts`, `useProfile.ts`, `useMembers.ts`, `useGroups.ts`, `useNotifications.ts`, `useQueries.ts` |
| API client | `lib/api.ts` | Raw fetch wrapper; returns typed results; throws `ApiError` on failure |
| Auth state | `lib/auth.tsx` | `AuthProvider` + `useAuth()` — holds JWT, userId, profile, membership status; persists tokens via `expo-secure-store` |
| Query config | `lib/queryClient.ts` | `QueryClient`, `queryKeys`, `invalidateQueries`, `prefetchQueries` helpers |
| Types | `types/index.ts` | All shared TypeScript types (API responses, auth, navigation) |
| Nav constants | `constants/navigation.ts` | `ROUTES`, `TAB_SCREENS`, `PROFILE_MENU_ITEMS`, `SCREEN_TITLES` |

### Data fetching pattern

Always prefer the hook layer over calling `lib/api.ts` directly:
```typescript
// Good — cached, deduped, handles loading/error states
const { data, isLoading, error } = usePosts(1);

// Only for mutations or one-off calls with no caching need
const result = await getPosts(1);
```

Invalidate cache after mutations using `invalidateQueries.*` helpers from `lib/queryClient.ts`.

### Authentication flow

1. `useLogin()` mutation calls `wpLogin()`, stores JWT via `AuthProvider.setAuth()`
2. `expo-secure-store` persists `jwt`, `user_email`, `user_display_name`, `user_id`
3. Protected screens wrap with `<RequireAuth>` or check `useAuth().token`
4. Membership gating uses `useAuth().isMember` / `refreshMembership()`

### Cache TTL conventions

- Posts / activity feed: ~3–5 min (`staleTime`)
- User profile / settings: ~10 min
- Membership levels / static: ~30 min

### Adding a new screen

1. Create file under `app/` (Expo Router picks it up automatically)
2. Add route constant to `constants/navigation.ts` → `ROUTES`
3. Use `useAuth()` + `<RequireAuth>` if the screen requires login
4. Fetch data via an existing hook or add a new one in `hooks/`
