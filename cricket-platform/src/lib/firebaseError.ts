/**
 * Turns a thrown Firebase error into a message worth showing a user. Firestore's own
 * "Missing or insufficient permissions." text doesn't say what to do about it — this
 * catches exactly that case (rules correctly rejected the write) and gives a concrete,
 * actionable reason instead, so a role-gated action never fails silently or crypticly.
 * Falls back to the error's own message for everything else.
 */
export function permissionAwareMessage(
  err: unknown,
  deniedMessage = "You don't have permission to do that.",
): string {
  const code =
    typeof err === 'object' && err && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''
  if (code === 'permission-denied') return deniedMessage
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
}
