import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "ccoach_uid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function middleware(req: NextRequest) {
  if (req.cookies.get(COOKIE)) return NextResponse.next();

  const id = crypto.randomUUID();
  const headers = new Headers(req.headers);
  headers.set("cookie", `${req.headers.get("cookie") ?? ""}; ${COOKIE}=${id}`.replace(/^; /, ""));

  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
