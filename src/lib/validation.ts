/**
 * Input Validation Schemas
 * Uses zod for comprehensive input validation to prevent injection attacks
 */

import { z } from 'zod';

/**
 * Validation schema for 6-character redemption codes
 * Only allows uppercase letters and numbers
 */
export const redemptionCodeSchema = z.string()
  .trim()
  .length(6, 'Code must be exactly 6 characters')
  .regex(/^[A-Z0-9]+$/, 'Code must contain only uppercase letters and numbers')
  .transform(s => s.toUpperCase());

/**
 * Validation schema for pack names
 * Allows alphanumeric characters, underscores, and hyphens
 */
export const packNameSchema = z.string()
  .trim()
  .min(1, 'Pack name cannot be empty')
  .max(50, 'Pack name must be less than 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Pack name must contain only letters, numbers, underscores, and hyphens');

/**
 * Validation schema for array of pack names
 */
export const packsArraySchema = z.array(packNameSchema)
  .min(1, 'At least one pack must be specified')
  .max(10, 'Maximum 10 packs allowed');

/**
 * Validation schema for lobby codes
 * 4-8 characters, uppercase letters and numbers only
 */
export const lobbyCodeSchema = z.string()
  .trim()
  .min(4, 'Lobby code must be at least 4 characters')
  .max(8, 'Lobby code must be at most 8 characters')
  .regex(/^[A-Z0-9]+$/, 'Lobby code must contain only uppercase letters and numbers')
  .transform(s => s.toUpperCase());

/**
 * Validation schema for guest/player names
 */
export const playerNameSchema = z.string()
  .trim()
  .min(1, 'Name cannot be empty')
  .max(50, 'Name must be less than 50 characters')
  .regex(/^[a-zA-Z0-9\s_-]+$/, 'Name must contain only letters, numbers, spaces, underscores, and hyphens');

/**
 * Validation schema for Shopify shop domains
 */
export const shopDomainSchema = z.string()
  .trim()
  .regex(/^[a-zA-Z0-9-]+\.myshopify\.com$/, 'Invalid shop domain format')
  .toLowerCase();

/**
 * Validation schema for customer emails (from Shopify)
 */
export const customerEmailSchema = z.string()
  .trim()
  .email('Invalid email format')
  .max(255, 'Email must be less than 255 characters')
  .toLowerCase();

/**
 * Helper function to safely validate and return data
 * Throws with user-friendly error messages if validation fails
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => e.message).join(', ');
      throw new Error(messages);
    }
    throw error;
  }
}
