/**
 * Utility functions for input sanitization to prevent XSS.
 */

/**
 * Sanitizes input strings by removing HTML tags and JavaScript script patterns.
 * Suitable for general fields (Name, Room Code, etc.) that will be saved in DB.
 * @param {string} input 
 * @returns {string}
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // 1. Remove script tags
  let cleaned = input.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
  
  // 2. Remove event handlers like onload, onclick, etc.
  cleaned = cleaned.replace(/on\w+=\s*(['"])(.*?)\1/gi, '');
  
  // 3. Remove javascript: pseudo-protocol URIs
  cleaned = cleaned.replace(/javascript:\s*[^\s]*/gi, '');
  
  // 4. Strip any other HTML tags to prevent markup injection
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  return cleaned.trim();
}

/**
 * Escapes HTML special characters for safe output in contexts where raw rendering is needed.
 * @param {string} str 
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
