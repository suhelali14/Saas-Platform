import { useQuery } from "@tanstack/react-query";
import { fetchIntentRequests } from "../lib/api";

export function useIntentRequests() {
  return useQuery({
    queryKey: ["intentRequests"],
    queryFn: fetchIntentRequests,
  });
}
