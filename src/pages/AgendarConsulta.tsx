import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Swal from "sweetalert2";

interface Agendamento {
  id: string;
  dataHora: string;
  status: string;
  valor?: number;
  duracaoMinutos?: number;
}

export interface DetalheConsulta {
  valor: number;
  duracao: number;
}

export function AgendarConsulta() {
  const navigate = useNavigate();
  const { medicoId } = useParams();

  const [horarios, setHorarios] = useState<Agendamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pacienteId, setPacienteId] = useState("");
  const [pacienteLogado, setPacienteLogado] = useState<any>(null);
  const [medico, setMedico] = useState<any>(null);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [detalhesHorarios, setDetalhesHorarios] = useState<Record<string, DetalheConsulta>>({});

  const [configMedico, setConfigMedico] = useState<{
    duracaoMinutos: number;
    valorConsulta: number;
    orientacoes?: string;
  }>({
    duracaoMinutos: 45,
    valorConsulta: 180,
    orientacoes: "",
  });

  useEffect(() => {
    const userStr = localStorage.getItem("activeAgeUser");
    if (!userStr) {
      navigate("/login");
      return;
    }

    const usuarioLogado = JSON.parse(userStr);
    setPacienteId(usuarioLogado.id);
    setPacienteLogado(usuarioLogado);

    if (medicoId) {
      carregarHorariosLivres();
      carregarDadosMedico();
      carregarConfigMedico();
      carregarDetalhesHorarios();
      carregarAvaliacoes();
    }
  }, [medicoId]);

  const carregarDetalhesHorarios = () => {
    if (!medicoId) return;
    const salvos = localStorage.getItem(`activeAgeHorariosDetalhes_${medicoId}`);
    if (salvos) {
      try {
        setDetalhesHorarios(JSON.parse(salvos));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const carregarConfigMedico = () => {
    if (!medicoId) return;
    const salvo = localStorage.getItem(`activeAgeMedicoConfig_${medicoId}`);
    if (salvo) {
      try {
        setConfigMedico(JSON.parse(salvo));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const carregarDadosMedico = async () => {
    const token = localStorage.getItem("activeAgeToken");
    try {
      const res = await fetch(
        `https://active-age-backend.onrender.com/api/usuarios/${medicoId}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        setMedico(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const carregarAvaliacoes = async () => {
    const token = localStorage.getItem("activeAgeToken");
    try {
      const res = await fetch(
        `https://active-age-backend.onrender.com/api/agendamentos/medico/${medicoId}/avaliacoes`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        setAvaliacoes(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const carregarHorariosLivres = async () => {
    try {
      const response = await fetch(
        `https://active-age-backend.onrender.com/api/agendamentos/disponiveis/${medicoId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setHorarios(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const obterInfoDesteHorario = (id: string, dataHora: string): DetalheConsulta => {
    const horarioEncontrado = horarios.find((item) => item.id === id);
    if (horarioEncontrado?.valor !== undefined && horarioEncontrado?.valor !== null) {
      return {
        valor: Number(horarioEncontrado.valor),
        duracao: Number(horarioEncontrado.duracaoMinutos) || 45,
      };
    }
    if (detalhesHorarios[id]) return detalhesHorarios[id];
    if (detalhesHorarios[dataHora]) return detalhesHorarios[dataHora];
    return {
      valor: configMedico.valorConsulta || 180,
      duracao: configMedico.duracaoMinutos || 45,
    };
  };

  const iniciarAgendamentoComPagamento = (h: Agendamento) => {
    const dataObj = new Date(h.dataHora);
    const diaFormatado = dataObj.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const horaFormatada = dataObj.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const dataHoraLimpa = `${diaFormatado} às ${horaFormatada}`;
    const infoDestaConsulta = obterInfoDesteHorario(h.id, h.dataHora);

    Swal.fire({
      title: "Confirmar Escolha do Horário?",
      html: `
        <div class="text-start p-2">
          <p class="mb-2"><strong>Médico:</strong> ${medico?.nome || "Médico Especialista"}</p>
          <p class="mb-2"><strong>Data e Horário:</strong> <span class="text-capitalize">${dataHoraLimpa}</span></p>
          <p class="mb-2"><strong>Duração:</strong> ${infoDestaConsulta.duracao} minutos</p>
          <p class="mb-3"><strong>Valor da Consulta:</strong> <span class="text-success fw-bold fs-5">R$ ${Number(infoDestaConsulta.valor || 0).toFixed(2)}</span></p>
          ${
            configMedico.orientacoes
              ? `<div class="alert alert-warning small p-2 mb-0"><strong>Orientações:</strong> ${configMedico.orientacoes}</div>`
              : ""
          }
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "var(--aa-green)",
      cancelButtonColor: "var(--aa-brown)",
      confirmButtonText: "Prosseguir para Pagamento",
      cancelButtonText: "Voltar",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          Swal.fire({
            title: "Conectando ao Mercado Pago...",
            text: "Aguarde enquanto geramos o link de pagamento.",
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          const valorFinal = Number(infoDestaConsulta.valor || 180);

          const response = await fetch(
            "https://active-age-payment-service.onrender.com/api/payments/create",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amount: valorFinal,
                description: `Teleconsulta com ${medico?.nome || "Médico Especialista"}`,
                payerEmail: pacienteLogado?.email || "paciente@teste.com",
                type: "CONSULTATION",
                referenceId: `AGEND-${h.id}`,
              }),
            },
          );

          const data = await response.json();
          if (data.checkoutUrl) {
            Swal.close();
            window.open(data.checkoutUrl, "_blank");

            await fetch(
              `https://active-age-backend.onrender.com/api/agendamentos/marcar/${h.id}/paciente/${pacienteId}`,
              { method: "PUT" },
            ).catch(() => null);

            Swal.fire({
              title: "Aguardando Pagamento...",
              html: "A aba do Mercado Pago foi aberta. Finalize seu pagamento para confirmar o agendamento.<br/><br/><b>Não feche esta tela!</b> Estamos aguardando a confirmação...",
              allowOutsideClick: false,
              didOpen: () => {
                Swal.showLoading();
              },
            });

            const intervalo = setInterval(async () => {
              try {
                const res = await fetch(
                  `https://active-age-backend.onrender.com/api/agendamentos/paciente/${pacienteId}`
                );
                if (res.ok) {
                  const agendamentos = await res.json();
                  const agendamentoAtualizado = agendamentos.find((a: any) => a.id === h.id);
                  if (agendamentoAtualizado && agendamentoAtualizado.status === "CONFIRMADO") {
                    clearInterval(intervalo);
                    Swal.fire({
                      icon: "success",
                      title: "Pagamento Confirmado!",
                      text: "Sua teleconsulta foi agendada com sucesso.",
                      confirmButtonColor: "var(--aa-green)",
                      confirmButtonText: "Ir para Meu Painel",
                    }).then(() => {
                      navigate("/dashboard");
                    });
                  }
                }
              } catch (err) {
                console.error("Erro ao checar status do pagamento", err);
              }
            }, 3000);
          } else {
            Swal.fire(
              "Erro",
              data?.message || "Não foi possível gerar o link de pagamento.",
              "error",
            );
          }
        } catch (error) {
          Swal.fire(
            "Erro",
            "Erro ao conectar com o serviço de pagamentos.",
            "error",
          );
        }
      }
    });
  };

  const demonstrarInteresse = () => {
    Swal.fire({
      title: "Lista de Espera",
      text: "O médico será notificado do seu interesse e avisaremos por e-mail quando novos horários surgirem.",
      icon: "success",
      confirmButtonColor: "var(--aa-orange)",
    });
  };

  if (isLoading)
    return (
      <div className="text-center py-5 mt-5">
        <div
          className="spinner-border mb-3"
          role="status"
          style={{ color: "var(--aa-orange)", width: "3rem", height: "3rem" }}
        >
          <span className="visually-hidden">Carregando...</span>
        </div>
        <p className="text-muted">Carregando horários e dados do especialista...</p>
      </div>
    );

  const mediaNotas =
    avaliacoes.length > 0
      ? (
          avaliacoes.reduce((acc, curr) => acc + curr.notaAvaliacao, 0) /
          avaliacoes.length
        ).toFixed(1)
      : "Novo";

  return (
    <main className="container my-5 pb-5 animation-fade-in">
      <header className="mb-4 pb-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <Link to="/busca" className="btn btn-outline-secondary mb-2">
            <i className="bi bi-arrow-left me-2"></i>Voltar para Busca
          </Link>
          <h1 className="fw-bold mb-1" style={{ color: "var(--aa-brown)" }}>
            Agendar Teleconsulta
          </h1>
          <p className="fs-6 text-muted mb-0">
            Escolha o horário de atendimento e realize o pagamento seguro via Mercado Pago.
          </p>
        </div>
      </header>

      {medico && (
        <section
          className="card shadow-sm border-0 mb-4 bg-white"
          style={{
            borderRadius: "16px",
            borderTop: "5px solid var(--aa-orange)",
          }}
        >
          <div className="card-body p-4 p-md-5">
            <div className="row g-4 align-items-center">
              <div className="col-12 col-md-auto text-center">
                <img
                  src={`https://ui-avatars.com/api/?name=${medico.nome.replace(" ", "+")}&background=e86542&color=fff&size=140`}
                  alt="Avatar do Médico"
                  className="rounded-circle shadow-sm"
                  style={{
                    width: "120px",
                    height: "120px",
                    border: "4px solid var(--aa-orange)",
                    boxShadow: "0 4px 12px rgba(232, 101, 66, 0.15)",
                  }}
                />
              </div>

              <div className="col-12 col-md">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <h2 className="fw-bold mb-0" style={{ color: "var(--aa-brown)" }}>
                    {medico.nome}
                  </h2>
                  <span
                    className="badge rounded-pill px-3 py-1.5 small fw-semibold d-inline-flex align-items-center gap-1"
                    style={{
                      backgroundColor: "rgba(144, 194, 141, 0.2)",
                      color: "#2e6930",
                      border: "1px solid rgba(144, 194, 141, 0.4)",
                    }}
                  >
                    <i className="bi bi-patch-check-fill" style={{ color: "var(--aa-green)" }}></i> Médico Verificado
                  </span>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-3 text-muted small mb-3">
                  <span className="d-inline-flex align-items-center">
                    <i className="bi bi-award-fill me-1.5" style={{ color: "var(--aa-orange)" }}></i>
                    <strong>Especialidade:</strong>&nbsp;{medico.especializacao || "Geriatria"}
                  </span>
                  <span>•</span>
                  <span className="d-inline-flex align-items-center">
                    <i className="bi bi-card-text me-1.5" style={{ color: "var(--aa-brown)" }}></i>
                    <strong>CRM:</strong>&nbsp;{medico.crm || "Registrado"}
                  </span>
                  <span>•</span>
                  <span className="d-inline-flex align-items-center">
                    <i className="bi bi-star-fill text-warning me-1.5"></i>
                    <strong>Avaliação:</strong>&nbsp;{mediaNotas} ({avaliacoes.length} atendimentos)
                  </span>
                </div>

                {medico.biografia && (
                  <p className="text-muted small mb-3 fst-italic" style={{ maxWidth: "750px" }}>
                    "{medico.biografia}"
                  </p>
                )}

                <div className="d-flex flex-wrap gap-2 align-items-center mt-2">
                  <span
                    className="badge rounded-pill p-2 px-3 small fw-normal d-inline-flex align-items-center gap-1.5"
                    style={{
                      backgroundColor: "rgba(90, 58, 45, 0.07)",
                      color: "var(--aa-brown)",
                      border: "1px solid rgba(90, 58, 45, 0.12)",
                    }}
                  >
                    <i className="bi bi-clock-history" style={{ color: "var(--aa-orange)" }}></i>
                    Duração Estimada: <strong className="ms-1">{configMedico.duracaoMinutos} min</strong>
                  </span>

                  <span
                    className="badge rounded-pill p-2 px-3 small fw-normal d-inline-flex align-items-center gap-1.5"
                    style={{
                      backgroundColor: "rgba(144, 194, 141, 0.2)",
                      color: "#2e6930",
                      border: "1px solid rgba(144, 194, 141, 0.4)",
                    }}
                  >
                    <i className="bi bi-cash-stack" style={{ color: "var(--aa-green)" }}></i>
                    Valor Padrão: <strong className="ms-1 fs-6" style={{ color: "var(--aa-green)" }}>R$ {Number(configMedico.valorConsulta || 0).toFixed(2)}</strong>
                  </span>
                </div>

                {configMedico.orientacoes && (
                  <div
                    className="p-3 rounded-3 mt-3 d-flex align-items-start gap-2.5"
                    style={{
                      backgroundColor: "rgba(232, 101, 66, 0.07)",
                      borderLeft: "4px solid var(--aa-orange)",
                      color: "var(--aa-brown)",
                    }}
                  >
                    <i className="bi bi-info-circle-fill fs-5 flex-shrink-0" style={{ color: "var(--aa-orange)" }}></i>
                    <span className="small">
                      <strong>Instruções do Profissional:</strong> {configMedico.orientacoes}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <div
          className="card shadow-sm border-0 rounded-4 bg-white mb-4"
          style={{
            borderRadius: "16px",
            borderTop: "5px solid var(--aa-green)",
          }}
        >
          <div className="card-body p-4 p-md-5">
            {horarios.length === 0 ? (
              <div className="text-center py-5">
                <i
                  className="bi bi-calendar-x display-1 mb-3 d-block"
                  style={{ color: "var(--aa-brown)", opacity: 0.3 }}
                ></i>
                <h3 className="fw-bold" style={{ color: "var(--aa-brown)" }}>
                  Nenhum horário disponível no momento
                </h3>
                <p className="text-muted mb-4 fs-5">
                  Infelizmente este médico não possui vagas abertas na agenda no momento.
                </p>
                <button
                  className="btn btn-primary btn-lg px-4 shadow-sm fw-bold"
                  onClick={demonstrarInteresse}
                  style={{ borderRadius: "12px" }}
                >
                  <i className="bi bi-bell-fill me-2"></i> Demonstrar Interesse / Lista de Espera
                </button>
              </div>
            ) : (
              <>
                <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                  <h4 className="fw-bold mb-0" style={{ color: "var(--aa-brown)" }}>
                    <i className="bi bi-calendar2-check-fill me-2" style={{ color: "var(--aa-green)" }}></i>
                    Selecione o Horário Desejado
                  </h4>
                  <span
                    className="badge rounded-pill px-3 py-2 fw-semibold"
                    style={{
                      backgroundColor: "rgba(144, 194, 141, 0.15)",
                      color: "var(--aa-brown)",
                      border: "1px solid rgba(144, 194, 141, 0.3)",
                    }}
                  >
                    {horarios.length} vaga(s) disponível(is)
                  </span>
                </div>

                <div className="row g-3">
                  {horarios.map((h) => {
                    const dataObj = new Date(h.dataHora);
                    const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "long" });
                    const dataStr = dataObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
                    const horaStr = dataObj.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    const infoDesteHorario = obterInfoDesteHorario(h.id, h.dataHora);

                    return (
                      <div className="col-12 col-md-6 col-lg-4" key={h.id}>
                        <div
                          className="card border-0 h-100 shadow-sm slot-card bg-white position-relative"
                          style={{
                            borderRadius: "15px",
                            borderTop: "4px solid var(--aa-green)",
                            transition: "all 0.25s ease-in-out",
                            cursor: "pointer",
                            backgroundColor: "#fff",
                          }}
                          onClick={() => iniciarAgendamentoComPagamento(h)}
                        >
                          <div className="card-body p-3.5 p-md-4 d-flex flex-column justify-content-between">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div>
                                <span
                                  className="small text-capitalize fw-bold d-block"
                                  style={{ color: "var(--aa-brown)" }}
                                >
                                  {diaSemana}
                                </span>
                                <span className="small text-muted">{dataStr}</span>
                              </div>
                              <span
                                className="badge rounded-pill px-2.5 py-1 small fw-semibold"
                                style={{
                                  backgroundColor: "rgba(144, 194, 141, 0.2)",
                                  color: "#2e6930",
                                  border: "1px solid rgba(144, 194, 141, 0.4)",
                                }}
                              >
                                <i
                                  className="bi bi-check-circle-fill me-1"
                                  style={{ color: "var(--aa-green)" }}
                                ></i>
                                Livre
                              </span>
                            </div>

                            <div
                              className="text-center py-3 my-3 rounded-3"
                              style={{
                                backgroundColor: "var(--aa-bg)",
                                border: "1px dashed rgba(90, 58, 45, 0.15)",
                              }}
                            >
                              <span
                                className="display-6 fw-bold d-block mb-1"
                                style={{ color: "var(--aa-brown)" }}
                              >
                                {horaStr}
                              </span>
                              <small className="text-muted d-inline-flex align-items-center gap-1">
                                <i
                                  className="bi bi-stopwatch"
                                  style={{ color: "var(--aa-orange)" }}
                                ></i>
                                Duração: <strong>{infoDesteHorario.duracao} min</strong>
                              </small>
                            </div>

                            <div className="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
                              <div>
                                <span
                                  className="d-block text-muted text-uppercase fw-semibold"
                                  style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}
                                >
                                  Valor da Consulta
                                </span>
                                <span
                                  className="fs-4 fw-bold"
                                  style={{ color: "var(--aa-green)" }}
                                >
                                  R$ {Number(infoDesteHorario.valor || 0).toFixed(2)}
                                </span>
                              </div>

                              <button
                                type="button"
                                className="btn btn-primary btn-sm px-3.5 py-2 fw-bold rounded-pill shadow-sm d-flex align-items-center gap-1"
                              >
                                <span>Agendar</span>
                                <i className="bi bi-arrow-right"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <style>{`
        .animation-fade-in {
          animation: fadeIn 0.35s ease-in-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .slot-card {
          border: 1px solid rgba(0, 0, 0, 0.06) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04) !important;
        }
        .slot-card:hover {
          transform: translateY(-5px);
          border-top-color: var(--aa-orange) !important;
          box-shadow: 0 10px 25px rgba(232, 101, 66, 0.18) !important;
        }
        .slot-card:hover .btn-primary {
          background-color: #d15431 !important;
          border-color: #d15431 !important;
        }
      `}</style>
    </main>
  );
}
