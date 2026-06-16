import { type NextRequest, NextResponse } from "next/server";

const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "pages.childactor101.com";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (host.endsWith(`.${rootDomain}`)) {
    const slug = host.replace(`.${rootDomain}`, "");
    const url = request.nextUrl.clone();
    url.pathname = `/p/${slug}`;
    return NextResponse.rewrite(url);
  }

  if (host === rootDomain) {
    return NextResponse.next();
  }

  if (host.includes(".")) {
    const url = request.nextUrl.clone();
    url.pathname = `/p/${host}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
