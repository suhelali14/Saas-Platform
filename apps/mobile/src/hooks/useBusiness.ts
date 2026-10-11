import { useQuery } from "@tanstack/react-query";
import { fetchBusiness } from "../lib/api";

export function useBusiness(id: string) {
  return useQuery({
    queryKey: ["business", id],
    queryFn: () => fetchBusiness(id),
    enabled: Boolean(id),
  });
}
