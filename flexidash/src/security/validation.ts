/**
 * FlexiDash Server Boundary Input Validation & Sanitization
 *
 * Enforces strict input validation on all request parameters, query strings,
 * and payloads entering the API boundary.
 */

import { ValidationError } from '../errors/app-error.ts';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function validateEmail(email: unknown): string {
  if (typeof email !== 'string') {
    throw new ValidationError('Email address must be a string');
  }
  const trimmed = email.trim();
  if (!trimmed) {
    throw new ValidationError('Email address cannot be empty');
  }
  if (trimmed.length > 254) {
    throw new ValidationError('Email address exceeds maximum length of 254 characters');
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    throw new ValidationError('Invalid email address format');
  }
  return trimmed.toLowerCase();
}

export function validatePassword(password: unknown, minLength = 8): string {
  if (typeof password !== 'string') {
    throw new ValidationError('Password must be a string');
  }
  if (password.length < minLength) {
    throw new ValidationError(`Password must be at least ${minLength} characters in length`);
  }
  if (password.length > 128) {
    throw new ValidationError('Password exceeds maximum length of 128 characters');
  }
  return password;
}

export function validatePagination(
  rawPage: unknown,
  rawLimit: unknown
): { page: number; limit: number } {
  let page = 1;
  let limit = 20;

  if (rawPage !== undefined && rawPage !== null && rawPage !== '') {
    const parsedPage = Number(rawPage);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      throw new ValidationError('Page must be a positive integer greater than or equal to 1');
    }
    page = parsedPage;
  }

  if (rawLimit !== undefined && rawLimit !== null && rawLimit !== '') {
    const parsedLimit = Number(rawLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      throw new ValidationError('Limit must be an integer between 1 and 100');
    }
    limit = parsedLimit;
  }

  return { page, limit };
}

export function validateDateString(val: unknown, fieldName: string): string | undefined {
  if (val === undefined || val === null || val === '') {
    return undefined;
  }
  if (typeof val !== 'string') {
    throw new ValidationError(`${fieldName} must be a valid date string`);
  }
  const timestamp = Date.parse(val);
  if (Number.isNaN(timestamp)) {
    throw new ValidationError(`${fieldName} is not a valid ISO date string`);
  }
  return new Date(timestamp).toISOString();
}

export function sanitizeString(val: unknown, fieldName: string, maxLength = 256): string {
  if (typeof val !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }
  const trimmed = val.trim();
  if (trimmed.length > maxLength) {
    throw new ValidationError(`${fieldName} exceeds maximum length of ${maxLength} characters`);
  }
  return trimmed;
}

