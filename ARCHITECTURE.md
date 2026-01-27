# CoralHub - Architecture Documentation

## Project Structure Refactoring

This document describes the refactored navigation and type system architecture for the CoralHub application.

## Directory Structure

```
coralhub/
├── app/                          # Expo Router file-based routing
│   ├── _layout.tsx              # Root stack navigator
│   ├── index.tsx                # Welcome/landing screen
│   ├── sign-in.tsx              # Authentication screen
│   ├── notification.tsx         # Notifications screen
│   ├── (auth)/                  # Auth-related screens
│   │   └── membership-levels.tsx
│   └── (tabs)/                  # Tab navigator screens
│       ├── _layout.tsx          # Tab navigator configuration
│       ├── index.tsx            # Community tab
│       ├── resources.tsx        # Resources tab
│       ├── networking.tsx       # Networking tab
│       └── profile.tsx          # Profile tab
├── components/                   # Reusable components
│   ├── BackButton.tsx           # Custom back navigation button
│   └── RequireAuth.tsx          # Auth guard component
├── constants/                    # Application constants
│   └── navigation.ts            # Navigation configuration & routes
├── hooks/                        # Custom React hooks
│   ├── useQueries.ts            # TanStack Query hooks
│   └── index.ts                 # Hook exports
├── lib/                          # Core utilities and services
│   ├── api.ts                   # WordPress API client
│   ├── auth.tsx                 # Authentication context & provider
│   ├── queryClient.ts           # TanStack Query configuration
│   └── index.ts                 # Centralized exports
├── types/                        # TypeScript type definitions
│   └── index.ts                 # Centralized type definitions
├── docs/                         # Documentation
│   └── TANSTACK_QUERY.md        # TanStack Query guide
└── screens/                      # Additional screen components
```

## Type System

### Centralized Types (`types/index.ts`)

All TypeScript types are centralized in a single location for better maintainability and consistency:

#### API & WordPress Types
- `JWTPayload`: JWT authentication token payload
- `MembershipResponse`: User membership status
- `WPPage`: WordPress page object
- `WPPost`: WordPress post with embedded data
- `WPUser`: WordPress user profile
- `MembershipLevel`: Subscription plan definition

#### Authentication Types
- `UserProfile`: User profile data in auth context
- `AuthContextState`: Complete auth context state

#### Navigation Types
- `TabScreen`: Tab screen identifiers
- `RootScreen`: Root stack screen identifiers
- `TabNavItem`: Tab navigation item configuration
- `ProfileMenuItem`: Profile menu item configuration

#### Utility Types
- `AsyncState<T>`: Generic async state wrapper
- `PaginationMeta`: Pagination metadata
- `PaginatedResponse<T>`: Paginated API response

## Navigation Architecture

### Constants (`constants/navigation.ts`)

Navigation is configured using typed constants for consistency:

#### Tab Configuration
```typescript
TAB_SCREENS: Array of tab navigation items with:
- name: Screen identifier
- title: Display title
- icon: Active icon name
- iconOutline: Inactive icon name
```

#### Routes
```typescript
ROUTES: Object containing all application route paths
- Centralized route definitions
- Type-safe route references
- Easy maintenance and refactoring
```

#### Screen Options
```typescript
DEFAULT_HEADER_OPTIONS: Shared header configuration
TAB_BAR_OPTIONS: Tab bar styling
SCREEN_TITLES: Screen title mappings
```

#### Profile Menu
```typescript
PROFILE_MENU_ITEMS: Array of profile navigation items with:
- label: Display text
- href: Navigation path
- icon: Ionicons icon name
```

## Implementation Benefits

### 1. Type Safety
- Centralized types prevent inconsistencies
- Compile-time error detection
- Better IDE autocomplete and IntelliSense

### 2. Maintainability
- Single source of truth for types and constants
- Easy to update navigation structure
- Clear separation of concerns

### 3. Scalability
- Easy to add new screens and routes
- Consistent patterns across the application
- Documented interfaces for new developers

### 4. Developer Experience
- Clear documentation with JSDoc comments
- Typed navigation throughout the app
- Reusable constants reduce duplication

## Usage Examples

### Importing Types
```typescript
import type { WPPost, UserProfile, TabScreen } from '../types';
```

### Using Navigation Constants
```typescript
import { ROUTES, TAB_SCREENS, PROFILE_MENU_ITEMS } from '../constants/navigation';

// Navigate to a screen
router.push(ROUTES.NOTIFICATIONS);

// Render tab screens
TAB_SCREENS.map((tab) => <Tab.Screen {...tab} />);
```

### Centralized Exports
```typescript
// Import everything from lib
import { 
  wpLogin, 
  getMembershipLevels,
  useAuth,
  ROUTES,
  type WPPost,
  type UserProfile 
} from '../lib';
```

