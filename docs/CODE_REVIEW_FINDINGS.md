# Code Review Findings — branch `Optimization-&-Polish` (2026-06-12)

Independent review of the latest team branch. Each finding was verified by reading
the code, with file/line references. Ordered by user impact.

## High — users will feel these

### 1. Offline app launch wipes stored credentials (logs the user out)
**Where:** `lib/auth.tsx` startup effect (~lines 102–146)
On cold start, `validateJwtToken(t)` is a network call. With no connectivity
(airplane mode, flaky cell) `fetch` throws a `TypeError`, which lands in the outer
`catch` that calls `clearStoredAuth()` — permanently deleting the JWT + refresh
token. Opening the app offline logs the user out.
**Fix:** distinguish network errors from real 401/403 — keep tokens on network
failure and retry later. Ideally restore the session optimistically and validate in
the background (startup is currently serialized on 5 sequential storage reads + the
validation round-trip before `ready = true`).

### 2. Messaging: sent replies don't appear; unread badges never clear
**Where:** `hooks/useMessages.ts` — `useReplyToThread.onSuccess` (~280–291) and
`useMarkConversationAsRead` (~338–347)
Both invalidate queries with `refetchType: 'none'`. Combined with the global
`refetchOnWindowFocus/Reconnect: false` and screens staying mounted in the tab
navigator, the invalidation never materializes:
- After Send, the reply doesn't appear in the open thread until pull-to-refresh.
- After reading a conversation, the red dot / unread counts persist until restart.
Side effect: mark-read *does* refetch the thread, so every thread open
double-fetches messages.
**Fix:** drop `refetchType: 'none'` for the active thread/conversations keys, or
optimistically write via `setQueryData` (the conversation-list upsert pattern
already in this file does it correctly).
**Convention check:** `refetchType: 'none'` + disabled focus refetch = invalidations
that never run. Same bug class in `useSendFriendRequest`
(`hooks/useQueries.ts` ~356–362, `refetchType: 'inactive'`).

### 3. Friends list silently capped at 10
**Where:** `lib/api.ts` — `getFriendshipRelationships` (~512–520), `getFriendsList`
(~532–543)
`/buddypress/v1/friends?user_id=X&is_confirmed=1` is called with no
`per_page`/`page`, so BuddyPress returns only the default first page (10 items).
`total`/`pages` are then computed from the truncated array and sliced client-side.
Users with >10 friends see a truncated list and wrong totals. (The batched
`members?include=` N+1 fix works well — this is the remaining gap.)
**Fix:** pass `per_page`/`page` through and read `X-WP-Total`/`X-WP-TotalPages`
headers. Same fix for `getConversations`/`getMessages` (~1503–1535), which also
send no pagination and truncate inbox/threads at server defaults.

### 4. Liking a post refetches the entire feed
**Where:** `hooks/useActivity.ts` — `useLikePost` (~121–125)
`invalidateQueries({ queryKey: ['activity'] })` refetches every loaded page of the
infinite feed plus all detail queries on each like tap; no optimistic update, so
the heart doesn't toggle until the round-trip completes.
**Fix:** optimistically toggle `favorited` via `setQueryData`; invalidate narrowly.
Same pattern for `useSharePost`/`useUpdatePost`.

### 5. JWT expiry mid-session breaks all screens; refresh not deduplicated
**Where:** `lib/api.ts` `authedFetch` (~195–206); `lib/auth.tsx` `refreshMembership`
`authedFetch` (used by ~40 endpoints) never attempts a token refresh on 401 —
refresh only happens at cold start and inside `refreshMembership`, so an expired
JWT errors every screen until membership happens to recheck. Conversely
`refreshCoralToken` has no shared in-flight promise: concurrent callers can fire
parallel refreshes, and if the server rotates refresh tokens the second use of the
old token fails and force-logs-out.
**Fix:** central 401 interceptor in `authedFetch` that awaits a single module-level
refresh promise, then retries once (the `sharePostRequestsInFlight` dedup pattern
in the same file is the model).

## Medium

### 6. Push notifications are dead end-to-end
`app/_layout.tsx` (~23–27): `// TODO: Send token to your backend server`.
`registerPushToken`/`removePushToken` (`lib/api.ts` ~220–249) and the server's
`/coral/v1/push-token` are never invoked, so no remote push can ever arrive.
Wire `registerPushToken` after auth (and deregister on logout), or delete the
dead plumbing.

### 7. Real logout path skips cache + push-token cleanup
`app/(tabs)/profile.tsx` (~17) calls `clearAuth()` directly; `useLogout`
(`hooks/useQueries.ts` ~115–128) — the only place that does
`queryClient.clear()` — is unused. Query keys aren't user-scoped, so a second
account login within `gcTime` can briefly show the previous user's messages,
friends, and profile.
**Fix:** move `queryClient.clear()` (+ push-token deregistration) into `clearAuth`,
or make the profile button use `useLogout`.

