import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const authHeaders = new Headers();
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return response;
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values, headers) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          Object.entries(headers).forEach(([name, value]) =>
            authHeaders.set(name, value),
          );
          const next = NextResponse.next({ request, headers: authHeaders });
          response.cookies
            .getAll()
            .forEach((cookie) => next.cookies.set(cookie));
          values.forEach(({ name, value, options }) =>
            next.cookies.set(name, value, options),
          );
          response = next;
        },
      },
    },
  );
  const { data } = await client.auth.getClaims();
  if (!data?.claims && request.nextUrl.pathname.startsWith("/workspace")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    const login = NextResponse.redirect(url, { headers: authHeaders });
    response.cookies.getAll().forEach((cookie) => login.cookies.set(cookie));
    return login;
  }
  // Pages enforce private access. Public browsing and auth routes stay open.
  return response;
}