## API Integration

### TanStack Query (React Query)

The application uses TanStack Query for efficient data fetching and caching:

#### Configuration (`lib/queryClient.ts`)
- **Cache duration**: 5 minutes default
- **Garbage collection**: 10 minutes
- **Retry logic**: 3 attempts with exponential backoff
- **Automatic refetching**: On window focus and when data is stale

#### Custom Hooks (`hooks/useQueries.ts`)
```typescript
// Fetch posts with caching
const { data, isLoading, error } = usePosts(1);

// Fetch current user
const { data: user } = useMe();

// Fetch membership levels
const { data: levels } = useMembershipLevels();

// Login mutation
const login = useLogin();
login.mutate({ username, password });

// Logout mutation (clears cache)
const logout = useLogout();
logout.mutate();
```

#### Query Keys (`queryKeys`)
Centralized query keys for cache management:
```typescript
queryKeys.auth.me()              // ['auth', 'me']
queryKeys.posts.list(1)          // ['posts', 'list', 1]
queryKeys.membership.levels()    // ['membership', 'levels']
```

#### Cache Invalidation
```typescript
invalidateQueries.posts()        // Invalidate all posts
invalidateQueries.user()         // Invalidate user data
invalidateQueries.all()          // Clear entire cache
```

See [docs/TANSTACK_QUERY.md](docs/TANSTACK_QUERY.md) for complete documentation.

### Authentication Flow
1. User signs in via `useLogin()` hook
2. JWT token stored securely via `AuthProvider`
3. Membership status cached with TanStack Query
4. Protected routes use `useAuth()` hook for access control

### Data Fetching
- **With caching** (recommended): Use hooks from `hooks/useQueries.ts`
- **Direct API calls**: Functions in `lib/api.ts` for special cases
- **Prefetching**: Use `prefetchQueries` helpers for better UX

## Best Practices

1. **Always use types**: Import types from `types/` directory
2. **Use constants**: Reference routes via `ROUTES` object
3. **Use query hooks**: Prefer `usePosts()` over direct `getPosts()` calls
4. **Handle loading states**: Always handle `isLoading`, `isError`, and empty states
5. **Invalidate on mutations**: Clear cache after data modifications
6. **Document code**: Add JSDoc comments for complex logic
7. **Follow patterns**: Maintain consistency with existing code
8. **Type everything**: Avoid `any` types when possible
9. **Prefetch wisely**: Use prefetching for predictable user navigation
10. **Cache appropriately**: Adjust stale times based on data volatility

## Performance Optimization

### Caching Strategy
- **Frequently changing**: 3-5 minutes (posts, user activity)
- **Moderately stable**: 10 minutes (user profile, settings)
- **Rarely changing**: 30 minutes (membership levels, static content)

### Request Deduplication
TanStack Query automatically deduplicates simultaneous requests for the same data.

### Background Refetching
Data is automatically refreshed in the background when:
- Window regains focus
- Network reconnects
- Data becomes stale

### Pagination
Use `usePrefetchNextPage()` to load next page while user views current page.

## Migration Notes

The refactoring maintains backward compatibility while introducing:
- Centralized type definitions
- Navigation constants
- TanStack Query for caching and optimization
- Custom hooks for data fetching
- Better code organization
- Improved documentation

All existing functionality remains intact with enhanced:
- **Type safety**: Comprehensive TypeScript types
- **Performance**: Automatic caching and request deduplication
- **Developer experience**: Better IntelliSense and error messages
- **Maintainability**: Centralized configuration and consistent patterns

## Quick Start

### Using TanStack Query Hooks

```typescript
import { usePosts, useMembershipLevels } from '../hooks';

function MyScreen() {
  // Automatic caching, loading states, and error handling
  const { data: posts, isLoading, error } = usePosts(1);
  const { data: levels } = useMembershipLevels();
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <DataDisplay posts={posts} levels={levels} />;
}
```

### Authentication with Mutations

```typescript
import { useLogin, useLogout } from '../hooks';

function AuthExample() {
  const login = useLogin();
  const logout = useLogout();
  
  const handleLogin = () => {
    login.mutate(
      { username: 'user@example.com', password: 'password' },
      {
        onSuccess: () => console.log('Logged in!'),
        onError: (error) => alert(error.message),
      }
    );
  };
  
  return (
    <>
      <Button onPress={handleLogin} disabled={login.isPending}>
        {login.isPending ? 'Logging in...' : 'Login'}
      </Button>
      <Button onPress={() => logout.mutate()}>Logout</Button>
    </>
  );
}
```

## Additional Resources

- [TanStack Query Documentation](docs/TANSTACK_QUERY.md)
- [API Reference](lib/api.ts)
- [Type Definitions](types/index.ts)
- [Navigation Constants](constants/navigation.ts)
