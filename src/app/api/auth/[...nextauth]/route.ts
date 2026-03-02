import NextAuth, { NextAuthOptions } from "next-auth";

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
                return {
                    id: userData?.guid || "yahoo-user",
                    name: userData?.nickname || "Yahoo GM",
                    email: `${userData?.guid || "yahoo"}@yahoo-user.placeholder.com`,
                    image: userData?.image_url || "",
                }
            }
        }
    ],
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async jwt({ token, account }) {
            if (account) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
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
