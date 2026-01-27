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
├── lib/                          # Core utilities and services
│   ├── api.ts                   # WordPress API client
│   ├── auth.tsx                 # Authentication context & provider
│   └── index.ts                 # Centralized exports
├── types/                        # TypeScript type definitions
│   └── index.ts                 # Centralized type definitions
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

### Authentication Flow
1. User signs in via `wpLogin()` from `lib/api.ts`
2. JWT token stored securely via `AuthProvider`
3. Membership status checked with `getMembershipStatus()`
4. Protected routes use `useAuth()` hook for access control

### Data Fetching
- `getPosts()`: Fetch WordPress posts
- `getMembershipLevels()`: Get available plans
- `getMe()`: Get current user profile
- `authedFetch()`: Generic authenticated API calls

## Best Practices

1. **Always use types**: Import types from `types/` directory
2. **Use constants**: Reference routes via `ROUTES` object
3. **Document code**: Add JSDoc comments for complex logic
4. **Follow patterns**: Maintain consistency with existing code
5. **Type everything**: Avoid `any` types when possible

## Migration Notes

The refactoring maintains backward compatibility while introducing:
- Centralized type definitions
- Navigation constants
- Better code organization
- Improved documentation

All existing functionality remains intact with enhanced type safety and maintainability.
