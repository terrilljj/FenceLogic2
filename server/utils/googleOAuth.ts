import { google } from 'googleapis';
import { loadGoogleConfig, hasGoogleConfigInEnv } from './config';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { systemSettings } from '@shared/schema';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

/**
 * Gets OAuth2 client with current config
 */
async function getOAuth2Client() {
  const config = await loadGoogleConfig();
  
  if (!config) {
    throw new Error('Google OAuth not configured. Please set up credentials in admin settings.');
  }
  
  const { oauthClientId, oauthClientSecret } = config;
  
  return new google.auth.OAuth2(
    oauthClientId,
    oauthClientSecret,
    `${process.env.REPLIT_DOMAINS ? 'https://' + process.env.REPLIT_DOMAINS.split(',')[0] : 'http://localhost:5000'}/api/admin/google/oauth/callback`
  );
}

/**
 * Generates authorization URL for OAuth flow
 */
export async function getAuthUrl(state?: string): Promise<string> {
  const oauth2Client = await getOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: state || 'admin-sheets-sync',
    prompt: 'consent', // Force to get refresh token
  });
}

/**
 * Exchanges authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{ accessToken: string; refreshToken?: string }> {
  const oauth2Client = await getOAuth2Client();
  
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.access_token) {
    throw new Error('No access token received from Google');
  }
  
  // Store refresh token if provided
  if (tokens.refresh_token) {
    await db.insert(systemSettings)
      .values({
        key: 'google_refresh_token',
        value: tokens.refresh_token,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: tokens.refresh_token },
      });
  }
  
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || undefined,
  };
}

/**
 * Gets authorized client using stored refresh token
 */
export async function getAuthorizedClient() {
  const oauth2Client = await getOAuth2Client();
  
  // Get refresh token from database
  const [setting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'google_refresh_token'))
    .limit(1);
  
  if (!setting?.value) {
    throw new Error('No refresh token found. Please connect Google Sheets in admin settings.');
  }
  
  oauth2Client.setCredentials({
    refresh_token: setting.value,
  });
  
  return oauth2Client;
}

/**
 * Checks if OAuth is connected (has refresh token)
 */
export async function isOAuthConnected(): Promise<boolean> {
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'google_refresh_token'))
      .limit(1);
    
    return !!setting?.value;
  } catch {
    return false;
  }
}

/**
 * Gets config source for status reporting
 */
export async function getConfigSource(): Promise<'env' | 'file' | 'missing'> {
  if (hasGoogleConfigInEnv()) {
    return 'env';
  }
  
  const config = await loadGoogleConfig();
  return config ? 'file' : 'missing';
}