### 8. Member search fires a request per keystroke
`app/(tabs)/messages/new.tsx` (~161–165) passes `search` un-debounced into
`useMembersList` (`hooks/useMembers.ts` ~35) whose query key includes the string —
one query + HTTP request per character, with a loading flash.
**Fix:** debounce 300–400 ms (MentionInput already does this) and/or
`placeholderData: keepPreviousData`.

### 9. "All Groups" feed bypasses React Query; pull-to-refresh refreshes the wrong data
`app/(tabs)/index.tsx` (~632–682, ~1288–1296): one uncached `getGroupActivity`
request per group into local state, gated by a ref so it never refreshes for the
session and is invisible to mutation invalidations. The `RefreshControl` calls
`refetch()` on the *disabled* `useActivityFeed` query — fetching data that isn't
displayed while the visible list never changes.
**Fix:** model it as a query keyed `['activity','groups-all', groupIds]`.

### 10. Feed render blocked behind member prefetch; PostItem re-parses HTML every render
`app/(tabs)/index.tsx` (~719–748): feed shows a spinner until ~20 individual
`getMemberById` requests finish (effect keyed on `allActivities.length`, so
same-length changes skip prefetch). `PostItem` isn't memoized and runs 4–5 regex
passes per item on every HomeScreen state change.
**Fix:** render immediately with progressive avatars; one batched
`members?include=` request seeding the per-member cache; `React.memo(PostItem)` +
`useMemo` the parsed content.

### 11. Misc UI
- `app/notification.tsx` (~144–188): notifications render in a plain `View` —
  more than ~6 items are clipped with no scroll. Use a FlatList.
- `components/ui/HeroBackground.tsx` (~61–79): 36 infinite animation loops per
  instance, two instances mounted on the Resources tab, running while unfocused —
  battery/GPU. Pause via `useIsFocused`, reduce count.
- `components/MentionInput.tsx` (~148, 173, 186): `SuggestionList` is declared
  inside the render body, so the FlatList unmounts/remounts every keystroke; its
  debounce timer is never cleared on unmount.
- `app/(tabs)/networking.tsx` (~174–184) and `app/explore-groups.tsx` (~32–45):
  debounce timer stored in `useState` (extra render per keystroke, never cleared
  on unmount); the two screens are near-identical copy-paste — extract one.

### 12. Web token storage
`lib/auth.tsx` (~20–41): web builds keep JWT **and refresh token** in
`localStorage` (XSS-readable). At minimum keep the refresh token memory-only on
web, or document the accepted risk.

### 13. `expo-image-manipulator` imported but not installed
`lib/imageHelpers.ts` imports it; it's absent from `package.json` (a hand-written
`types/expo-image-manipulator.d.ts` silences TypeScript). Latent Metro crash if
anything imports the `lib/` barrel. Either `npx expo install expo-image-manipulator`
or delete the helper + shim.

## Low
- Empty husks left by the console.log purge: no-op `useEffect`s in
  `app/group-detail.tsx` (~109–130, one still iterates all members for nothing),
  empty callbacks in `app/(tabs)/messages/[threadId].tsx`, `hooks/useQueries.ts`
  (~297), `lib/api.ts` (~873 `try { } catch (e) { throw e }`). Consider a
  dev-gated logger instead of deleting observability; `hooks/useNotifications.ts`
  (~32) silently swallows push-registration failures.
- Dead web-only components `components/ui/demo.tsx` + `wrap-shader.tsx`
  (DOM markup, would crash native; imported by nothing). Delete.
- Duplicated conversation helpers across `app/(tabs)/messages.tsx`,
  `messages/new.tsx`, `hooks/useMessages.ts` while `lib/messageNotifications.ts`
  already exports `getConversationItems`; stale `useMemo` deps in
  `messages.tsx` (~166: uses `profile`/`userId`, deps only `[data]`).
- `pmpro` note: `lib/api.ts` `sharePost` (~985) sends `'X-WP-Nonce': token` — a
  JWT is not a nonce and can trigger `rest_cookie_invalid_nonce` 403 depending on
  plugin hook order. Remove the header.
- Duplicate data ownership: membership fetched via both AuthProvider and
  `useMembershipStatus`; two `useMember` hooks with different keys
  (`['member', id]` vs `['profile','member', id]`) double-fetch and invalidate
  past each other. Pick one owner per resource.

## Verified good
Retry config correctly skips 4xx; mutations don't retry (prevents double-sends);
every request has a 15s abort timeout; the friends N+1 batch fix works; messaging
mutations do proper optimistic upserts with rollback; `package.json` dep hygiene is
clean; PHP endpoints all have permission callbacks, ownership checks, and input
sanitization (no raw SQL).
