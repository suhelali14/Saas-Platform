import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendIntentMessage } from "../lib/api";

/**
 * One refinement turn in an Activity chat (docs/04-multi-agent-design.md
 * "Conversational refinement"). Primes the same query key useIntentRequest()
 * reads so the chat thread and match list update from the response
 * immediately instead of waiting on a refetch.
 */
export function useSendIntentMessage(intentRequestId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => sendIntentMessage(intentRequestId, content),
    onSuccess: (data) => {
      queryClient.setQueryData(["intentRequest", intentRequestId], data);
      queryClient.invalidateQueries({ queryKey: ["intentRequests"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    },
  });
}
