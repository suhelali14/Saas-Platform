import { useQuery } from "@tanstack/react-query";
import { fetchIntentRequest } from "../lib/api";

export function useIntentRequest(id: string) {
  return useQuery({
    queryKey: ["intentRequest", id],
    queryFn: () => fetchIntentRequest(id),
    enabled: Boolean(id),
  });
}
