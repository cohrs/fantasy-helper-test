import NextAuth, { NextAuthOptions } from "next-auth";
import { getDb } from "@/lib/db";

const sql = getDb();

export const authOptions: NextAuthOptions = {
    providers: [
        {
            id: "yahoo",
            name: "Yahoo",
            type: "oauth",
            wellKnown: "https://api.login.yahoo.com/.well-known/openid-configuration",
            idToken: true,
            client: {
                id_token_signed_response_alg: "ES256"
            },
            clientId: process.env.YAHOO_CLIENT_ID as string,
            clientSecret: process.env.YAHOO_CLIENT_SECRET as string,
            authorization: {
                url: "https://api.login.yahoo.com/oauth2/request_auth",
                params: {
                    client_id: process.env.YAHOO_CLIENT_ID,
                    response_type: "code",
                }
            },
            token: "https://api.login.yahoo.com/oauth2/get_token",
            userinfo: "https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1?format=json",
            profile(profile) {
                // Parse the weird Yahoo XML-to-JSON structure for user data
                const userData = profile?.fantasy_content?.users?.[0]?.user?.[0];
                
                console.log('🔍 Yahoo Profile Debug:', {
                    hasFantasyContent: !!profile?.fantasy_content,
                    hasUsers: !!profile?.fantasy_content?.users,
                    userData: userData ? 'found' : 'missing',
                    guid: userData?.guid || 'NO GUID',
                    fullProfile: JSON.stringify(profile, null, 2).substring(0, 500)
                });
                
                const yahooGuid = userData?.guid || token?.sub || "yahoo-user";
                
                return {
                    id: yahooGuid,
                    name: userData?.nickname || "Yahoo GM",
                    email: `${yahooGuid}@yahoo-user.placeholder.com`,
                    image: userData?.image_url || "",
                }
            }
        }
    ],
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async jwt({ token, account, profile }) {
            if (account) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.expiresAt = account.expires_at;
                
                // Save tokens to database for server-side use
                if (profile) {
                    const userData = (profile as any)?.fantasy_content?.users?.[0]?.user?.[0];
                    const yahooGuid = userData?.guid || token.sub;
                    
                    console.log('💾 Saving tokens for user:', {
                        yahooGuid,
                        hasAccessToken: !!account.access_token,
                        hasRefreshToken: !!account.refresh_token,
                        expiresAt: account.expires_at
                    });
                    
                    if (yahooGuid) {
                        try {
                            const expiresAt = account.expires_at 
                                ? new Date(account.expires_at * 1000) 
                                : new Date(Date.now() + 3600 * 1000); // Default 1 hour
                            
                            await sql`
                                INSERT INTO users (
                                    yahoo_guid, 
                                    nickname, 
                                    email, 
                                    image_url,
                                    access_token,
                                    refresh_token,
                                    token_expires_at,
                                    updated_at
                                )
                                VALUES (
                                    ${yahooGuid},
                                    ${userData?.nickname || token.name},
                                    ${token.email},
                                    ${userData?.image_url || ''},
                                    ${account.access_token},
                                    ${account.refresh_token},
                                    ${expiresAt},
                                    CURRENT_TIMESTAMP
                                )
                                ON CONFLICT (yahoo_guid) 
                                DO UPDATE SET
                                    access_token = ${account.access_token},
                                    refresh_token = ${account.refresh_token},
                                    token_expires_at = ${expiresAt},
                                    updated_at = CURRENT_TIMESTAMP
                            `;
                            console.log('✅ Saved Yahoo tokens to database for', yahooGuid);
                        } catch (error) {
                            console.error('Failed to save tokens to database:', error);
                        }
                    }
                }
            }
            return token;
        },
        async session({ session, token }) {
            (session as any).accessToken = token.accessToken as string;
            if (session.user) {
                session.user.name = token.name;
            }
            return session;
        }
    }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
