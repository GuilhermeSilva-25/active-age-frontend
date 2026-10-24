import Swal from "sweetalert2";

/**
 * Interceptor global do fetch para o Active Age.
 * Injeta automaticamente o token JWT salvo no localStorage ("activeAgeToken")
 * em todas as requisições para a API do backend principal.
 * 
 * Evita redirecionamentos repentinos ("sem falar nada") e ignora requisições
 * de pagamentos, Mercado Pago e chamadas em segundo plano.
 */

let isShowingExpiredModal = false;

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

    // Apenas requisições direcionadas ao backend Active Age
    const isMercadoPago = url.includes("mercadopago.com");
    const isMicroservicoLocal = url.includes("localhost:8081");
    const isBackendActiveAge = url.includes("active-age-backend") || url.startsWith("/api/");
    const isApiRequest = isBackendActiveAge && !isMercadoPago && !isMicroservicoLocal;

    if (isApiRequest) {
      const currentAuth = headers.get("Authorization");

      if (token && token !== "null" && token !== "undefined") {
        if (!currentAuth || currentAuth === "Bearer null" || currentAuth === "Bearer undefined") {
          headers.set("Authorization", `Bearer ${token}`);
        }
      } else {
        if (currentAuth === "Bearer null" || currentAuth === "Bearer undefined") {
          headers.delete("Authorization");
        }
      }
    }

    const response = await originalFetch(input, { ...init, headers });

    // Verifica se a requisição solicitou ignorar redirecionamento automático de 401
    const ignoreAuthRedirect = 
      headers.get("X-Ignore-Auth-Redirect") === "true" ||
      headers.get("x-ignore-auth-redirect") === "true" ||
      url.includes("/marcar/") ||
      url.includes("confirmar-pagamento") ||
      url.includes("/payments/") ||
      isMercadoPago ||
      isMicroservicoLocal;

    // Se o backend responder 401 e for uma requisição principal que exige autenticação
    if (response.status === 401 && token && !ignoreAuthRedirect && !isShowingExpiredModal) {
      isShowingExpiredModal = true;
      console.warn("[ActiveAge] Token expirado ou não autorizado:", url);

      Swal.fire({
        icon: "warning",
        title: "Sua Sessão Expirou",
        text: "Por segurança, seu acesso precisa ser renovado. Faça login novamente para prosseguir.",
        confirmButtonText: "Ir para o Login",
        confirmButtonColor: "#0077b6",
        allowOutsideClick: false,
      }).then(() => {
        localStorage.removeItem("activeAgeToken");
        localStorage.removeItem("activeAgeUser");
        isShowingExpiredModal = false;
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/login";
        }
      });
    }

    return response;
  };
}
