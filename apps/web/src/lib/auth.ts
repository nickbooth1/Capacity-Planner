import { IronSessionOptions } from 'iron-session';
import { sealData, unsealData } from 'iron-session';

export interface SessionData {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string;
    isAdmin: boolean;
  };
}

export const sessionOptions: IronSessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieName: 'capacity-planner-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 86400 * 30, // 30 days
  },
};

export async function getSession(cookies: string): Promise<SessionData> {
  const sessionCookie = parseCookies(cookies)[sessionOptions.cookieName];
  if (!sessionCookie) return {};

  try {
    return await unsealData<SessionData>(sessionCookie, sessionOptions);
  } catch (error) {
    return {};
  }
}

export async function createSession(data: SessionData): Promise<string> {
  const sealed = await sealData(data, sessionOptions);
  return `${sessionOptions.cookieName}=${sealed}; Path=/; ${
    sessionOptions.cookieOptions?.secure ? 'Secure; ' : ''
  }HttpOnly; SameSite=${sessionOptions.cookieOptions?.sameSite || 'Lax'}; Max-Age=${
    sessionOptions.cookieOptions?.maxAge || 86400
  }`;
}

function parseCookies(cookieString: string): Record<string, string> {
  return cookieString.split(';').reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>
  );
}

export function isAdmin(session: SessionData): boolean {
  return session.user?.isAdmin === true;
}
