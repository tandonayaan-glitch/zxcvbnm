/* Platform-wide constants. */

/**
 * The reserved username that bootstraps the MASTER_ADMIN account.
 * Registering this username while no master admin exists creates the master.
 * Configurable via env so the codebase isn't tied to one deployment.
 */
export const MASTER_ADMIN_USERNAME: string = (
  import.meta.env.VITE_MASTER_ADMIN_USERNAME || 'ayaan'
)
  .trim()
  .toLowerCase()
