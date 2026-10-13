import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";
import { BannerTrialMedico } from "../components/BannerTrialMedico";
import { ModalPagamentoMercadoPago } from "../components/pagamento/ModalPagamentoMercadoPago";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: "PACIENTE" | "MEDICO" | "ADMIN";
  crm?: string;
  statusValidacao?: string;
  mensagemValidacao?: string;
}

interface Agendamento {
  id: string;
  dataHora: string;
  status: string;
  linkTeleconsulta?: string;
  medicoNome?: string;
  medicoCrm?: string;
  medicoEspecializacao?: string;
  pacienteNome?: string;
  medicoId?: string;
  notaAvaliacao?: number;
  comentarioAvaliacao?: string;
  valor?: number;
  valorPago?: number;
  dataPagamento?: string;
  metodoPagamento?: string;
  transacaoPagamentoId?: string;
  statusReembolso?: string;
  idReembolso?: string;
  dataReembolso?: string;
  valorReembolsado?: number;
  motivoCancelamento?: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<Usuario | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [pedidosAdmin, setPedidosAdmin] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reciboVisualizado, setReciboVisualizado] = useState<Agendamento | null>(null);
  const [consultaParaPagar, setConsultaParaPagar] = useState<Agendamento | null>(null);
  const extratoRef = useRef<HTMLDivElement>(null);

  const historicoRef = useRef<HTMLDivElement>(null);
  const agendaPacienteRef = useRef<HTMLDivElement>(null);
  const agendaMedicoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("activeAgeUser");
    if (!userStr) {
      navigate("/login");
      return;
    }
    const usuarioLogado: Usuario = JSON.parse(userStr);

    if (usuarioLogado.tipo === "MEDICO" && !usuarioLogado.statusValidacao) {
      usuarioLogado.statusValidacao = "PENDENTE";
    }
    setUser(usuarioLogado);
    if (usuarioLogado.tipo === "ADMIN") carregarPendentes();
    else carregarDados(usuarioLogado);

    // ========================================================
    // PROCESSAMENTO DO RETORNO DE PAGAMENTO DO MERCADO PAGO
    // ========================================================
    const urlParams = new URLSearchParams(window.location.search);
    const mpStatus =
      urlParams.get("status") || urlParams.get("collection_status");
    const mpPaymentId =
      urlParams.get("payment_id") ||
      urlParams.get("collection_id") ||
      `MP-${Date.now()}`;
    const mpItemId = urlParams.get("item_id");
    const mpTipo = urlParams.get("tipo");

    if (mpStatus === "approved") {
      let pagamentoPendente: any = null;
      try {
        const salvo = localStorage.getItem("activeAgeUltimoPagamento");
        if (salvo) pagamentoPendente = JSON.parse(salvo);
      } catch (e) {
        console.error("Erro ao ler pagamento pendente:", e);
      }

      const itemId = mpItemId || pagamentoPendente?.itemId;
      const tipoItem = mpTipo || pagamentoPendente?.tipoItem;
      const valorEsperado = Number(pagamentoPendente?.valor || 180);
      const refId =
        tipoItem === "CONSULTA" ||
          (!tipoItem && usuarioLogado.tipo === "PACIENTE")
          ? `AGEND-${itemId}`
          : `MED-${pagamentoPendente?.medicoId || usuarioLogado.id}`;

      // Validação de segurança: checar status e valor com Mercado Pago
      const validarEConfirmar = async () => {
        let aprovadoVerificado = false;
        let valorRealPago = valorEsperado;

        try {
          const resp = await fetch(
            `http://localhost:8081/api/payments/verify?referenceId=${encodeURIComponent(
              refId
            )}&paymentId=${encodeURIComponent(
              mpPaymentId
            )}&expectedAmount=${valorEsperado}`
          );
          if (resp.ok) {
            const data = await resp.json();
            if (data.valid) {
              aprovadoVerificado = true;
              valorRealPago = data.amountPaid || valorEsperado;
            }
          }
        } catch (e) {
          // Fallback caso microserviço esteja offline
          aprovadoVerificado = Boolean(mpPaymentId && !mpPaymentId.startsWith("MP-"));
        }

        if (!aprovadoVerificado) {
          Swal.fire({
            icon: "warning",
            title: "Aguardando Confirmação do Mercado Pago",
            text: "O pagamento ainda não foi identificado como aprovado pelo Mercado Pago. Por favor, conclua a transação.",
            confirmButtonColor: "#009ee3",
          });
          return;
        }

        // Se estiver rodando dentro do iframe integrado, notifica a janela principal
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            { type: "MERCADO_PAGO_APPROVED", paymentId: mpPaymentId },
            "*"
          );
        }

        if (itemId) {
          if (
            tipoItem === "CONSULTA" ||
            (!tipoItem && usuarioLogado.tipo === "PACIENTE")
          ) {
            // Confirmar teleconsulta
            const endpointMarcar = `https://active-age-backend.onrender.com/api/agendamentos/marcar/${itemId}/paciente/${usuarioLogado.id}`;
            const endpointConfirmar = `https://active-age-backend.onrender.com/api/agendamentos/${itemId}/confirmar-pagamento`;

            fetch(endpointMarcar, { method: "PUT" })
              .catch(() => null)
              .finally(() => {
                fetch(endpointConfirmar, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    transacaoId: mpPaymentId,
                    metodo: "Mercado Pago",
                    valorPago: valorRealPago,
                    dataPagamento: new Date().toISOString(),
                  }),
                })
                  .then(() => {
                    Swal.fire({
                      icon: "success",
                      title: "Pagamento Aprovado no Mercado Pago!",
                      text: "Sua teleconsulta foi confirmada e sua sala virtual está liberada!",
                      confirmButtonColor: "var(--aa-green)",
                    });
                    carregarDados(usuarioLogado);
                  })
                  .catch((err) => {
                    console.error("Erro ao confirmar pagamento retornado:", err);
                  });
              });
          } else {
            // Ativar plano do médico
            const medicoId = pagamentoPendente?.medicoId || usuarioLogado.id;
            fetch(
              `https://active-age-backend.onrender.com/api/usuarios/medicos/MED-${medicoId}/assinatura/ativar`,
              {
                method: "PUT",
              }
            )
              .then(() => {
                Swal.fire({
                  icon: "success",
                  title: "Assinatura Ativada!",
                  text: "Seu plano foi ativado com sucesso pelo Mercado Pago!",
                  confirmButtonColor: "var(--aa-green)",
                });
                carregarDados(usuarioLogado);
              })
              .catch((err) => {
                console.error("Erro ao ativar assinatura retornada:", err);
              });
          }
        } else {
          Swal.fire({
            icon: "success",
            title: "Pagamento Concluído!",
            text: "Seu pagamento via Mercado Pago foi processado com sucesso.",
            confirmButtonColor: "var(--aa-green)",
          });
          carregarDados(usuarioLogado);
        }

        localStorage.removeItem("activeAgeUltimoPagamento");
        window.history.replaceState({}, document.title, window.location.pathname);
      };

      validarEConfirmar();
    } else if (mpStatus === "failure" || mpStatus === "rejected") {
      Swal.fire({
        icon: "error",
        title: "Pagamento Não Concluído",
        text: "O pagamento no Mercado Pago foi cancelado ou recusado.",
        confirmButtonColor: "#009ee3",
      });
      localStorage.removeItem("activeAgeUltimoPagamento");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (mpStatus === "pending" || mpStatus === "in_process") {
      Swal.fire({
        icon: "info",
        title: "Pagamento Pendente",
        text: "Seu pagamento no Mercado Pago está sendo processado. Assim que aprovado, sua consulta será liberada.",
        confirmButtonColor: "#009ee3",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    let intervaloRef: ReturnType<typeof setInterval> | null = null;

    const checarNovidades = () => {
      // Se o token sumiu (logout manual ou expirado), para o polling imediatamente
      const tokenAtual = localStorage.getItem("activeAgeToken");
      if (!tokenAtual) {
        if (intervaloRef) clearInterval(intervaloRef);
        navigate("/login");
        return;
      }

      fetch(
        `https://active-age-backend.onrender.com/api/usuarios/${usuarioLogado.id}`,
      )
        .then((res) => {
          // 401 = token rejeitado pelo backend, para o polling sem duplicar o redirect do interceptor
          if (res.status === 401) {
            if (intervaloRef) clearInterval(intervaloRef);
            return null;
          }
          if (!res.ok) return null;
          return res.json();
        })
        .then((dadosFresquinhos) => {
          if (!dadosFresquinhos) return;
          if (
            dadosFresquinhos.tipo === "MEDICO" &&
            !dadosFresquinhos.statusValidacao
          ) {
            dadosFresquinhos.statusValidacao = "PENDENTE";
          }

          const estadoAtual = JSON.parse(
            localStorage.getItem("activeAgeUser") || "{}",
          );

          const mudouValidacao =
            estadoAtual.statusValidacao !== dadosFresquinhos.statusValidacao;
          const mudouAssinatura =
            estadoAtual.assinaturaAtiva !== dadosFresquinhos.assinaturaAtiva;

          if (mudouValidacao || mudouAssinatura) {
            localStorage.setItem(
              "activeAgeUser",
              JSON.stringify(dadosFresquinhos),
            );
            setUser(dadosFresquinhos);

            // Só recarrega agendamentos quando houve mudança real
            if (usuarioLogado.tipo !== "ADMIN") {
              carregarDados(usuarioLogado);
            } else {
              carregarPendentes();
            }
          }
        })
        .catch(() => {
          // Servidor em cold-start ou offline momentaneamente
        });
    };

    checarNovidades();

    intervaloRef = setInterval(checarNovidades, 10000);

    return () => {
      if (intervaloRef) clearInterval(intervaloRef);
    };
  }, [navigate]);

  const carregarDados = async (u: Usuario) => {
    try {
      const rota =
        u.tipo === "PACIENTE" ? `paciente/${u.id}` : `medico/${u.id}/todos`;
      const res = await fetch(
        `https://active-age-backend.onrender.com/api/agendamentos/${rota}`,
      );
      if (res.ok) {
        const data = await res.json();
        setAgendamentos((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(data)) {
            return data;
          }
          return prev;
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const carregarPendentes = async () => {
    try {
      const res = await fetch(
        "https://active-age-backend.onrender.com/api/validacoes/pendentes",
      );
      if (res.ok) {
        const data = await res.json();
        setPedidosAdmin((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(data)) {
            return data;
          }
          return prev;
        });
      }
    } catch (error) {
      console.error("Erro ao buscar pendentes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const scroll = (
    ref: React.RefObject<HTMLDivElement | null>,
    direction: "left" | "right",
  ) => {
    if (ref.current) {
      const scrollAmount = 350;
      ref.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const solicitarValidacao = async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `https://active-age-backend.onrender.com/api/validacoes/solicitar/${user.id}`,
        { method: "POST" },
      );
      if (res.ok) {
        const usuarioAtualizado = await res.json();
        Swal.fire({
          icon: "success",
          title: "Enviado!",
          text: "Dados enviados para análise.",
          confirmButtonColor: "var(--aa-green)",
        });
        setUser(usuarioAtualizado);
        localStorage.setItem(
          "activeAgeUser",
          JSON.stringify(usuarioAtualizado),
        );
      }
    } catch (error) {
      Swal.fire("Erro", "Falha na conexão.", "error");
    }
  };

  const enviarAvaliacaoSistema = async (
    id: string,
    nome: string,
    status: string,
    mensagem: string,
  ) => {
    try {
      const res = await fetch(
        `https://active-age-backend.onrender.com/api/validacoes/avaliar/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, mensagem }),
        },
      );
      if (res.ok) {
        setPedidosAdmin(pedidosAdmin.filter((p) => p.id !== id));
        Swal.fire(
          status === "APROVADO" ? "Aprovado!" : "Reprovado!",
          status === "APROVADO" ? "CRM validado." : `Médico notificado.`,
          "success",
        );
      }
    } catch (error) {
      Swal.fire("Erro", "Não foi possível enviar a avaliação.", "error");
    }
  };

  const aprovarMedico = (id: string, nome: string) => {
    Swal.fire({
      title: `Aprovar ${nome}?`,
      text: "Terá acesso total.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "var(--aa-green)",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sim, aprovar!",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed)
        enviarAvaliacaoSistema(id, nome, "APROVADO", "Aprovado com sucesso.");
    });
  };

  const reprovarMedico = (id: string, nome: string) => {
    Swal.fire({
      title: `Reprovar ${nome}?`,
      input: "textarea",
      inputLabel: "Motivo da reprovação",
      showCancelButton: true,
      confirmButtonColor: "var(--aa-orange)",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Enviar Reprovação",
      cancelButtonText: "Cancelar",
      preConfirm: (feedback) => {
        if (!feedback) {
          Swal.showValidationMessage("O feedback é obrigatório.");
        }
        return feedback;
      },
    }).then((result) => {
      if (result.isConfirmed)
        enviarAvaliacaoSistema(id, nome, "REPROVADO", result.value);
    });
  };

  const handleCancelar = async (id: string) => {
    const isPaciente = user?.tipo === "PACIENTE";
    const agendamento = agendamentos.find((a) => a.id === id);

    if (isPaciente && agendamento?.dataHora) {
      const dataConsulta = new Date(agendamento.dataHora);
      const agora = new Date();
      const diferencaHoras = (dataConsulta.getTime() - agora.getTime()) / (1000 * 60 * 60);

      // Regra de Negócio Oficial RN002
      if (diferencaHoras < 24) {
        Swal.fire({
          icon: "error",
          title: "Cancelamento não permitido",
          html: "Pelas normas de atendimento e telessaúde da plataforma Active Age, o cancelamento de consultas pelo paciente só é permitido com no mínimo <b>24 horas de antecedência</b>.<br/><br/>Caso precise de assistência emergencial, entre em contato com nossa equipe de suporte.",
          confirmButtonColor: "var(--aa-orange)",
          confirmButtonText: "Compreendido",
        });
        return;
      }
    }

    const foiPago = Boolean(
      agendamento?.status === "CONFIRMADO" ||
      agendamento?.valorPago ||
      agendamento?.transacaoPagamentoId
    );

    const valorEstimado = Number(agendamento?.valorPago || agendamento?.valor || 180).toFixed(2);

    const htmlAviso = isPaciente
      ? (foiPago
        ? `Esta consulta possui pagamento confirmado no valor de <b style="color: var(--aa-green);">R$ ${valorEstimado}</b>.<br/><br/>
             Como o cancelamento está sendo feito com mais de 24h de antecedência, <b>o reembolso integral será processado automaticamente</b> pelo Mercado Pago e creditado de volta.<br/><br/>
             Deseja confirmar o cancelamento e solicitar o estorno?`
        : "O horário voltará para a agenda do médico e o agendamento será cancelado. Deseja confirmar?")
      : (foiPago
        ? `Atenção Dr(a): Esta consulta já foi paga pelo paciente (<b style="color: var(--aa-green);">R$ ${valorEstimado}</b>).<br/><br/>
             Ao cancelar, o <b>reembolso total será emitido imediatamente</b> para a conta/cartão do paciente.<br/><br/>
             Deseja realmente cancelar este horário?`
        : "Este horário será invalidado e removido da sua agenda.");

    Swal.fire({
      title: "Confirmar Cancelamento?",
      html: htmlAviso,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "var(--aa-brown)",
      confirmButtonText: foiPago ? "Sim, cancelar e estornar" : "Sim, cancelar",
      cancelButtonText: "Voltar",
    }).then(async (result) => {
      if (result.isConfirmed && user) {
        setAgendamentos((prev) => prev.filter((a) => a.id !== id));
        try {
          const res = await fetch(
            `https://active-age-backend.onrender.com/api/agendamentos/cancelar/${id}/usuario/${user.id}`,
            { method: "PUT" },
          );
          if (res.ok) {
            const atualizado = await res.json().catch(() => null);
            await carregarDados(user);
            if (atualizado && atualizado.statusReembolso === "APROVADO") {
              Swal.fire({
                icon: "success",
                title: "Cancelamento e Estorno Concluídos!",
                html: `Consulta cancelada e paciente notificado.<br/><br/>
                       <div class="p-3 bg-light rounded border text-start small">
                         <b>Comprovante de Reembolso:</b><br/>
                         • Código do Estorno: <code class="text-dark">${atualizado.idReembolso || "REF-MP"}</code><br/>
                         • Valor Devolvido: <b style="color: var(--aa-green);">R$ ${Number(atualizado.valorReembolsado || atualizado.valorPago || 180).toFixed(2)}</b><br/>
                         • Status: <span class="badge bg-success">Aprovado pelo Gateway</span>
                       </div><br/>
                       O registro completo já está disponível no seu <b>Extrato de Pagamentos</b>.`,
                confirmButtonColor: "var(--aa-green)",
                confirmButtonText: "Fechar",
              });
            } else {
              Swal.fire(
                "Cancelado",
                "Consulta cancelada e paciente notificado",
                "success",
              );
            }
          } else {
            const errJson = await res.json().catch(() => null);
            const msgErro = errJson?.message || "Não foi possível cancelar no servidor.";
            carregarDados(user);
            Swal.fire("Erro ao Cancelar", msgErro, "error");
          }
        } catch (error) {
          carregarDados(user);
          Swal.fire("Erro", "Falha de conexão com o servidor.", "error");
        }
      }
    });
  };

  const avaliarConsulta = async (agendamentoId: string, medicoNome: string) => {
    const { value: formValues } = await Swal.fire({
      title: `Avaliar Dr(a). ${medicoNome}`,
      html: `
        <div class="mb-3 text-start">
          <label class="form-label fw-bold small">Sua Nota (1 a 5)</label>
          <select id="swal-nota" class="form-select border-warning">
            <option value="5">⭐⭐⭐⭐⭐ (5) Excelente</option>
            <option value="4">⭐⭐⭐⭐ (4) Muito Bom</option>
            <option value="3">⭐⭐⭐ (3) Bom</option>
            <option value="2">⭐⭐ (2) Regular</option>
            <option value="1">⭐ (1) Ruim</option>
          </select>
        </div>
        <div class="text-start">
          <label class="form-label fw-bold small">Seu Comentário</label>
          <textarea id="swal-comentario" class="form-control" rows="3" placeholder="Como foi o atendimento?..."></textarea>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: "var(--aa-green)",
      confirmButtonText: "Enviar Avaliação",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const nota = (document.getElementById("swal-nota") as HTMLSelectElement)
          .value;
        const comentario = (
          document.getElementById("swal-comentario") as HTMLTextAreaElement
        ).value;
        return { nota: parseInt(nota), comentario };
      },
    });

    if (formValues && user) {
      try {
        const res = await fetch(
          `https://active-age-backend.onrender.com/api/agendamentos/${agendamentoId}/avaliar`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formValues),
          },
        );
        if (res.ok) {
          Swal.fire("Sucesso!", "Sua avaliação foi publicada.", "success");
          carregarDados(user);
        }
      } catch (error) {
        Swal.fire("Erro", "Não foi possível enviar a avaliação.", "error");
      }
    }
  };

  const getPrimeiroNome = (n: string) => {
    const p = n.trim().split(" ");
    return p[0].toLowerCase() === "dr." || p[0].toLowerCase() === "dra."
      ? p.length > 1
        ? `${p[0]} ${p[1]}`
        : p[0]
      : p[0];
  };

  const formatarDataHora = (iso: string) => {
    const d = new Date(iso);
    return {
      dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      hora: d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const renderHistoricoClinico = () => {
    const historico = agendamentos
      .filter((a) => a.status === "CONCLUIDO")
      .sort(
        (a, b) =>
          new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime(),
      );

    if (historico.length === 0) return null;

    return (
      <div
        className="card shadow-sm border-0 mt-4"
        style={{ borderRadius: "15px" }}
      >
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h5 style={{ color: "var(--aa-brown)" }} className="mb-0">
              <i className="bi bi-clock-history me-2"></i>Histórico Clínico
            </h5>
            <div>
              <button
                className="btn btn-sm btn-light border rounded-circle me-2"
                onClick={() => scroll(historicoRef, "left")}
              >
                <i className="bi bi-chevron-left"></i>
              </button>
              <button
                className="btn btn-sm btn-light border rounded-circle"
                onClick={() => scroll(historicoRef, "right")}
              >
                <i className="bi bi-chevron-right"></i>
              </button>
            </div>
          </div>

          <div className="horizontal-scroll gap-3 pb-2" ref={historicoRef}>
            {historico.map((a) => (
              <div
                key={a.id}
                className="p-4 border shadow-sm bg-white d-flex flex-column gap-3 border-start border-4 border-success"
                style={{
                  borderRadius: "12px",
                  minWidth: "350px",
                  flex: "0 0 auto",
                }}
              >
                <div className="border-bottom pb-3">
                  <h6 className="fw-bold mb-1 text-dark">
                    Consulta em{" "}
                    {new Date(a.dataHora).toLocaleDateString("pt-BR")}
                  </h6>
                  <div className="text-muted small fw-semibold">
                    {user?.tipo === "PACIENTE" ? (
                      <>
                        <i className="bi bi-hospital me-1"></i> Médico:{" "}
                        {a.medicoNome}
                      </>
                    ) : (
                      <>
                        <i className="bi bi-person me-1"></i> Paciente:{" "}
                        {a.pacienteNome}
                      </>
                    )}
                  </div>
                </div>

                {user?.tipo === "PACIENTE" && a.medicoId && (
                  <div className="d-flex flex-wrap gap-2">
                    <Link
                      to={`/medico/${a.medicoId}`}
                      className="btn btn-sm btn-outline-secondary fw-bold shadow-sm flex-grow-1"
                    >
                      <i className="bi bi-person-badge me-1"></i> Perfil
                    </Link>
                    {!a.notaAvaliacao ? (
                      <button
                        className="btn btn-sm btn-warning shadow-sm fw-bold text-dark flex-grow-1"
                        onClick={() => avaliarConsulta(a.id, a.medicoNome!)}
                      >
                        <i className="bi bi-star-fill me-1"></i> Avaliar
                      </button>
                    ) : (
                      <span
                        className="badge bg-light text-warning border border-warning fs-6 shadow-sm flex-grow-1 d-flex align-items-center justify-content-center"
                        title={`Você avaliou com ${a.notaAvaliacao} estrelas.`}
                      >
                        {"⭐".repeat(a.notaAvaliacao)}
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <p className="small text-muted fw-bold mb-2">Documentos:</p>
                  <div className="d-flex flex-wrap gap-2">
                    <Link
                      to={`/documento/${a.id}/prontuario`}
                      className="btn btn-sm btn-outline-primary fw-bold shadow-sm flex-grow-1"
                    >
                      Prontuário
                    </Link>
                    <Link
                      to={`/documento/${a.id}/receita`}
                      className="btn btn-sm btn-outline-success fw-bold shadow-sm flex-grow-1"
                    >
                      Receita
                    </Link>
                    <Link
                      to={`/documento/${a.id}/atestado`}
                      className="btn btn-sm btn-outline-warning text-dark fw-bold shadow-sm flex-grow-1"
                    >
                      Atestado
                    </Link>
                    <Link
                      to={`/documento/${a.id}/pedidos`}
                      className="btn btn-sm btn-outline-info text-dark fw-bold shadow-sm flex-grow-1"
                    >
                      Pedidos
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading || !user)
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary"></div>
      </div>
    );

  const agendamentosFuturos = agendamentos
    .filter(
      (a) =>
        (a.status === "AGENDADO" ||
          a.status === "CONFIRMADO" ||
          a.status === "AGUARDANDO_PAGAMENTO") &&
        new Date(a.dataHora) >= new Date(),
    )
    .sort(
      (a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime(),
    );
  const proxima =
    agendamentosFuturos.length > 0 ? agendamentosFuturos[0] : null;
  const outrasConsultas = agendamentosFuturos.filter(
    (a) => a.id !== proxima?.id,
  );

  const renderExtratoPagamentos = () => {
    const pagamentos = agendamentos
      .filter(
        (a) =>
          a.status === "CONFIRMADO" ||
          a.status === "REALIZADO" ||
          a.status === "CONCLUIDO" ||
          a.statusReembolso === "APROVADO" ||
          (a.valorPago && a.valorPago > 0),
      )
      .sort(
        (a, b) =>
          new Date(b.dataPagamento || b.dataHora).getTime() -
          new Date(a.dataPagamento || a.dataHora).getTime(),
      );

    if (pagamentos.length === 0) return null;

    return (
      <div className="card shadow-sm border-0 mt-4" style={{ borderRadius: "15px" }}>
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h5 style={{ color: "var(--aa-brown)" }} className="mb-0">
              <i className="bi bi-receipt me-2"></i>Extrato de Pagamentos
            </h5>
            {pagamentos.length > 0 && (
              <div>
                <button className="btn btn-sm btn-light border rounded-circle me-2" onClick={() => scroll(extratoRef, "left")}>
                  <i className="bi bi-chevron-left"></i>
                </button>
                <button className="btn btn-sm btn-light border rounded-circle" onClick={() => scroll(extratoRef, "right")}>
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            )}
          </div>

          <div className="horizontal-scroll gap-3 pb-2" ref={extratoRef}>
            {pagamentos.map((p) => {
              const isReembolsado =
                p.statusReembolso === "APROVADO" ||
                p.status.startsWith("CANCELADO");
              return (
                <div
                  key={p.id}
                  className={`p-3 border shadow-sm ${isReembolsado ? "bg-white border-danger-subtle" : "bg-light"
                    } d-flex flex-column justify-content-between gap-2`}
                  style={{
                    borderRadius: "12px",
                    minWidth: "300px",
                    flex: "0 0 auto",
                  }}
                >
                  <div className="d-flex justify-content-between border-bottom pb-2 align-items-center">
                    <span className="fw-bold text-muted small">Data</span>
                    <div className="d-flex align-items-center gap-1">
                      {isReembolsado && (
                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger small">
                          Estornado
                        </span>
                      )}
                      <span className="fw-bold text-dark small">
                        {p.dataPagamento
                          ? new Date(p.dataPagamento).toLocaleDateString(
                            "pt-BR",
                          )
                          : new Date(p.dataHora).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted small">Médico</span>
                    <span
                      className="text-dark small fw-semibold text-truncate"
                      style={{ maxWidth: "150px" }}
                    >
                      {p.medicoNome}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted small">
                      {isReembolsado ? "Estorno" : "Valor Pago"}
                    </span>
                    {isReembolsado ? (
                      <div className="text-end">
                        <span className="text-muted text-decoration-line-through small d-block">
                          R${" "}
                          {Number(p.valorPago || p.valor || 180).toFixed(2)}
                        </span>
                        <span className="text-danger fw-bold small">
                          R${" "}
                          {Number(
                            p.valorReembolsado ||
                            p.valorPago ||
                            p.valor ||
                            180,
                          ).toFixed(2)}{" "}
                          (Devolvido)
                        </span>
                      </div>
                    ) : (
                      <span className="text-success fw-bold">
                        R$ {Number(p.valorPago || p.valor || 180).toFixed(2)}
                      </span>
                    )}
                  </div>

                  <button
                    className={`btn btn-sm ${isReembolsado
                        ? "btn-outline-danger"
                        : "btn-outline-primary"
                      } mt-2 fw-bold`}
                    onClick={() => setReciboVisualizado(p)}
                  >
                    <i
                      className={`bi ${isReembolsado
                          ? "bi-file-earmark-diff"
                          : "bi-file-earmark-pdf"
                        } me-1`}
                    ></i>{" "}
                    {isReembolsado
                      ? "Ver Recibo de Estorno"
                      : "Ver Recibo"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderPaciente = () => (
    <div className="row g-4 animation-fade-in">
      <div className="col-lg-8">
        <div
          className="card shadow-sm border-0 mb-4"
          style={{
            borderRadius: "15px",
            borderLeft: "5px solid var(--aa-orange)",
          }}
        >
          <div className="card-body p-4 d-flex flex-column justify-content-center">
            <h4 style={{ color: "var(--aa-brown)" }}>
              <i className="bi bi-calendar-event me-2"></i>Sua Próxima Consulta
            </h4>
            {proxima ? (
              <div className="mt-3 p-4 bg-light rounded d-flex justify-content-between align-items-center flex-wrap gap-3 shadow-sm border">
                <div>
                  <h5 className="mb-1 fw-bold">
                    {proxima.medicoNome || "Profissional não identificado"}
                  </h5>
                  <p className="mb-2 text-muted small fw-semibold">
                    <i className="bi bi-star-fill text-warning me-1"></i>
                    {proxima.medicoEspecializacao || "Geriatria"} | CRM:{" "}
                    {proxima.medicoCrm || "N/A"}
                  </p>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <p className="badge bg-primary bg-opacity-10 text-primary border border-primary fs-6 px-3 py-2 rounded-pill mb-0">
                      <i className="bi bi-clock-fill text-primary me-2"></i>
                      {formatarDataHora(proxima.dataHora).dia} às{" "}
                      {formatarDataHora(proxima.dataHora).hora}
                    </p>
                    {proxima.status === "AGUARDANDO_PAGAMENTO" ? (
                      <span className="badge bg-warning text-dark border border-warning fs-6 px-3 py-2 rounded-pill">
                        <i className="bi bi-hourglass-split me-1"></i>Aguardando Pagamento
                      </span>
                    ) : (
                      <span className="badge bg-success bg-opacity-10 text-success border border-success fs-6 px-3 py-2 rounded-pill">
                        <i className="bi bi-check-circle-fill me-1"></i>Confirmada
                      </span>
                    )}
                  </div>
                </div>
                <div className="d-flex flex-column gap-2 align-items-stretch">
                  {proxima.status === "AGUARDANDO_PAGAMENTO" ? (
                    <button
                      className="btn btn-warning shadow-sm btn-lg fw-bold text-dark"
                      onClick={() => setConsultaParaPagar(proxima)}
                      title="Clique para realizar o pagamento nativo e liberar sua teleconsulta."
                    >
                      <i className="bi bi-credit-card-2-front me-2"></i>Pagar Consulta Agora
                    </button>
                  ) : (
                    <Link
                      to={`/sala/${proxima.id}`}
                      className="btn btn-primary shadow-sm btn-lg fw-bold"
                    >
                      <i className="bi bi-camera-video me-2"></i>Entrar na Sala
                    </Link>
                  )}
                  <button
                    className="btn btn-outline-danger shadow-sm"
                    onClick={() => handleCancelar(proxima.id)}
                  >
                    <i className="bi bi-x-circle me-2"></i>Cancelar Consulta
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <i className="bi bi-calendar2-x fs-1 text-muted opacity-50 mb-2 d-block"></i>
                <p className="text-muted mb-0">
                  Você não tem consultas agendadas para os próximos dias.
                </p>
              </div>
            )}
          </div>
        </div>

        <div
          className="card shadow-sm border-0"
          style={{ borderRadius: "15px" }}
        >
          <div className="card-body p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 style={{ color: "var(--aa-brown)" }} className="mb-0">
                <i className="bi bi-list-ul me-2"></i>Minha Agenda
              </h5>
              {outrasConsultas.length > 0 && (
                <div>
                  <button
                    className="btn btn-sm btn-light border rounded-circle me-2"
                    onClick={() => scroll(agendaPacienteRef, "left")}
                  >
                    <i className="bi bi-chevron-left"></i>
                  </button>
                  <button
                    className="btn btn-sm btn-light border rounded-circle"
                    onClick={() => scroll(agendaPacienteRef, "right")}
                  >
                    <i className="bi bi-chevron-right"></i>
                  </button>
                </div>
              )}
            </div>

            {outrasConsultas.length > 0 ? (
              <div
                className="horizontal-scroll gap-3 pb-2"
                ref={agendaPacienteRef}
              >
                {outrasConsultas.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 border shadow-sm bg-white d-flex flex-column justify-content-between gap-3"
                    style={{
                      borderRadius: "12px",
                      minWidth: "320px",
                      flex: "0 0 auto",
                    }}
                  >
                    <div>
                      <h5
                        className="fw-bold mb-1"
                        style={{ color: "var(--aa-brown)" }}
                      >
                        {a.medicoNome}
                      </h5>
                      <div className="text-muted small mb-3 fw-semibold">
                        <i className="bi bi-star-fill text-warning me-1"></i>{" "}
                        {a.medicoEspecializacao || "Geriatria"} &nbsp;|&nbsp;
                        CRM: {a.medicoCrm || "N/A"}
                      </div>
                      <span className="badge bg-primary bg-opacity-10 text-primary border border-primary fs-6 px-3 py-2 rounded-pill d-inline-block w-100 text-center mb-2">
                        <i className="bi bi-clock-fill me-2"></i>
                        {formatarDataHora(a.dataHora).dia} às{" "}
                        {formatarDataHora(a.dataHora).hora}
                      </span>
                      {a.status === "AGUARDANDO_PAGAMENTO" ? (
                        <button
                          className="btn btn-sm btn-warning fw-bold text-dark w-100 shadow-sm"
                          onClick={() => setConsultaParaPagar(a)}
                        >
                          <i className="bi bi-credit-card-2-front me-1"></i>Pagar Consulta Pendente
                        </button>
                      ) : (
                        <span className="badge bg-success bg-opacity-10 text-success border border-success fs-6 px-3 py-2 rounded-pill d-inline-block w-100 text-center">
                          <i className="bi bi-check-circle-fill me-1"></i>Confirmada
                        </span>
                      )}
                    </div>
                    <div>
                      <button
                        className="btn btn-outline-danger px-4 shadow-sm w-100 fw-bold"
                        onClick={() => handleCancelar(a.id)}
                      >
                        <i className="bi bi-x-circle me-2"></i>Cancelar Consulta
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="alert alert-light text-center border mb-0">
                <p className="text-muted small mb-0">
                  Sem outros compromissos na agenda.
                </p>
              </div>
            )}
          </div>
        </div>

        {renderHistoricoClinico()}
        {renderExtratoPagamentos()}
      </div>

      <div className="col-lg-4 align-self-start d-flex flex-column gap-4">
        <Link to="/busca" className="text-decoration-none">
          <div
            className="card shadow-sm border-0 service-feature bg-white"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body text-center p-4">
              <i
                className="bi bi-search display-4"
                style={{ color: "var(--aa-green)" }}
              ></i>
              <h4 style={{ color: "var(--aa-brown)" }} className="mt-3">
                Agendar Consulta
              </h4>
              <p className="text-muted mb-0">Encontre especialistas.</p>
            </div>
          </div>
        </Link>
        <Link to="/exames" className="text-decoration-none">
          <div
            className="card shadow-sm border-0 service-feature bg-white"
            style={{
              borderRadius: "15px",
              borderBottom: "5px solid var(--aa-orange)",
            }}
          >
            <div className="card-body text-center p-4">
              <i className="bi bi-folder-plus display-4 text-primary"></i>
              <h4 style={{ color: "var(--aa-brown)" }} className="mt-3">
                Meus Exames
              </h4>
              <p className="text-muted mb-0">Faça upload de exames antigos.</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );

  const renderMedico = () => {
    const statusAtual = user.statusValidacao;

    if (statusAtual === "APROVADO") {
      return (
        <div className="row g-4 animation-fade-in">
          {user && <BannerTrialMedico user={user} />}
          <div className="col-lg-8">
            <div
              className="card shadow-sm border-0 mb-4"
              style={{ borderRadius: "15px" }}
            >
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h4 style={{ color: "var(--aa-brown)" }} className="mb-0">
                    <i className="bi bi-calendar-check me-2"></i>Meus Próximos
                    Atendimentos
                  </h4>
                  {agendamentos.filter((a) => a.status === "AGENDADO" || a.status === "CONFIRMADO" || a.status === "AGUARDANDO_PAGAMENTO").length >
                    0 && (
                      <div>
                        <button
                          className="btn btn-sm btn-light border rounded-circle me-2"
                          onClick={() => scroll(agendaMedicoRef, "left")}
                        >
                          <i className="bi bi-chevron-left"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-light border rounded-circle"
                          onClick={() => scroll(agendaMedicoRef, "right")}
                        >
                          <i className="bi bi-chevron-right"></i>
                        </button>
                      </div>
                    )}
                </div>

                {agendamentos.filter((a) => a.status === "AGENDADO" || a.status === "CONFIRMADO" || a.status === "AGUARDANDO_PAGAMENTO").length >
                  0 ? (
                  <div
                    className="horizontal-scroll gap-3 pb-2"
                    ref={agendaMedicoRef}
                  >
                    {agendamentos
                      .filter((a) => a.status === "AGENDADO" || a.status === "CONFIRMADO" || a.status === "AGUARDANDO_PAGAMENTO")
                      .sort(
                        (a, b) =>
                          new Date(a.dataHora).getTime() -
                          new Date(b.dataHora).getTime(),
                      )
                      .map((a) => (
                        <div
                          key={a.id}
                          className="border rounded p-4 shadow-sm bg-white d-flex flex-column justify-content-between gap-4"
                          style={{
                            minWidth: "320px",
                            flex: "0 0 auto",
                            borderLeft: "4px solid var(--aa-orange) !important",
                          }}
                        >
                          <div>
                            <h5 className="fw-bold text-dark mb-2">
                              <i className="bi bi-calendar-event me-2 text-muted"></i>
                              {formatarDataHora(a.dataHora).dia} às{" "}
                              {formatarDataHora(a.dataHora).hora}
                            </h5>
                            <span className="text-muted fw-semibold d-block mt-2">
                              <i className="bi bi-person-fill me-2 text-primary"></i>
                              {a.pacienteNome || "Paciente Identificado"}
                            </span>
                            {a.status === "AGUARDANDO_PAGAMENTO" ? (
                              <span className="badge bg-warning text-dark border border-warning fs-6 px-3 py-1 rounded-pill d-inline-block mt-2">
                                <i className="bi bi-hourglass-split me-1"></i>Aguardando Pagamento
                              </span>
                            ) : (
                              <span className="badge bg-success bg-opacity-10 text-success border border-success fs-6 px-3 py-1 rounded-pill d-inline-block mt-2">
                                <i className="bi bi-check-circle-fill me-1"></i>Confirmada
                              </span>
                            )}
                          </div>

                          <div className="d-flex flex-column gap-2">
                            {a.status === "AGUARDANDO_PAGAMENTO" ? (
                              <button
                                className="btn btn-secondary w-100 shadow-sm fw-bold"
                                disabled
                                title="Aguardando confirmação do pagamento pelo paciente."
                              >
                                <i className="bi bi-lock-fill me-2"></i>{" "}
                                Aguardando Pagamento
                              </button>
                            ) : (
                              <Link
                                to={`/sala/${a.id}`}
                                className="btn btn-primary w-100 shadow-sm fw-bold"
                              >
                                <i className="bi bi-camera-video me-2"></i>{" "}
                                Iniciar Chamada
                              </Link>
                            )}
                            <button
                              className="btn btn-outline-danger w-100 shadow-sm fw-bold"
                              onClick={() => handleCancelar(a.id)}
                            >
                              Cancelar Consulta
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-5 bg-light rounded border">
                    <i className="bi bi-inbox fs-1 text-muted opacity-50 mb-3 d-block"></i>
                    <h5 className="fw-bold text-muted mb-0">
                      Agenda livre no momento.
                    </h5>
                  </div>
                )}
              </div>
            </div>

            {renderHistoricoClinico()}
          </div>
          <div className="col-lg-4 d-flex flex-column gap-4 align-self-start">
            <Link to="/agenda-medico" className="text-decoration-none">
              <div
                className="card shadow-sm border-0 service-feature bg-white p-3"
                style={{ borderRadius: "15px" }}
              >
                <h5
                  style={{ color: "var(--aa-brown)" }}
                  className="m-0 text-center py-2"
                >
                  <i className="bi bi-gear me-2"></i>Configurar Agenda
                </h5>
              </div>
            </Link>

            <Link to="/planos-medico" className="text-decoration-none">
              <div
                className="card shadow-sm border-0 service-feature bg-white p-3"
                style={{
                  borderRadius: "15px",
                  borderLeft: "5px solid var(--aa-orange)",
                }}
              >
                <h5
                  style={{ color: "var(--aa-orange)" }}
                  className="m-0 text-center py-2 fw-bold"
                >
                  <i className="bi bi-rocket-takeoff me-2"></i>Planos do
                  Consultório
                </h5>
              </div>
            </Link>

            <Link to="/extrato-assinaturas" className="text-decoration-none">
              <div
                className="card shadow-sm border-0 service-feature bg-white p-3"
                style={{
                  borderRadius: "15px",
                  borderLeft: "5px solid var(--aa-green)",
                }}
              >
                <h5
                  style={{ color: "var(--aa-brown)" }}
                  className="m-0 text-center py-2 fw-bold"
                >
                  <i className="bi bi-receipt me-2 text-success"></i>Extrato de
                  Assinatura
                </h5>
              </div>
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="row justify-content-center animation-fade-in">
        <div className="col-lg-8">
          <div
            className="card shadow-sm border-0"
            style={{
              borderRadius: "15px",
              borderTop: "6px solid var(--aa-orange)",
            }}
          >
            <div className="card-body p-4 p-md-5 text-center">
              {statusAtual === "PENDENTE" && (
                <>
                  <i
                    className="bi bi-shield-lock display-1 mb-3"
                    style={{ color: "var(--aa-orange)" }}
                  ></i>
                  <h2
                    className="fw-bold mb-3"
                    style={{ color: "var(--aa-brown)" }}
                  >
                    Validação Obrigatória
                  </h2>
                  <p className="fs-5 text-muted mb-4">
                    Confira os dados que serão enviados para a equipe de
                    moderação avaliar e validar o seu registo médico (CRM).
                  </p>
                  <div
                    className="card bg-light border-0 shadow-sm text-start mx-auto mb-5"
                    style={{ maxWidth: "400px", borderRadius: "15px" }}
                  >
                    <div className="card-body p-4">
                      <h6 className="fw-bold mb-3 text-muted border-bottom pb-2">
                        <i className="bi bi-person-vcard me-2"></i>Meus Dados
                        para Validação
                      </h6>
                      <p className="mb-2">
                        <strong>Nome Completo:</strong> <br />
                        {user.nome}
                      </p>
                      <p className="mb-2">
                        <strong>E-mail:</strong> <br />
                        {user.email}
                      </p>
                      <p className="mb-0">
                        <strong>CRM:</strong> <br />
                        {user.crm || "Não informado, edite o seu perfil antes!"}
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-lg px-5 shadow-sm"
                    onClick={solicitarValidacao}
                    disabled={!user.crm}
                    title={
                      !user.crm ? "Preencha o CRM no seu Perfil primeiro." : ""
                    }
                  >
                    <i className="bi bi-send-check me-2"></i> Enviar para
                    Análise
                  </button>
                </>
              )}
              {statusAtual === "EM_ANALISE" && (
                <>
                  <i className="bi bi-hourglass-split display-1 mb-3 text-warning"></i>
                  <h2
                    className="fw-bold mb-3"
                    style={{ color: "var(--aa-brown)" }}
                  >
                    Documentos em Análise
                  </h2>
                  <p className="fs-5 text-muted">
                    A sua solicitação está a ser analisada pela equipe
                    administrativa.
                  </p>
                </>
              )}
              {statusAtual === "REPROVADO" && (
                <>
                  <i className="bi bi-x-octagon display-1 mb-3 text-danger"></i>
                  <h2 className="fw-bold mb-3 text-danger">
                    Validação Recusada
                  </h2>
                  <div className="alert alert-danger text-start p-3 mb-4">
                    <strong>Feedback:</strong> "{user.mensagemValidacao}"
                  </div>
                  <button
                    className="btn btn-outline-danger btn-lg px-5"
                    onClick={() => navigate("/perfil")}
                  >
                    <i className="bi bi-pencil-square me-2"></i> Editar Meus
                    Dados
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAdmin = () => (
    <div className="row g-4 animation-fade-in">
      <div className="col-12">
        <h3 className="fw-bold mb-3" style={{ color: "var(--aa-brown)" }}>
          Validações Pendentes
        </h3>
        {pedidosAdmin.length === 0 ? (
          <div className="alert alert-success border-0 shadow-sm">
            <i className="bi bi-check-circle-fill me-2"></i>Tudo limpo! Nenhuma
            solicitação pendente.
          </div>
        ) : (
          <div className="row g-3">
            {pedidosAdmin.map((pedido) => (
              <div key={pedido.id} className="col-md-6">
                <div
                  className="card shadow-sm border-0 h-100"
                  style={{ borderRadius: "10px" }}
                >
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <h5
                          className="fw-bold mb-1"
                          style={{ color: "var(--aa-brown)" }}
                        >
                          {pedido.nome}
                        </h5>
                        <span className="badge bg-secondary fs-6">
                          <i className="bi bi-card-heading me-1"></i>CRM{" "}
                          {pedido.crm}
                        </span>
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-success w-50 fw-bold"
                        onClick={() => aprovarMedico(pedido.id, pedido.nome)}
                      >
                        <i className="bi bi-check-lg me-1"></i> Aprovar
                      </button>
                      <button
                        className="btn btn-outline-danger w-50 fw-bold"
                        onClick={() => reprovarMedico(pedido.id, pedido.nome)}
                      >
                        <i className="bi bi-x-lg me-1"></i> Reprovar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <main className="container my-5 pb-5">
      <div className="mb-5 pb-3 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <h1 className="fw-bold mb-1" style={{ color: "var(--aa-brown)" }}>
            Olá, {getPrimeiroNome(user.nome)}! 👋
          </h1>
          <p className="fs-5 text-muted mb-0">
            {user.tipo === "PACIENTE" && "Bem-vindo ao Active Age."}
            {user.tipo === "MEDICO" &&
              "Área restrita para profissionais da saúde."}
            {user.tipo === "ADMIN" && "Painel Administrativo Active Age."}
          </p>
        </div>
        {user.tipo !== "ADMIN" && (
          <Link to="/perfil" className="btn btn-outline-secondary px-4">
            <i className="bi bi-person-lines-fill me-2"></i>Editar Perfil
          </Link>
        )}
      </div>

      {user.tipo === "PACIENTE" && renderPaciente()}
      {user.tipo === "MEDICO" && renderMedico()}
      {user.tipo === "ADMIN" && renderAdmin()}

      <style>{`
        .animation-fade-in { animation: fadeIn 0.4s ease-in-out; } 
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .horizontal-scroll {
          display: flex;
          overflow-x: auto;
          scroll-behavior: smooth;
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        .horizontal-scroll::-webkit-scrollbar {
          display: none; /* Chrome, Safari and Opera */
        }

        @media print {
          nav, footer:not(.mt-auto), .navbar, #root > nav, #root > footer {
            display: none !important;
          }

          body {
            background-color: white !important;
          }
          
          .container > .border-bottom,
          .container > .row,
          .container > h1,
          .container > p {
            display: none !important;
          }
          
          .modal-header, .modal-footer, .modal-backdrop {
            display: none !important;
          }
          
          #printable-receipt {
            position: fixed !important;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100vh;
            margin: 0 !important;
            padding: 50px !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            z-index: 9999;
          }
          
          @page { margin: 0; }
        }
      `}</style>

      {reciboVisualizado && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0, 0, 0, 0.55)", backdropFilter: "blur(4px)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header text-white p-3" style={{ backgroundColor: "var(--aa-green)" }}>
                <h5 className="modal-title fw-bold"><i className="bi bi-receipt-cutoff me-2"></i> Recibo de Consulta</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setReciboVisualizado(null)}></button>
              </div>

              <div className="modal-body p-4 bg-light">
                <div id="printable-receipt" className="card border p-4 bg-white rounded-3 shadow-sm text-center mb-3">
                  <img src="/logo.png" alt="Active Age" height="50" className="mx-auto mb-2" />
                  <h6 className="fw-bold mb-0 text-dark">Active Age Consultório Virtual</h6>
                  <small className="text-muted">Comprovante de Agendamento Eletrônico</small>

                  <hr className="my-3" />

                  <div className="text-start small">
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Médico:</span>
                      <strong>{reciboVisualizado.medicoNome}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">CRM:</span>
                      <strong>{reciboVisualizado.medicoCrm || 'N/A'}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Paciente:</span>
                      <strong>{reciboVisualizado.pacienteNome || user?.nome}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Data da Consulta:</span>
                      <strong>{new Date(reciboVisualizado.dataHora).toLocaleDateString('pt-BR')} às {new Date(reciboVisualizado.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Código da Transação:</span>
                      <span className="font-monospace text-break" style={{ maxWidth: "150px" }}>{reciboVisualizado.transacaoPagamentoId || reciboVisualizado.id}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted">Data do Pgto:</span>
                      <span>{reciboVisualizado.dataPagamento ? new Date(reciboVisualizado.dataPagamento).toLocaleDateString('pt-BR') : 'N/A'}</span>
                    </div>

                    {reciboVisualizado.statusReembolso === "APROVADO" ||
                      reciboVisualizado.status.startsWith("CANCELADO") ? (
                      <div className="p-3 bg-danger bg-opacity-10 rounded text-center my-3 border border-danger">
                        <span className="badge bg-danger mb-2">
                          CONSULTA CANCELADA COM ESTORNO
                        </span>
                        <div className="d-flex justify-content-between mb-1 small text-start">
                          <span className="text-muted">Status do Estorno:</span>
                          <span className="text-success fw-bold">
                            Aprovado no Gateway
                          </span>
                        </div>
                        <div className="d-flex justify-content-between mb-1 small text-start">
                          <span className="text-muted">Código do Estorno:</span>
                          <span className="font-monospace fw-bold">
                            {reciboVisualizado.idReembolso || "REF-MP"}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between mb-1 small text-start">
                          <span className="text-muted">Data do Estorno:</span>
                          <span>
                            {reciboVisualizado.dataReembolso
                              ? new Date(
                                reciboVisualizado.dataReembolso,
                              ).toLocaleDateString("pt-BR")
                              : "Hoje"}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between mt-2 pt-2 border-top small text-start align-items-center">
                          <span className="fw-bold text-dark">
                            Valor Devolvido:
                          </span>
                          <span className="fs-5 fw-bold text-danger">
                            R${" "}
                            {Number(
                              reciboVisualizado.valorReembolsado ||
                              reciboVisualizado.valorPago ||
                              reciboVisualizado.valor ||
                              180,
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 bg-light rounded text-center my-3 border">
                        <span className="text-muted small d-block">
                          VALOR PAGO
                        </span>
                        <span className="fs-4 fw-bold text-success">
                          R${" "}
                          {Number(
                            reciboVisualizado.valorPago ||
                            reciboVisualizado.valor ||
                            180,
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light p-3">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setReciboVisualizado(null)}>Fechar</button>
                <button type="button" className="btn btn-primary fw-bold" onClick={() => window.print()}><i className="bi bi-printer me-1"></i> Imprimir Recibo</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL NATIVO DE PAGAMENTO PARA CONSULTA PENDENTE */}
      {consultaParaPagar && user && (
        <ModalPagamentoMercadoPago
          isOpen={!!consultaParaPagar}
          onClose={() => setConsultaParaPagar(null)}
          onSuccess={(detalhes) => {
            setConsultaParaPagar(null);
            Swal.fire({
              icon: "success",
              title: "Pagamento Confirmado!",
              text: `Consulta confirmada com sucesso via ${detalhes.metodo}. Sua sala de vídeo já está liberada!`,
              confirmButtonColor: "var(--aa-green)",
            });
            carregarDados(user);
          }}
          tipoItem="CONSULTA"
          plano={{
            id: consultaParaPagar.id,
            nome: `Teleconsulta com ${consultaParaPagar.medicoNome || "Médico Especialista"}`,
            valor: Number(consultaParaPagar.valor || 180),
            ciclo: "CONSULTA",
            tipo: "CONSULTA",
            dataHoraFormatada: new Date(consultaParaPagar.dataHora).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          }}
          medico={{
            id: consultaParaPagar.medicoId,
            nome: consultaParaPagar.medicoNome,
            crm: consultaParaPagar.medicoCrm,
          }}
          paciente={{
            id: user.id,
            nome: user.nome,
            email: user.email,
          }}
        />
      )}
    </main>
  );
}
