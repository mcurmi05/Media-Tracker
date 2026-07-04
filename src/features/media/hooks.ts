// TanStack Query hooks over the unified media schema. These replace the
// per-media-type context providers (UserLogs/UserBookLogs/etc): one hook per
// activity, filterable by media_type, with optimistic cache updates.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import * as api from "./api";
import type { MediaType, UserLog, UserRating, UserSave } from "./types";

export const mediaKeys = {
  logs: (userId: string) => ["media", "logs", userId] as QueryKey,
  ratings: (userId: string) => ["media", "ratings", userId] as QueryKey,
  saves: (userId: string) => ["media", "saves", userId] as QueryKey,
  watchStatus: (userId: string) => ["media", "watch-status", userId] as QueryKey,
};

const byType = <T extends { entry: { media_type: MediaType } }>(
  rows: T[] | undefined,
  mediaType?: MediaType,
) =>
  mediaType
    ? (rows ?? []).filter((r) => r.entry?.media_type === mediaType)
    : (rows ?? []);

function useUserId() {
  const { user } = useAuth();
  return user?.id ?? null;
}

/* ---------- queries ---------- */

export function useLogs(mediaType?: MediaType) {
  const userId = useUserId();
  const query = useQuery({
    queryKey: mediaKeys.logs(userId ?? "anon"),
    queryFn: () => api.getLogs(userId!),
    enabled: !!userId,
  });
  return { ...query, logs: byType(query.data, mediaType) };
}

export function useRatings(mediaType?: MediaType) {
  const userId = useUserId();
  const query = useQuery({
    queryKey: mediaKeys.ratings(userId ?? "anon"),
    queryFn: () => api.getRatings(userId!),
    enabled: !!userId,
  });
  return { ...query, ratings: byType(query.data, mediaType) };
}

export function useSaves(mediaType?: MediaType) {
  const userId = useUserId();
  const query = useQuery({
    queryKey: mediaKeys.saves(userId ?? "anon"),
    queryFn: () => api.getSaves(userId!),
    enabled: !!userId,
  });
  return { ...query, saves: byType(query.data, mediaType) };
}

/* ---------- mutation factory ---------- */

// All three activity tables mutate the same way: optimistic list update,
// rollback on error, refetch on settle.
function useListMutations<T extends { id: string }>(
  keyFor: (userId: string) => QueryKey,
  fns: {
    create: (row: Partial<T>) => Promise<T>;
    update: (id: string, updates: Partial<T>) => Promise<T>;
    remove: (id: string) => Promise<void>;
  },
) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const key = keyFor(userId ?? "anon");

  const withRollback = <A>(applyLocal: (rows: T[], arg: A) => T[]) => ({
    onMutate: async (arg: A) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<T[]>(key);
      queryClient.setQueryData<T[]>(key, (rows) => applyLocal(rows ?? [], arg));
      return { previous };
    },
    onError: (_err: unknown, _arg: A, ctx?: { previous?: T[] }) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const create = useMutation({
    mutationFn: (row: Partial<T>) => fns.create({ ...row, user_id: userId } as Partial<T>),
    ...withRollback<Partial<T>>((rows, row) => [
      { ...row, id: `optimistic-${Date.now()}` } as T,
      ...rows,
    ]),
  });

  const update = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<T> }) =>
      fns.update(id, updates),
    ...withRollback<{ id: string; updates: Partial<T> }>((rows, { id, updates }) =>
      rows.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    ),
  });

  const remove = useMutation({
    mutationFn: (id: string) => fns.remove(id),
    ...withRollback<string>((rows, id) => rows.filter((r) => r.id !== id)),
  });

  return { create, update, remove };
}

/* ---------- mutations ---------- */

export const useLogMutations = () =>
  useListMutations<UserLog>(mediaKeys.logs, {
    create: api.createLog,
    update: api.updateLog,
    remove: api.deleteLog,
  });

export const useRatingMutations = () =>
  useListMutations<UserRating>(mediaKeys.ratings, {
    create: api.createRating,
    update: api.updateRating,
    remove: api.deleteRating,
  });

export const useSaveMutations = () =>
  useListMutations<UserSave>(mediaKeys.saves, {
    create: api.createSave,
    update: api.updateSave,
    remove: api.deleteSave,
  });
