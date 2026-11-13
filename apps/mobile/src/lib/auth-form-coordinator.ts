import { createExclusiveMutationGate } from "./exclusive-mutation-gate";

export type AuthFormSubmission = {
  authenticate: () => Promise<void>;
  onSuccess: () => void;
  onError: (error: unknown) => void;
  onSettled: () => void;
};

/**
 * Prevent repeated sign-in/registration taps before React's busy state renders.
 * Suppress stale UI callbacks after screen unmount/navigation.
 *
 * This does not cancel an already-started server request or replace the
 * AuthProvider's epoch-based session invalidation.
 */
export function createAuthFormCoordinator() {
  const gate = createExclusiveMutationGate();
  let active = true;
  return {
    get isBusy() {
      return gate.isBusy;
    },
    invalidate() {
      active = false;
    },
    async submit(options: AuthFormSubmission): Promise<{ started: boolean }> {
      if (!active) return { started: false };
      return gate
        .run(async () => {
          try {
            await options.authenticate();
            if (active) options.onSuccess();
          } catch (error) {
            if (active) options.onError(error);
          } finally {
            if (active) options.onSettled();
          }
        })
        .then(({ started }) => ({ started }));
    },
  };
}
