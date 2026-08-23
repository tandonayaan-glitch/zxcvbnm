/** Firestore document IDs can't contain `/`, so an R2 key (which is a `folder/filename`-
 *  shaped path) needs a 1:1-reversible encoding to become a valid doc id for the
 *  `r2Objects` tracking collection. `~` never appears in a generated filename or a known
 *  folder name, so this is a clean, collision-free substitution — not a hash, so two
 *  different keys can never map to the same tracking doc by coincidence. */
export function keyToObjectId(key: string): string {
  return key.replace(/\//g, '~')
}
