import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveGoogleConfig, loadGoogleConfig, hasGoogleConfigInEnv, getAppEncSecret } from './config';
import fs from 'fs/promises';
import path from 'path';

describe('Google Config Management', () => {
  const testDir = path.join(process.cwd(), 'server/config/secure');
  const encFile = path.join(testDir, 'google.json.enc');
  const secretFile = path.join(testDir, '.app.enc.secret');
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    // Clean environment
    delete process.env.APP_ENC_SECRET;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  });

  afterEach(async () => {
    // Restore environment
    process.env = { ...originalEnv };
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should generate and cache app encryption secret', async () => {
    const secret1 = await getAppEncSecret();
    expect(secret1).toBeDefined();
    expect(secret1.length).toBeGreaterThan(0);
    
    // Should return same secret on subsequent calls
    const secret2 = await getAppEncSecret();
    expect(secret2).toBe(secret1);
    
    // Should be cached in env
    expect(process.env.APP_ENC_SECRET).toBe(secret1);
  });

  it('should save and load Google config with encryption', async () => {
    const config = {
      oauthClientId: 'test-client-id-123',
      oauthClientSecret: 'test-client-secret-456',
      spreadsheetId: 'test-spreadsheet-789',
    };

    await saveGoogleConfig(config);
    
    // Check that encrypted file exists
    const fileExists = await fs.access(encFile).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);
    
    // Load and verify
    const loaded = await loadGoogleConfig();
    expect(loaded).toEqual(config);
  });

  it('should return null when no config exists', async () => {
    const loaded = await loadGoogleConfig();
    expect(loaded).toBeNull();
  });

  it('should correctly detect env-based config', () => {
    expect(hasGoogleConfigInEnv()).toBe(false);
    
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-secret';
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID = 'test-sheet';
    
    expect(hasGoogleConfigInEnv()).toBe(true);
  });

  it('should prefer env config over file', async () => {
    // Save file config
    await saveGoogleConfig({
      oauthClientId: 'file-client-id',
      oauthClientSecret: 'file-client-secret',
      spreadsheetId: 'file-spreadsheet',
    });

    // Set env config
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'env-client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'env-client-secret';
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID = 'env-spreadsheet';

    const loaded = await loadGoogleConfig();
    expect(loaded).toEqual({
      oauthClientId: 'env-client-id',
      oauthClientSecret: 'env-client-secret',
      spreadsheetId: 'env-spreadsheet',
    });
  });

  it('should handle special characters in config values', async () => {
    const config = {
      oauthClientId: 'client-!@#$%^&*()',
      oauthClientSecret: 'secret-你好世界🚀',
      spreadsheetId: 'sheet-<>[]{}|',
    };

    await saveGoogleConfig(config);
    const loaded = await loadGoogleConfig();
    expect(loaded).toEqual(config);
  });
});
