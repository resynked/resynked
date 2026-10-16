import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { decrypt } from "@/lib/crypto";
import { consumeBackupCode, verifyCode } from "@/lib/totp";
import { TOO_MANY_ATTEMPTS, TWO_FACTOR_INVALID, TWO_FACTOR_REQUIRED } from "@/lib/constants";
import { LOGIN_LIMIT, clearAttempts, isLocked, registerAttempt } from "@/lib/rate-limit";

/**
 * De tweede stap: een code uit de authenticator-app, of een back-upcode.
 * Een geldige code wordt meteen als gebruikt vastgelegd.
 */
async function checkSecondFactor(user: any, code: string): Promise<boolean> {
  const counter = verifyCode(decrypt(user.totp_secret), code, user.totp_last_counter ?? null);
  if (counter !== null) {
    await supabaseAdmin.from("users").update({ totp_last_counter: counter }).eq("id", user.id);
    return true;
  }

  const remaining = consumeBackupCode(user.totp_backup_codes, code);
  if (remaining) {
    await supabaseAdmin.from("users").update({ totp_backup_codes: remaining }).eq("id", user.id);
    return true;
  }

  return false;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "email@example.com" },
        password: { label: "Password", type: "password" },
        // Alleen bij tweestapsverificatie: de code uit de app of een back-upcode
        code: { label: "Code", type: "text" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Te vaak mis met dit adres: even niets proberen, ook niet met het goede
        // wachtwoord. Zo valt er niets te raden. Fouten buiten de try, zodat de
        // inlogpagina ze ziet
        const attemptKey = `login:${credentials.email.trim().toLowerCase()}`;
        if (await isLocked(attemptKey)) throw new Error(TOO_MANY_ATTEMPTS);

        /** Een mislukte poging: telt mee, en gaat het slot erop, dan zeggen we dat */
        const fail = async (error: string | null) => {
          if (await registerAttempt(attemptKey, LOGIN_LIMIT)) throw new Error(TOO_MANY_ATTEMPTS);
          if (error) throw new Error(error);
          return null;
        };

        let user: any;
        try {
          // Query user from Supabase
          const { data, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', credentials.email)
            .single();

          user = error ? null : data;

          // Verify password
          if (user && !(await bcrypt.compare(credentials.password, user.password_hash))) {
            user = null;
          }
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }

        // Onbekend adres of fout wachtwoord: allebei een mislukte poging
        if (!user) return fail(null);

        // Tweestapsverificatie staat aan: zonder geldige code geen sessie.
        // Deze fouten gaan bewust buiten de try, zodat de inlogpagina ze ziet
        if (user.totp_enabled_at) {
          const code = credentials.code?.trim();
          if (!code) throw new Error(TWO_FACTOR_REQUIRED);
          if (!(await checkSecondFactor(user, code))) return fail(TWO_FACTOR_INVALID);
        }

        await clearAttempts(attemptKey);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenant_id,
          role: user.role,
        };
      }
    })
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.tenantId = (user as any).tenantId;
        token.role = (user as any).role;
      }
      // Na het wijzigen van de naam bij Instellingen: opnieuw uit de database,
      // zodat de zijbalk meteen de nieuwe naam toont. Nooit wat de browser stuurt
      if (trigger === 'update' && token.id) {
        const { data } = await supabaseAdmin.from('users').select('name').eq('id', token.id).single();
        if (data) token.name = data.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).tenantId = token.tenantId as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
