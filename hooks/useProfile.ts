// hooks/useProfile.ts
/**
 * Custom React Query hooks for BuddyPress profile management
 * Handles profile data fetching, avatar, cover images, and XProfile fields
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import {
  getCurrentMember,
  getMemberById,
  updateCurrentMember,
  getUserAvatar,
  uploadUserAvatar,
  deleteUserAvatar,
  getUserCover,
  uploadUserCover,
  deleteUserCover,
  updateXProfileField,
} from '../lib/api';
import type {
  BPMember,
  UpdateMemberPayload,
  BPAvatar,
  BPCoverImage,
  UpdateXProfilePayload,
} from '../types';

// ============================================
// Query Keys
// ============================================

const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
  member: (userId: number) => [...profileKeys.all, 'member', userId] as const,
  avatar: (userId: number) => [...profileKeys.all, 'avatar', userId] as const,
  cover: (userId: number) => [...profileKeys.all, 'cover', userId] as const,
};

// ============================================
// Query Hooks
// ============================================

/**
 * Hook to fetch current user's BuddyPress profile
 * Requires authentication
 */
export function useCurrentMember() {
  const { token } = useAuth();

  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: () => {
      if (!token) throw new Error('No authentication token');
      return getCurrentMember(token);
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a member by ID
 * Requires authentication
 */
export function useMember(userId: number) {
  const { token } = useAuth();

  return useQuery({
    queryKey: profileKeys.member(userId),
    queryFn: () => {
      if (!token) throw new Error('No authentication token');
      return getMemberById(userId, token);
    },
    enabled: !!token && !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch user avatar
 * Requires authentication
 */
export function useUserAvatar(userId: number) {
  const { token } = useAuth();

  return useQuery({
    queryKey: profileKeys.avatar(userId),
    queryFn: () => {
      if (!token) throw new Error('No authentication token');
      return getUserAvatar(userId, token);
    },
    enabled: !!token && !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch user cover image
 * Requires authentication
 */
export function useUserCover(userId: number) {
  const { token } = useAuth();

  return useQuery({
    queryKey: profileKeys.cover(userId),
    queryFn: () => {
      if (!token) throw new Error('No authentication token');
      return getUserCover(userId, token);
    },
    enabled: !!token && !!userId,
    staleTime: 10 * 60 * 1000,
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Mutation hook to update current user's profile
 * Invalidates profile queries on success
 */
export function useUpdateProfile() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateMemberPayload) => {
      if (!token) throw new Error('No authentication token');
      return updateCurrentMember(token, payload);
    },
    onSuccess: (data) => {
      // Invalidate and refetch profile queries
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      if (data.id) {
        queryClient.invalidateQueries({ queryKey: profileKeys.member(data.id) });
      }
    },
  });
}

/**
 * Mutation hook to upload user avatar
 * Invalidates avatar queries on success
 */
export function useUploadAvatar() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, formData }: { userId: number; formData: FormData }) => {
      if (!token) throw new Error('No authentication token');
      return uploadUserAvatar(userId, token, formData);
    },
    onSuccess: (_, variables) => {
      // Invalidate avatar and profile queries
      queryClient.invalidateQueries({ queryKey: profileKeys.avatar(variables.userId) });
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      queryClient.invalidateQueries({ queryKey: profileKeys.member(variables.userId) });
    },
  });
}

/**
 * Mutation hook to delete user avatar
 * Invalidates avatar queries on success
 */
export function useDeleteAvatar() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => {
      if (!token) throw new Error('No authentication token');
      return deleteUserAvatar(userId, token);
    },
    onSuccess: (_, userId) => {
      // Invalidate avatar and profile queries
      queryClient.invalidateQueries({ queryKey: profileKeys.avatar(userId) });
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      queryClient.invalidateQueries({ queryKey: profileKeys.member(userId) });
    },
  });
}

/**
 * Mutation hook to upload user cover image
 * Invalidates cover queries on success
 */
export function useUploadCover() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, formData }: { userId: number; formData: FormData }) => {
      if (!token) throw new Error('No authentication token');
      return uploadUserCover(userId, token, formData);
    },
    onSuccess: (_, variables) => {
      // Invalidate cover and profile queries
      queryClient.invalidateQueries({ queryKey: profileKeys.cover(variables.userId) });
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      queryClient.invalidateQueries({ queryKey: profileKeys.member(variables.userId) });
    },
  });
}

/**
 * Mutation hook to delete user cover image
 * Invalidates cover queries on success
 */
export function useDeleteCover() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => {
      if (!token) throw new Error('No authentication token');
      return deleteUserCover(userId, token);
    },
    onSuccess: (_, userId) => {
      // Invalidate cover and profile queries
      queryClient.invalidateQueries({ queryKey: profileKeys.cover(userId) });
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      queryClient.invalidateQueries({ queryKey: profileKeys.member(userId) });
    },
  });
}

/**
 * Mutation hook to update XProfile field
 * Invalidates profile queries on success
 */
export function useUpdateXProfileField() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fieldId,
      userId,
      payload,
    }: {
      fieldId: number;
      userId: number;
      payload: UpdateXProfilePayload;
    }) => {
      if (!token) throw new Error('No authentication token');
      return updateXProfileField(fieldId, userId, token, payload);
    },
    onSuccess: (_, variables) => {
      // Invalidate profile queries to refetch with updated data
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      queryClient.invalidateQueries({ queryKey: profileKeys.member(variables.userId) });
    },
  });
}
