/**
 * CSRF Utility Functions
 * 
 * Helper functions for working with CSRF tokens in Astro pages and API routes.
 * 
 * Requirements: 19.4 - CSRF protection
 */

import type { AstroCookies } from 'astro';
import { getCSRFToken } from '../middleware/csrf';

/**
 * Get CSRF token for use in forms and AJAX requests
 * 
 * This function retrieves the CSRF token from cookies or generates a new one.
 * Use this in Astro pages to include CSRF tokens in forms.
 * 
 * @param cookies - Astro cookies object from context
 * @returns CSRF token string
 * 
 * @example
 * ```astro
 * ---
 * import { getCSRF } from '@/utils/csrf';
 * const csrfToken = getCSRF(Astro.cookies);
 * ---
 * 
 * <form method="POST">
 *   <input type="hidden" name="csrf_token" value={csrfToken} />
 *   <!-- other form fields -->
 * </form>
 * ```
 */
export function getCSRF(cookies: AstroCookies): string {
  return getCSRFToken(cookies);
}

/**
 * Generate HTML for CSRF token hidden input field
 * 
 * Convenience function to generate the HTML for a CSRF token hidden input.
 * 
 * @param cookies - Astro cookies object from context
 * @returns HTML string for hidden input field
 * 
 * @example
 * ```astro
 * ---
 * import { csrfInput } from '@/utils/csrf';
 * ---
 * 
 * <form method="POST">
 *   <Fragment set:html={csrfInput(Astro.cookies)} />
 *   <!-- other form fields -->
 * </form>
 * ```
 */
export function csrfInput(cookies: AstroCookies): string {
  const token = getCSRFToken(cookies);
  return `<input type="hidden" name="csrf_token" value="${token}" />`;
}

/**
 * Create fetch headers with CSRF token
 * 
 * Helper to create headers object with CSRF token for AJAX requests.
 * 
 * @param token - CSRF token
 * @param additionalHeaders - Additional headers to include
 * @returns Headers object with CSRF token
 * 
 * @example
 * ```javascript
 * const headers = createCSRFHeaders(csrfToken, {
 *   'Content-Type': 'application/json'
 * });
 * 
 * fetch('/api/endpoint', {
 *   method: 'POST',
 *   headers,
 *   body: JSON.stringify(data)
 * });
 * ```
 */
export function createCSRFHeaders(
  token: string,
  additionalHeaders: Record<string, string> = {}
): Record<string, string> {
  return {
    'X-CSRF-Token': token,
    ...additionalHeaders,
  };
}

/**
 * Client-side helper to get CSRF token from cookie
 * 
 * This function can be used in client-side JavaScript to retrieve
 * the CSRF token from the cookie for AJAX requests.
 * 
 * Note: The CSRF token cookie is HttpOnly, so this will NOT work
 * client-side. Instead, the token should be passed to the client
 * via a data attribute or inline script.
 * 
 * @returns CSRF token or null if not found
 * 
 * @example
 * ```astro
 * <div id="app" data-csrf-token={csrfToken}></div>
 * 
 * <script>
 *   const csrfToken = document.getElementById('app').dataset.csrfToken;
 *   // Use csrfToken in AJAX requests
 * </script>
 * ```
 */
export function getClientCSRFToken(): string | null {
  // This is a placeholder for documentation purposes
  // In practice, pass the token via data attribute or inline script
  console.warn('CSRF token cookie is HttpOnly. Pass token via data attribute.');
  return null;
}
