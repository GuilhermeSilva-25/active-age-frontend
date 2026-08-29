import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

interface AssinaturaInfo {
  planoNome: string;
  ciclo: "MENSAL" | "ANUAL";
  dataInicio: string;
  proximaCobranca: string;
  diasPlano: number;
}

interface BannerTrialMedicoProps {
  user: {
    id?: string;
    email?: string;
  };
}

export function BannerTrialMedico({ user }: BannerTrialMedicoProps) {
  const [trialRestante, setTrialRestante] = useState({
    dias: 30,
    horas: 0,
    minutos: 0,
    segundos: 0,
    expirado: false,
    percentual: 100,
  });
  const [possuiAssinaturaPaga, setPossuiAssinaturaPaga] = useState(false);
  const [assinaturaAtiva, setAssinaturaAtiva] = useState<AssinaturaInfo | null>(
    null,
  );

  useEffect(() => {
    if (!user) return;

    const chaveTrial = `activeAgeTrial_${user.id || user.email}`;
    let trialInicioStr = localStorage.getItem(chaveTrial);

    if (!trialInicioStr) {
      const agora = Date.now();
      localStorage.setItem(chaveTrial, String(agora));
      trialInicioStr = String(agora);
    }

    const trialInicio = parseInt(trialInicioStr, 10) || Date.now();
    const DURACAO_30_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

    let diasAdicionaisMs = 0;

    if (user && user.assinaturaAtiva === true) {
      diasAdicionaisMs = 30 * 24 * 60 * 60 * 1000;
      setAssinaturaAtiva({
        planoNome: "Plano Profissional Pro",
        ciclo: "MENSAL",
        dataInicio: new Date().toLocaleDateString("pt-BR"),
        proximaCobranca: "",
        diasPlano: 30,
      });
      setPossuiAssinaturaPaga(true);
    } else {
      setAssinaturaAtiva(null);
      setPossuiAssinaturaPaga(false);
    }

    const duracaoTotalMs = DURACAO_30_DIAS_MS + diasAdicionaisMs;
    const trialFim = trialInicio + duracaoTotalMs;

    const calcularTempo = () => {
      const agora = Date.now();
      const diferenca = trialFim - agora;

      if (diferenca <= 0) {
        setTrialRestante({
          dias: 0,
          horas: 0,
          minutos: 0,
          segundos: 0,
          expirado: true,
          percentual: 0,
        });
        return;
      }

      const dias = Math.floor(diferenca / (1000 * 60 * 60 * 24));
      const horas = Math.floor(
        (diferenca % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutos = Math.floor((diferenca % (1000 * 60 * 60)) / (1000 * 60));
      const segundos = Math.floor((diferenca % 1000) / 1000);
      const percentual = Math.max(
        0,
        Math.min(100, (diferenca / duracaoTotalMs) * 100),
      );

      setTrialRestante({
        dias,
        horas,
        minutos,
        segundos,
        expirado: false,
        percentual,
      });
    };

    calcularTempo();
    const interval = setInterval(calcularTempo, 1000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <div className="col-12 mb-4">
      <div
        className="card border-0 shadow-sm overflow-hidden"
        style={{
          borderRadius: "18px",
          background: possuiAssinaturaPaga
            ? "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)"
            : trialRestante.expirado
              ? "linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)"
              : "linear-gradient(135deg, #ffffff 0%, #f4fbf4 100%)",
          borderLeft: possuiAssinaturaPaga
            ? "6px solid var(--aa-green)"
            : trialRestante.expirado
              ? "6px solid #dc3545"
              : "6px solid var(--aa-green)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.06)",
        }}
      >
        <div className="card-body p-4 p-md-5">
          <div className="row align-items-center g-4">
            <div className="col-lg-7 col-xl-7">
              {possuiAssinaturaPaga ? (
                <>
                  <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                    <span
                      className="badge bg-success text-white px-3 py-2 rounded-pill fw-bold"
                      style={{ fontSize: "0.85rem", letterSpacing: "0.5px" }}
                    >
                      <i className="bi bi-patch-check-fill me-1.5"></i>
                      {assinaturaAtiva?.planoNome.toUpperCase() ||
                        "PLANO PROFISSIONAL"}{" "}
                      ATIVO
                    </span>
                    <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-2 small fw-semibold">
                      <i className="bi bi-gift-fill me-1"></i> +30 Dias
                      Degustação Somados
                    </span>
                    <span className="badge bg-light text-dark border rounded-pill px-3 py-2 small">
                      <i className="bi bi-shield-check text-success me-1"></i>{" "}
                      CRM Validado
                    </span>
                  </div>

                  <h3
                    className="fw-bold mb-4 mt-4"
                    style={{ color: "var(--aa-brown)" }}
                  >
                    Consultório Virtual 100% Ativo e Liberado 🚀
                  </h3>
                  <p
                    className="text-muted fs-6 mb-0"
                    style={{ lineHeight: "1.6" }}
                  >
                    Sua assinatura do{" "}
                    <strong>{assinaturaAtiva?.planoNome}</strong> está ativa (
                    {assinaturaAtiva?.ciclo === "ANUAL"
                      ? "Ciclo Anual"
                      : "Ciclo Mensal"}
                    ). O período de 30 dias de degustação gratuita foi
                    automaticamente acumulado ao seu plano.
                  </p>
                </>
              ) : (
                <>
                  <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                    <span className="badge bg-light text-dark border rounded-pill px-3 py-2 small">
                      <i className="bi bi-shield-check text-success me-1"></i>{" "}
                      CRM Validado
                    </span>
                  </div>

                  <h3
                    className="fw-bold mb-2"
                    style={{ color: "var(--aa-brown)" }}
                  >
                    {trialRestante.expirado
                      ? "Seu período de teste encerrou"
                      : "Parabéns! Seu CRM foi aprovado 🎉"}
                  </h3>
                  <p
                    className="text-muted fs-6 mb-4"
                    style={{ lineHeight: "1.6" }}
                  >
                    {trialRestante.expirado
                      ? "Para continuar atendendo seus pacientes, assine o plano do seu consultório."
                      : "Você ganhou 30 dias de degustação gratuita para iniciar seu uso do sistema."}
                  </p>

                  <div className="d-flex flex-wrap gap-2 pt-1">
                    <Link
                      to="/planos-medico"
                      className="btn btn-primary btn-lg px-4 py-2.5 fw-bold shadow-sm d-flex align-items-center gap-2"
                      style={{ borderRadius: "12px" }}
                    >
                      <i className="bi bi-rocket-takeoff-fill"></i> Assinar
                      Consultório Virtual
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* Contador visual horizontal */}
            <div className="col-lg-5 col-xl-5 text-center">
              <div
                className="p-3 p-sm-4 rounded-4 shadow-sm border bg-white"
                style={{
                  borderColor: possuiAssinaturaPaga
                    ? "#bbf7d0"
                    : trialRestante.expirado
                      ? "#fecaca"
                      : "#bbf7d0",
                }}
              >
                <span
                  className="small text-muted fw-bold text-uppercase d-block mb-3"
                  style={{ letterSpacing: "0.5px" }}
                >
                  <i
                    className={`bi ${possuiAssinaturaPaga ? "bi-patch-check-fill text-success" : "bi-clock-history text-primary"} me-1`}
                  ></i>
                  {possuiAssinaturaPaga
                    ? "Tempo Total Somado (Degustação + Plano)"
                    : "Contagem Regressiva do Teste Grátis"}
                </span>

                <div
                  className="d-flex justify-content-center align-items-center mb-3"
                  style={{
                    gap: "6px",
                    flexWrap: "nowrap",
                    whiteSpace: "nowrap",
                  }}
                >
                  {/* Dias */}
                  <div
                    className="text-center rounded-3 p-2 d-flex flex-column align-items-center justify-content-center"
                    style={{
                      backgroundColor: "var(--aa-bg)",
                      border: "1px solid #e5e7eb",
                      width: "68px",
                      minWidth: "68px",
                    }}
                  >
                    <span
                      className="fw-bold mb-0"
                      style={{
                        color: "var(--aa-orange)",
                        fontSize: "1.75rem",
                        lineHeight: "1.1",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {trialRestante.dias.toString().padStart(2, "0")}
                    </span>
                    <small
                      className="text-muted fw-bold text-uppercase mt-1"
                      style={{ fontSize: "0.68rem" }}
                    >
                      Dias
                    </small>
                  </div>
                  <span
                    className="fw-bold text-muted"
                    style={{ fontSize: "1.3rem" }}
                  >
                    :
                  </span>

                  {/* Horas */}
                  <div
                    className="text-center rounded-3 p-2 d-flex flex-column align-items-center justify-content-center"
                    style={{
                      backgroundColor: "var(--aa-bg)",
                      border: "1px solid #e5e7eb",
                      width: "68px",
                      minWidth: "68px",
                    }}
                  >
                    <span
                      className="fw-bold mb-0"
                      style={{
                        color: "var(--aa-brown)",
                        fontSize: "1.75rem",
                        lineHeight: "1.1",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {trialRestante.horas.toString().padStart(2, "0")}
                    </span>
                    <small
                      className="text-muted fw-bold text-uppercase mt-1"
                      style={{ fontSize: "0.68rem" }}
                    >
                      Horas
                    </small>
                  </div>
                  <span
                    className="fw-bold text-muted"
                    style={{ fontSize: "1.3rem" }}
                  >
                    :
                  </span>

                  {/* Minutos */}
                  <div
                    className="text-center rounded-3 p-2 d-flex flex-column align-items-center justify-content-center"
                    style={{
                      backgroundColor: "var(--aa-bg)",
                      border: "1px solid #e5e7eb",
                      width: "68px",
                      minWidth: "68px",
                    }}
                  >
                    <span
                      className="fw-bold mb-0"
                      style={{
                        color: "var(--aa-green)",
                        fontSize: "1.75rem",
                        lineHeight: "1.1",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {trialRestante.minutos.toString().padStart(2, "0")}
                    </span>
                    <small
                      className="text-muted fw-bold text-uppercase mt-1"
                      style={{ fontSize: "0.68rem" }}
                    >
                      Min
                    </small>
                  </div>
                </div>

                <div className="small text-muted py-1 px-2 bg-light rounded-pill border d-inline-block">
                  <i className="bi bi-shield-lock-fill text-success me-1"></i>
                  {possuiAssinaturaPaga
                    ? "Consultório 100% Ativo e Ilimitado"
                    : "Acesso total liberado durante a degustação"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
