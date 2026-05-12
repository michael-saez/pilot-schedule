export default function middleware(request) {
  const url = new URL(request.url);

  // Allow password page and auth API through
  if (
    url.pathname === "/password.html" ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Check for auth cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const hasAuth = cookieHeader.split(";").some(c => c.trim().startsWith("pilot-auth=ok"));

  if (!hasAuth) {
    return Response.redirect(new URL("/password.html", request.url), 302);
  }
}

export const config = {
  matcher: ["/((?!password.html|api/).*)"],
};
