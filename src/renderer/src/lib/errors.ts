/** A user-facing message. IPC errors arrive as "Error invoking remote method 'x': Error: <message>". */
export function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
