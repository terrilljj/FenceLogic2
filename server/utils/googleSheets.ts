import { google } from 'googleapis';
import { getAuthorizedClient } from './googleOAuth';
import { loadGoogleConfig } from './config';

/**
 * Gets sheet values for a given range
 */
export async function getSheetValues(range: string): Promise<string[][]> {
  try {
    const auth = await getAuthorizedClient();
    const config = await loadGoogleConfig();
    
    if (!config) {
      throw new Error('Google Sheets not configured');
    }
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range,
    });
    
    const values = response.data.values;
    
    if (!values || values.length === 0) {
      return [];
    }
    
    return values as string[][];
  } catch (error: any) {
    console.error('[Sheets] Error reading range:', range, error.message);
    throw new Error(`Failed to read sheet range "${range}": ${error.message}`);
  }
}
