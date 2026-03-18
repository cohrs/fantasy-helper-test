import { getDb } from './db';

const sql = getDb();

interface YahooTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}

/**
 * Get a valid Yahoo access token for a user, refreshing if necessary
 */
export async function getYahooAccessToken(yahooGuid: string): Promise<string | null> {
    try {
        // Handle legacy "yahoo" guid by trying "yahoo-user" as fallback
        let guid = yahooGuid;
        
        // Get user's tokens from database
        let result = await sql`
            SELECT access_token, refresh_token, token_expires_at
            FROM users
            WHERE yahoo_guid = ${guid}
        `;

        // If not found and guid is "yahoo", try "yahoo-user"
        if (!result.length && guid === 'yahoo') {
            console.log('⚠️  User "yahoo" not found, trying "yahoo-user" as fallback');
            guid = 'yahoo-user';
            result = await sql`
                SELECT access_token, refresh_token, token_expires_at
                FROM users
                WHERE yahoo_guid = ${guid}
            `;
        }

        if (!result.length) {
            console.error('No tokens found for user:', yahooGuid);
            return null;
        }

        const user = result[0];
        const expiresAt = new Date(user.token_expires_at);
        const now = new Date();

        // If token is still valid (with 5 minute buffer), return it
        if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
            return user.access_token;
        }

        // Token expired, refresh it
        console.log('🔄 Refreshing Yahoo access token for', yahooGuid);
        
        const refreshToken = user.refresh_token;
        if (!refreshToken) {
            console.error('No refresh token available for user:', yahooGuid);
            return null;
        }

        const newTokens = await refreshYahooToken(refreshToken);
        if (!newTokens) {
            return null;
        }

        // Save new tokens to database
        await sql`
            UPDATE users
            SET 
                access_token = ${newTokens.accessToken},
                refresh_token = ${newTokens.refreshToken},
                token_expires_at = ${newTokens.expiresAt},
                updated_at = CURRENT_TIMESTAMP
            WHERE yahoo_guid = ${guid}
        `;

        console.log('✅ Refreshed and saved new tokens for', guid);
        return newTokens.accessToken;

    } catch (error) {
        console.error('Error getting Yahoo access token:', error);
        return null;
    }
}

/**
 * Refresh a Yahoo access token using a refresh token
 */
async function refreshYahooToken(refreshToken: string): Promise<YahooTokens | null> {
    try {
        const clientId = process.env.YAHOO_CLIENT_ID;
        const clientSecret = process.env.YAHOO_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('Yahoo credentials not configured');
        }

        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const response = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Yahoo token refresh failed:', response.status, errorText);
            return null;
        }

        const data = await response.json();

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || refreshToken, // Yahoo may return new refresh token
            expiresAt: new Date(Date.now() + data.expires_in * 1000),
        };

    } catch (error) {
        console.error('Error refreshing Yahoo token:', error);
        return null;
    }
}

/**
 * Get Yahoo access token for the default user (for scripts)
 * Uses the most recently updated user
 */
export async function getDefaultYahooAccessToken(): Promise<string | null> {
    try {
        // Get the most recently updated user (assumes single user for now)
        const result = await sql`
            SELECT yahoo_guid
            FROM users
            ORDER BY updated_at DESC
            LIMIT 1
        `;

        if (!result.length) {
            console.error('No users found in database');
            return null;
        }

        return getYahooAccessToken(result[0].yahoo_guid);

    } catch (error) {
        console.error('Error getting default Yahoo access token:', error);
        return null;
    }
}

/**
 * Get Yahoo access token for a specific user by email
 */
export async function getYahooAccessTokenByEmail(email: string): Promise<string | null> {
    try {
        const result = await sql`
            SELECT yahoo_guid
            FROM users
            WHERE email = ${email}
        `;

        if (!result.length) {
            console.error('User not found:', email);
            return null;
        }

        return getYahooAccessToken(result[0].yahoo_guid);

    } catch (error) {
        console.error('Error getting Yahoo access token by email:', error);
        return null;
    }
}

/**
 * List all users with saved tokens
 */
export async function listYahooUsers(): Promise<Array<{ yahooGuid: string; nickname: string; email: string; hasToken: boolean }>> {
    try {
        const result = await sql`
            SELECT yahoo_guid, nickname, email, 
                   (access_token IS NOT NULL) as has_token
            FROM users
            ORDER BY updated_at DESC
        `;

        return result.map((row: any) => ({
            yahooGuid: row.yahoo_guid,
            nickname: row.nickname || 'Unknown',
            email: row.email || 'Unknown',
            hasToken: row.has_token
        }));

    } catch (error) {
        console.error('Error listing Yahoo users:', error);
        return [];
    }
}
