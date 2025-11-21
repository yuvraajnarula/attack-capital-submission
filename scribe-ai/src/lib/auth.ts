import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";


export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  account: {
    additionalFields: {
      type: {
        type: "string",
        required: true,
        defaultValue: "credential"
      }
    }
  },
  trustHost: true,
});

// Types
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;

export const verifySession = async (request: Request): Promise<{ user: User; session: Session } | null> => {
  const authHeader = request.headers.get('authorization');
  const sessionToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : request.headers.get('x-session-token')
    || new URL(request.url).searchParams.get('sessionToken');

  if (!sessionToken) {
    return null;
  }

  try {
    const session = await auth.api.getSession({
      headers: new Headers({
        'cookie': `better-auth.session_token=${sessionToken}`
      })
    });

    if (!session?.session || !session?.user) {
      return null;
    }

    return {
      user: session.user,
      session: session.session
    };
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
};

export const authMiddleware = {
  requireAuth: async (request: Request) => {
    const session = await verifySession(request);

    if (!session) {
      throw new Error('Unauthorized - No valid session');
    }

    return session;
  },
  optionalAuth: async (request: Request) => {
    return await verifySession(request);
  }
};

export const authUtils = {
  getCurrentUser: async (request: Request): Promise<User | null> => {
    const session = await verifySession(request);
    return session?.user || null;
  },

  isAuthenticated: async (request: Request): Promise<boolean> => {
    const session = await verifySession(request);
    return !!session;
  },

  getUserId: async (request: Request): Promise<string | null> => {
    const session = await verifySession(request);
    return session?.user.id || null;
  }
};