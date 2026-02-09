# TanStack Query Implementation Guide

This project uses **TanStack Query (React Query)** for efficient data fetching, caching, and state management.

## 📚 Overview

TanStack Query provides:
- ✅ **Automatic caching** - Data is cached and reused across components
- ✅ **Background refetching** - Stale data is refreshed automatically
- ✅ **Request deduplication** - Multiple requests for the same data are combined
- ✅ **Optimistic updates** - UI updates before server confirms
- ✅ **Retry logic** - Failed requests are automatically retried
- ✅ **Pagination support** - Built-in pagination helpers

## 🗂️ File Structure

```
coralhub/
├── lib/
│   ├── queryClient.ts      # Query client configuration
│   └── api.ts              # API functions
├── hooks/
│   └── useQueries.ts       # Custom React Query hooks
└── types/
    └── index.ts            # TypeScript types including query types
```

## ⚙️ Configuration

### Query Client (`lib/queryClient.ts`)

```typescript
import { queryClient } from './lib/queryClient';

// Default settings:
// - Cache duration: 5 minutes
// - Garbage collection: 10 minutes
// - Retry attempts: 3 times with exponential backoff
// - Refetch on window focus: enabled
```

### Query Keys (`queryKeys`)

Centralized query keys ensure consistency:

```typescript
import { queryKeys } from './lib/queryClient';

// Examples:
queryKeys.auth.me()                    // ['auth', 'me']
queryKeys.posts.list(1)                // ['posts', 'list', 1]
queryKeys.posts.detail(123)            // ['posts', 'detail', 123]
queryKeys.membership.levels()          // ['membership', 'levels']
```

## 🎣 Custom Hooks

### Available Hooks

#### `usePosts(page, options?)`
Fetch paginated posts with automatic caching.

```typescript
import { usePosts } from '../hooks/useQueries';

function MyComponent() {
  const { data, isLoading, isError, error } = usePosts(1);
  
  if (isLoading) return <LoadingSpinner />;
  if (isError) return <Error message={error.message} />;
  
  return <PostsList posts={data} />;
}
```

#### `useMe()`
Fetch current authenticated user data.

```typescript
import { useMe } from '../hooks/useQueries';

function ProfileScreen() {
  const { data: user, isLoading } = useMe();
  
  return <Text>{user?.name}</Text>;
}
```

#### `useMembershipLevels()`
Fetch membership plans (cached for 30 minutes).

```typescript
import { useMembershipLevels } from '../hooks/useQueries';

function MembershipScreen() {
  const { data: levels } = useMembershipLevels();
  
  return levels?.map(level => <PlanCard key={level.id} {...level} />);
}
```

#### `useLogin()`
Mutation hook for user authentication.

```typescript
import { useLogin } from '../hooks/useQueries';

function LoginForm() {
  const login = useLogin();
  
  const handleSubmit = () => {
    login.mutate(
      { username: 'user@example.com', password: 'password' },
      {
        onSuccess: () => console.log('Logged in!'),
        onError: (error) => console.error(error),
      }
    );
  };
  
  return (
    <Button 
      onPress={handleSubmit}
      disabled={login.isPending}
    >
      {login.isPending ? 'Logging in...' : 'Login'}
    </Button>
  );
}
```

#### `useLogout()`
Mutation hook for logout (clears all cached data).

```typescript
import { useLogout } from '../hooks/useQueries';

function LogoutButton() {
  const logout = useLogout();
  
  return (
    <Button onPress={() => logout.mutate()}>
      Logout
    </Button>
  );
}
```

## 🔄 Cache Invalidation

### Manual Invalidation

```typescript
import { invalidateQueries } from './lib/queryClient';

// Invalidate specific queries
invalidateQueries.posts();           // All posts
invalidateQueries.post(123);         // Specific post
invalidateQueries.user();            // User data
invalidateQueries.membership();      // Membership data
invalidateQueries.all();             // Everything
```

### Automatic Invalidation

Some mutations automatically invalidate related queries:

- `useLogin()` - Invalidates user and membership queries
- `useLogout()` - Clears entire cache

## 🚀 Prefetching

Improve UX by prefetching data before it's needed:

```typescript
import { usePrefetchNextPage } from '../hooks/useQueries';

function PostsList({ currentPage }) {
  const { prefetchNext } = usePrefetchNextPage(currentPage);
  
  // Prefetch when user scrolls near the end
  const handleScroll = () => {
    prefetchNext();
  };
  
  return <FlatList onEndReached={handleScroll} />;
}
```

## 🎨 Query States

TanStack Query provides several state flags:

```typescript
const {
  data,           // The query result
  isLoading,      // Initial loading (no cached data)
  isFetching,     // Any fetch in progress (including background)
  isError,        // Query failed
  error,          // Error object
  isSuccess,      // Query succeeded
  refetch,        // Manual refetch function
  isRefetching,   // Background refetch in progress
} = usePosts(1);
```

## ⚡ Best Practices

### 1. Use Appropriate Stale Times

```typescript
// Frequently changing data
usePosts(1)                          // 3 minutes (default)

// Rarely changing data
useMembershipLevels()                // 30 minutes

// User-specific data
useMe()                              // 10 minutes
```

### 2. Handle All States

```typescript
function MyComponent() {
  const { data, isLoading, isError, error } = useMyQuery();
  
  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorMessage error={error} />;
  if (!data) return <EmptyState />;
  
  return <DataDisplay data={data} />;
}
```

### 3. Use Enabled Option for Conditional Fetching

```typescript
const { data } = useMe({
  enabled: !!token,  // Only fetch if token exists
});
```

### 4. Invalidate on Mutations

```typescript
const updatePost = useMutation({
  mutationFn: updatePostApi,
  onSuccess: () => {
    invalidateQueries.posts();  // Refresh posts list
  },
});
```

### 5. Prefetch for Better UX

```typescript
// Prefetch membership levels on app start
useEffect(() => {
  prefetchQueries.membershipLevels();
}, []);
```

## 🐛 Debugging

### React Query Devtools (Web Only)

Install devtools for debugging:

```bash
npm install @tanstack/react-query-devtools --save-dev
```

Add to your app:

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Logging

Enable query logging in development:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...DEFAULT_QUERY_OPTIONS.queries,
      onError: (error) => console.error('Query error:', error),
      onSuccess: (data) => console.log('Query success:', data),
    },
  },
});
```

## 📚 Resources

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query)
- [Query Keys Guide](https://tkdodo.eu/blog/effective-react-query-keys)

## 🔗 Related Files

- [`lib/api.ts`](../lib/api.ts) - API functions
- [`lib/auth.tsx`](../lib/auth.tsx) - Authentication context
- [`types/index.ts`](../types/index.ts) - Type definitions
- [`hooks/useQueries.ts`](../hooks/useQueries.ts) - Custom hooks
