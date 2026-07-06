import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useSave<TBody>(resource: string, invalidate: unknown[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: TBody }) => {
      const response = id ? await api.put(`${resource}/${id}`, body) : await api.post(resource, body);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invalidate })
  });
}

export function useDelete(resource: string, invalidate: unknown[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`${resource}/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invalidate })
  });
}
