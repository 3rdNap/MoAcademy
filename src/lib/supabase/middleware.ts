import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from "./env";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Refreshes the Supabase auth session on each request so server components see a
 * valid user. When Supabase isn't configured this is a no-op, preserving the
 * zero-config seed-data experience.
 */
export async function updateSession(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touch the session so expired tokens get refreshed via Set-Cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Institution-issued accounts start with a temporary password. Until the
  // user sets their own, funnel every page to the set-password screen. APIs,
  // the auth routes and the set-password page itself are exempt to avoid a
  // redirect loop and to let sign-out / the update call through.
  if (user?.user_metadata?.must_change_password === true) {
    const { pathname } = request.nextUrl;
    const exempt =
      pathname.startsWith("/api") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/logout") ||
      pathname.startsWith("/account/set-password");
    if (!exempt) {
      const target = request.nextUrl.clone();
      target.pathname = "/account/set-password";
      target.search = "";
      return NextResponse.redirect(target);
    }
  }

  return response;
}
