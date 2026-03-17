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
                // Parse the Yahoo OpenID Connect profile
                const yahooGuid = (profile as any)?.sub || "yahoo-user";
                
                console.log('🔍 Yahoo Profile Debug:', {
                    sub: (profile as any)?.sub,
                    email: (profile as any)?.email,
                    name: (profile as any)?.name,
                    nickname: (profile as any)?.nickname,
                });
                
                return {
                    id: yahooGuid,
                    name: (profile as any)?.nickname || (profile as any)?.name || "Yahoo GM",
                    email: (profile as any)?.email || `${yahooGuid}@yahoo-user.placeholder.com`,
                    image: (profile as any)?.picture || "",
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
                    const yahooGuid = (profile as any)?.sub || token.sub;
                    
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
                                    ${(profile as any)?.nickname || (profile as any)?.name},
                                    ${(profile as any)?.email},
                                    ${(profile as any)?.picture || ''},
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
