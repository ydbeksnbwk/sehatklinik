import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Daftar awalan path privat yang wajib memiliki sesi login aktif
const PRIVATE_PATH_PREFIXES = [
  "/dashboard",
  "/dokter-dashboard",
  "/dokter/dashboard",
  "/petugas",
  "/admin",
  "/profil",
  "/kunjungan",
  "/riwayat",
];

const COOKIE_ACCESS_NAME = "sb-access-token";
const COOKIE_REFRESH_NAME = "sb-refresh-token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  try {
    // 1. Proteksi CSRF untuk request mutasi (POST, PUT, PATCH, DELETE)
    const method = request.method.toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const origin = request.headers.get("origin");
      const host = request.headers.get("host");
      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
            return NextResponse.json(
              { error: { code: "FORBIDDEN", message: "Akses CSRF ditolak: Origin tidak cocok" } },
              { status: 403 }
            );
          }
        } catch {
          return NextResponse.json(
            { error: { code: "FORBIDDEN", message: "Akses CSRF ditolak: Origin tidak valid" } },
            { status: 403 }
          );
        }
      }
    }

    // 2. Lewatkan file statis, API publik, dan halaman publik
    const isPrivate = PRIVATE_PATH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

    // Jika bukan halaman privat (misal halaman publik, /api/*), biarkan lanjut
    if (!isPrivate) {
      return NextResponse.next();
    }

    // 3. Verifikasi sesi cookie pada halaman privat
    const accessToken = request.cookies.get(COOKIE_ACCESS_NAME)?.value;
    const refreshToken = request.cookies.get(COOKIE_REFRESH_NAME)?.value;

    if (!accessToken && !refreshToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl, 307);
    }

    // Verifikasi validitas token dengan Supabase Auth
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      let response = NextResponse.next();
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      });

      let user = null;
      if (accessToken) {
        const { data } = await supabase.auth.getUser(accessToken);
        user = data?.user;
      }

      // Jika accessToken invalid tapi ada refreshToken, coba refresh
      if (!user && refreshToken) {
        const { data } = await supabase.auth.refreshSession({
          refresh_token: refreshToken,
        });
        user = data?.user;
      }

      if (!user) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl, 307);
      }

      return response;
    }

    return NextResponse.next();
  } catch (error) {
    // Pertahankan penanganan try/catch agar deployment Vercel tidak mengalami crash/500
    console.error("Middleware error:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image extensions (.svg, .png, .jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
