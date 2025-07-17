// src/utils/index.ts

import { User, FormData } from '../types'; // Import interfaces from types directory

// --- Mock Data Storage (for demonstration purposes) ---
// In a real application, this data would be managed by a database (e.g., PostgreSQL via Sequelize)
// and these arrays would be replaced by database operations.
export let users: User[] = [];
export let forms: any[] = []; // You might want to define a more specific interface for forms later

/**
 * Generates a simple unique ID string.
 * @returns {string} A unique ID.
 */
export const generateUniqueId = (): string => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
