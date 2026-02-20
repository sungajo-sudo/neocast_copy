import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ndpRouterService } from './ndp-router.service.js';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getNdpAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const { clientId, clientSecret } = config.ndp;
  const authUrl = ndpRouterService.getAuthUrl();
  const url = `${authUrl}/oauth/v2/token?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: '',
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, body: errorText }, 'Failed to get NDP token');
      throw new Error(`Failed to get NDP access token: ${response.status}`);
    }

    const data = (await response.json()) as TokenResponse;
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + data.expires_in * 1000;

    logger.info('NDP access token refreshed');
    return cachedToken;
  } catch (error) {
    logger.error(error, 'Error fetching NDP access token');
    throw error;
  }
}

export function clearNdpTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}
