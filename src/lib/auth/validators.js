/**
 * Utility functions for user input validation.
 */

/**
 * Validates email format according to standard RFC 5322.
 * @param {string} email 
 * @returns {boolean}
 */
export function validateEmail(email) {
  if (!email) return false;
  // Standard email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Validates password strength:
 * - Length between 8 and 12 characters.
 * - Must contain at least one uppercase letter.
 * - Must contain at least one lowercase letter.
 * - Must contain at least one number.
 * - Must contain at least one special character/symbol.
 * @param {string} password 
 * @returns {{isValid: boolean, errors: string[]}}
 */
export function validatePasswordStrength(password) {
  const errors = [];
  if (!password) {
    errors.push('Password is required.');
    return { isValid: false, errors };
  }

  if (password.length < 8 || password.length > 12) {
    errors.push('Password must be between 8 and 12 characters.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter.');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number.');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special symbol.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates a full name:
 * - Must contain only letters and spaces.
 * - Length at least 2 characters.
 * @param {string} name 
 * @returns {boolean}
 */
export function validateFullName(name) {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  // Allows alphabetic characters and spaces
  const nameRegex = /^[a-zA-Z\s]+$/;
  return nameRegex.test(trimmed);
}

/**
 * Validates if two password fields match.
 * @param {string} password 
 * @param {string} confirmPassword 
 * @returns {boolean}
 */
export function validateConfirmPassword(password, confirmPassword) {
  return password === confirmPassword;
}
