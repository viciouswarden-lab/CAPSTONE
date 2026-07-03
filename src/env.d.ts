/// <reference types="astro/client" />

/**
 * Astro environment type definitions
 * 
 * Extends Astro's built-in types with custom properties.
 */

import type { SessionData } from './services/session';

declare namespace App {
  interface Locals {
    session?: SessionData;
    userId?: string;
    userEmail?: string;
    userRole?: string;
  }
}
