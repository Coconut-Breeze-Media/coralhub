// lib/index.ts
/**
 * Central export point for library modules
 * Re-exports types, constants, and utilities for easy imports
 */

// API functions and utilities
export * from './api';
export * from './auth';
export * from './config';

// Query client and utilities
export * from './queryClient';

// Image optimization utilities
export * from './imageHelpers';

// Types
export type * from '../types';

// Constants
export * from '../constants/navigation';
