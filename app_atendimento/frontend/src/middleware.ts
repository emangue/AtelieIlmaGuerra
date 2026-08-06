import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Gate de navegação. A autorização de verdade é do backend — isto só evita que
 * alguém deslogado veja a casca das telas piscando antes do redirect.
 *
 * O cookie tem nome próprio (`atendimento_token`) e não colide com o do
 * sistema de gestão.
 */
const COOKIE = "atendimento_token";
const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!request.cookies.has(COOKIE)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Só as rotas de página. Precisa excluir `api` e `uploads`: são rewrites para
   * o backend, e redirecionar essas chamadas para /login faria o fetch receber
   * HTML no lugar de JSON.
   */
  matcher: ["/((?!login|api|uploads|_next/static|_next/image|favicon.ico).*)"],
};
