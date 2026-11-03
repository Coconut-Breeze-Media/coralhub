// lib/tabNavigation.ts
/**
 * Back-navigation helpers for the (tabs) navigator.
 *
 * Every detail screen (group, member, post, notifications, profile sub pages,
 * create group, ...) is a hidden tab route, so "back" is the tab router's
 * history. The navigator uses backBehavior="fullHistory", which records every
 * visit (with its params) the way a browser does. These helpers:
 *
 * - decide whether *this* tab navigator has somewhere to go back to (the root
 *   stack may still hold the Welcome screen underneath the tabs, so the global
 *   router.canGoBack() is not a safe signal), and
 * - swap the current screen for another one without leaving it in history
 *   (e.g. Create Group -> the new group), which expo-router's REPLACE does not
 *   do reliably for tab routes.
 */

import { router, type Href } from 'expo-router';

type HistoryEntry = { type?: string; key: string; params?: object };

type NavigatorState = {
  type?: string;
  index: number;
  routes: Array<{ key: string; name: string; params?: object; path?: string }>;
  history?: HistoryEntry[];
  [key: string]: unknown;
};

/** Minimal shape of the object returned by expo-router's useNavigation(). */
export type BackNavigation = {
  getState(): unknown;
  canGoBack(): boolean;
  goBack(): void;
  dispatch(action: any): void;
};

function asNavigatorState(value: unknown): NavigatorState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as NavigatorState;
  return Array.isArray(state.routes) && typeof state.index === 'number' ? state : null;
}

/**
 * True when the navigator that owns this screen can go back to a screen the
 * user actually visited. For the tab navigator that is its own history; for
 * root stack screens (password reset, membership levels) it is the stack.
 */
export function canGoBackInNavigator(navigation: BackNavigation): boolean {
  const state = asNavigatorState(navigation.getState());
  if (state?.type === 'tab') {
    return Array.isArray(state.history) && state.history.length > 1;
  }
  return navigation.canGoBack();
}

/**
 * Go back to the previous screen; if there is none (deep link, cold start on
 * a detail screen) open the fallback instead.
 */
export function goBackOrFallback(navigation: BackNavigation, fallbackRoute: Href) {
  if (canGoBackInNavigator(navigation)) {
    navigation.goBack();
    return;
  }
  const state = asNavigatorState(navigation.getState());
  if (state?.type === 'tab') {
    // navigate (not replace) so the tab history stays consistent.
    router.navigate(fallbackRoute);
  } else {
    router.replace(fallbackRoute);
  }
}

/**
 * Open another tab route in place of the current one: the current screen is
 * dropped from the back history, so "back" from the new screen returns to
 * wherever the user was before the current screen.
 *
 * @param name   - tab route name, e.g. 'group-detail' or 'messages/[threadId]'
 * @param params - route params (strings, as expo-router passes them)
 */
export function replaceTabRoute(
  navigation: BackNavigation,
  name: string,
  params?: Record<string, string>
) {
  navigation.dispatch((rawState: unknown) => {
    const state = asNavigatorState(rawState);
    const targetIndex = state ? state.routes.findIndex((route) => route.name === name) : -1;

    if (!state || state.type !== 'tab' || !Array.isArray(state.history) || targetIndex === -1) {
      return { type: 'NAVIGATE', payload: { name, params } };
    }

    const currentKey = state.routes[state.index]?.key;
    const target = state.routes[targetIndex];
    const history = [...state.history];

    // Drop the entry for the screen being replaced (the most recent one).
    if (history.length > 0 && history[history.length - 1].key === currentKey) {
      history.pop();
    }
    // Same de-duplication rule fullHistory uses: never stack the same route twice in a row.
    if (history.length > 0 && history[history.length - 1].key === target.key) {
      history.pop();
    }
    history.push({ type: 'route', key: target.key, params });

    return {
      type: 'RESET',
      payload: {
        ...state,
        index: targetIndex,
        routes: state.routes.map((route, index) =>
          index === targetIndex ? { ...route, params, path: undefined } : route
        ),
        history,
      },
    };
  });
}
