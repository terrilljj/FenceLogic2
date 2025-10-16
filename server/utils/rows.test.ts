import { describe, it, expect } from 'vitest';
import { parseBool, parseBoolOrUndefined, parseNumber, parsePrice, toStringArray } from './rows';

describe('Row Parsing Utilities', () => {
  describe('parseBool', () => {
    it('should parse truthy values correctly', () => {
      expect(parseBool('true')).toBe(true);
      expect(parseBool('TRUE')).toBe(true);
      expect(parseBool('1')).toBe(true);
      expect(parseBool('yes')).toBe(true);
      expect(parseBool('YES')).toBe(true);
    });

    it('should parse falsy values correctly', () => {
      expect(parseBool('false')).toBe(false);
      expect(parseBool('FALSE')).toBe(false);
      expect(parseBool('0')).toBe(false);
      expect(parseBool('no')).toBe(false);
    });

    it('should return false for empty/blank values', () => {
      expect(parseBool('')).toBe(false);
      expect(parseBool(undefined)).toBe(false);
      expect(parseBool('   ')).toBe(false);
    });
  });

  describe('parseBoolOrUndefined - REGRESSION TEST', () => {
    it('should return undefined for empty/blank values (allows Zod defaults)', () => {
      expect(parseBoolOrUndefined('')).toBeUndefined();
      expect(parseBoolOrUndefined(undefined)).toBeUndefined();
      expect(parseBoolOrUndefined('   ')).toBeUndefined();
    });

    it('should parse truthy values correctly', () => {
      expect(parseBoolOrUndefined('true')).toBe(true);
      expect(parseBoolOrUndefined('TRUE')).toBe(true);
      expect(parseBoolOrUndefined('1')).toBe(true);
      expect(parseBoolOrUndefined('yes')).toBe(true);
    });

    it('should parse falsy values correctly', () => {
      expect(parseBoolOrUndefined('false')).toBe(false);
      expect(parseBoolOrUndefined('FALSE')).toBe(false);
      expect(parseBoolOrUndefined('0')).toBe(false);
      expect(parseBoolOrUndefined('no')).toBe(false);
    });
  });

  describe('parseNumber', () => {
    it('should parse valid numbers', () => {
      expect(parseNumber('123')).toBe(123);
      expect(parseNumber('123.45')).toBe(123.45);
      expect(parseNumber('-10')).toBe(-10);
    });

    it('should return undefined for empty/invalid values', () => {
      expect(parseNumber('')).toBeUndefined();
      expect(parseNumber(undefined)).toBeUndefined();
      expect(parseNumber('   ')).toBeUndefined();
      expect(parseNumber('abc')).toBeUndefined();
    });
  });

  describe('parsePrice', () => {
    it('should convert dollars to cents', () => {
      expect(parsePrice('123.45')).toBe(12345);
      expect(parsePrice('10')).toBe(1000);
      expect(parsePrice('0.99')).toBe(99);
    });

    it('should return undefined for empty values', () => {
      expect(parsePrice('')).toBeUndefined();
      expect(parsePrice(undefined)).toBeUndefined();
    });
  });

  describe('toStringArray', () => {
    it('should split by semicolon or comma', () => {
      expect(toStringArray('a;b;c')).toEqual(['a', 'b', 'c']);
      expect(toStringArray('a,b,c')).toEqual(['a', 'b', 'c']);
      expect(toStringArray('a; b; c')).toEqual(['a', 'b', 'c']);
    });

    it('should filter out empty values', () => {
      expect(toStringArray('a;;b')).toEqual(['a', 'b']);
      expect(toStringArray('a, , b')).toEqual(['a', 'b']);
    });

    it('should return undefined for empty values', () => {
      expect(toStringArray('')).toBeUndefined();
      expect(toStringArray(undefined)).toBeUndefined();
      expect(toStringArray('   ')).toBeUndefined();
    });
  });
});
