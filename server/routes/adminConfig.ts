import { Router } from 'express';
import { z } from 'zod';
import { saveGoogleConfig, loadGoogleConfig, getConfigSource } from '../utils/config';
import { isOAuthConnected, getAuthUrl } from '../utils/googleOAuth';

const router = Router();

const GoogleConfigSchema = z.object({
  oauthClientId: z.string().min(1, 'OAuth client ID is required'),
  oauthClientSecret: z.string().min(1, 'OAuth client secret is required'),
  spreadsheetId: z.string().min(1, 'Spreadsheet ID is required'),
});

/**
 * POST /api/admin/config/google
 * Saves Google OAuth and Sheets configuration (encrypted)
 */
router.post('/google', async (req, res) => {
  try {
    const validated = GoogleConfigSchema.parse(req.body);
    
    await saveGoogleConfig(validated);
    
    res.json({ ok: true });
  } catch (error: any) {
    console.error('[Admin Config] Error saving Google config:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to save configuration',
      details: error.errors,
    });
  }
});

/**
 * GET /api/admin/config/google/status
 * Gets config source and OAuth connection status
 */
router.get('/google/status', async (req, res) => {
  try {
    const source = await getConfigSource();
    const connected = await isOAuthConnected();
    
    res.json({ 
      source,
      connected,
    });
  } catch (error: any) {
    console.error('[Admin Config] Error getting status:', error);
    res.status(500).json({ 
      error: 'Failed to get configuration status',
    });
  }
});

/**
 * GET /api/admin/google/oauth/start
 * Starts OAuth flow
 */
router.get('/google/oauth/start', async (req, res) => {
  try {
    const authUrl = await getAuthUrl('admin-sheets-sync');
    res.redirect(authUrl);
  } catch (error: any) {
    console.error('[Admin OAuth] Error starting OAuth:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to start OAuth flow',
    });
  }
});

/**
 * GET /api/admin/google/oauth/callback
 * OAuth callback handler
 */
router.get('/google/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || typeof code !== 'string') {
      throw new Error('No authorization code received');
    }
    
    const { exchangeCodeForTokens } = await import('../utils/googleOAuth');
    await exchangeCodeForTokens(code);
    
    // Redirect to admin settings page with success
    res.redirect('/admin-settings?oauth=success');
  } catch (error: any) {
    console.error('[Admin OAuth] Error in callback:', error);
    res.redirect('/admin-settings?oauth=error&message=' + encodeURIComponent(error.message));
  }
});

export default router;
