import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "ccoach_uid";
const FORWARDED_USER_HEADER = "x-ccoach-uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  const existingId = req.cookies.get(COOKIE)?.value;
  const id = existingId ?? crypto.randomUUID();

  if (!existingId && (req.method === "GET" || req.method === "HEAD")) {
    const res = NextResponse.redirect(req.nextUrl);
    res.cookies.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR,
      path: "/",
    });
    return res;
  }

  const headers = new Headers(req.headers);
  headers.set(FORWARDED_USER_HEADER, id);
  headers.set(
    "cookie",
    `${req.headers.get("cookie") ?? ""}; ${COOKIE}=${id}`.replace(/^; /, ""),
  );

  const res = NextResponse.next({ request: { headers } });
  if (!existingId) {
    res.cookies.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR,
      path: "/",
    });
  }
  return res;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
