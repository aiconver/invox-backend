// src/api/methods/user.ts

import { users, generateUniqueId } from '../../utils'; // Import mock data and utility
import { User } from '../../types'; // Import User interface

/**
 * JSON-RPC method for user registration.
 * @param {object} params - The parameters for the method.
 * @param {string} params.username - The username for registration.
 * @param {string} params.password - The password for registration.
 * @returns {{message: string, userId: string}} - Success message and new user ID.
 * @throws {Error} - If username or password are missing, or if username already exists.
 */
export const register = (params: { username: string; password?: string }) => {
  const { username, password } = params;
  if (!username || !password) {
    throw new Error('Username and password are required.');
  }
  if (users.find(user => user.username === username)) {
    throw new Error('Username already exists.');
  }

  const newUser: User = { id: generateUniqueId(), username, password };
  users.push(newUser);
  console.log(`User registered: ${username}`);
  return { message: 'User registered successfully!', userId: newUser.id };
};

/**
 * JSON-RPC method for user login.
 * @param {object} params - The parameters for the method.
 * @param {string} params.username - The username for login.
 * @param {string} params.password - The password for login.
 * @returns {{message: string, token: string}} - Success message and mock JWT token.
 * @throws {Error} - If invalid username or password.
 */
export const login = (params: { username: string; password?: string }) => {
  const { username, password } = params;
  // For mock login, we keep password here. In a real app, you'd hash and compare.
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    console.log(`User logged in: ${username}`);
    // In a real app, you'd generate a proper JWT token here
    return { message: 'Login successful!', token: `mock-jwt-token-${user.id}` };
  } else {
    throw new Error('Invalid username or password.');
  }
};
