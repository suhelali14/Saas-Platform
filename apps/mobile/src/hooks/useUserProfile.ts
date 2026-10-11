import { useQuery } from "@tanstack/react-query";
import { fetchUserProfile } from "../lib/api";

export function useUserProfile() {
  return useQuery({
    queryKey: ["userProfile"],
    queryFn: fetchUserProfile,
  });
}
