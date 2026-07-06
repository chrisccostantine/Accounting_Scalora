import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '../services/api';

export function useApiQuery<T>(key: unknown[], url: string) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const response = await api.get<ApiResponse<T>>(url);
      return response.data.data;
    }
  });
}

type InvalidationKey = unknown[] | unknown[][];

function invalidateKeys(queryClient: QueryClient, invalidate: InvalidationKey) {
  const keys = Array.isArray(invalidate[0]) ? invalidate as unknown[][] : [invalidate as unknown[]];
  keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
}

export function useSave<TBody>(resource: string, invalidate: InvalidationKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: TBody }) => {
      const response = id ? await api.put(`${resource}/${id}`, body) : await api.post(resource, body);
      return response.data;
    },
    onSuccess: () => invalidateKeys(queryClient, invalidate)
  });
}

export function useDelete(resource: string, invalidate: InvalidationKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`${resource}/${id}`),
    onSuccess: () => invalidateKeys(queryClient, invalidate)
  });
}
