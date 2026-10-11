import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitIntentRequest } from "../lib/api";

/**
 * Wraps the submit mutation and primes the intentRequest query cache with
 * the response, keyed the same way useIntentRequest() reads it -- so
 * navigating straight to the Results screen after a submit renders
 * instantly from cache instead of re-fetching what we just received.
 */
export function useSubmitIntent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitIntentRequest,
    onSuccess: (data) => {
      queryClient.setQueryData(["intentRequest", data.intentRequest.id], data);
      queryClient.invalidateQueries({ queryKey: ["intentRequests"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
  });
}
