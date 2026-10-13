/**
 * Interceptor global do fetch para o Active Age.
 * Injeta automaticamente o token JWT salvo no localStorage ("activeAgeToken")
 * em todas as requisições para a API do backend (/api ou active-age-backend).
 * 
 * Remove também cabeçalhos inválidos como "Bearer null" ou "Bearer undefined".
 */

export function setupAuthFetchInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = localStorage.getItem("activeAgeToken");
    const headers = new Headers(init.headers || {});

    const url = typeof input === "string" 
      ? input 
      : input instanceof Request 
        ? input.url 
        : input.toString();

    const isApiRequest = url.includes("active-age-backend") || url.includes("/api/");

    if (isApiRequest) {
      const currentAuth = headers.get("Authorization");

      if (token && token !== "null" && token !== "undefined") {
        if (!currentAuth || currentAuth === "Bearer null" || currentAuth === "Bearer undefined") {
          headers.set("Authorization", `Bearer ${token}`);
        }
      } else {
        // Se não há token válido, garante que não enviamos "Bearer null"
        if (currentAuth === "Bearer null" || currentAuth === "Bearer undefined") {
          headers.delete("Authorization");
        }
      }
    }

    const response = await originalFetch(input, { ...init, headers });

    // Se o backend responder 401 (token expirado ou inválido) e o usuário estava logado, limpa e redireciona
    if (response.status === 401 && token) {
      console.warn("[ActiveAge] Token expirado ou não autorizado. Redirecionando para login...");
      localStorage.removeItem("activeAgeToken");
      localStorage.removeItem("activeAgeUser");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }

    return response;
  };
}
