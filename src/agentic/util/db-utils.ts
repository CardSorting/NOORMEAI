
/**
 * Utility function to apply a "FOR UPDATE" lock only where supported (Not in SQLite)
 */
export function withLock(query: any, trx: any): any {
  if (!trx || typeof (trx as any).getExecutor !== 'function') {
    // If we're using a mock or a version of Kysely without getExecutor
    // we default to no lock to prevent failures in tests
    return query
  }

  try {
    const executor = (trx as any).getExecutor()
    const adapterName =
      executor?.adapter?.constructor?.name ||
      executor?.dialect?.constructor?.name ||
      ''

    if (adapterName.toLowerCase().includes('sqlite')) {
      return query
    }
  } catch (error) {
    // Fallback if execution fails for some reason
    return query
  }

  return query.forUpdate()
}
