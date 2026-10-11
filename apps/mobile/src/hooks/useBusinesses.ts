import { useQuery } from "@tanstack/react-query";
import { fetchBusinesses } from "../lib/api";

export function useBusinesses() {
  return useQuery({
    queryKey: ["businesses"],
    queryFn: fetchBusinesses,
  });
}
