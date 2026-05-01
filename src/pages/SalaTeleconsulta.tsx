import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";

interface Agendamento {
  id: string;
  dataHora: string;
  medicoNome?: string;
  pacienteNome?: string;
  pacienteId?: string;
  status: string;
}

interface Exame {
  id: string;
  nome: string;
  dataRealizacao: string;
  arquivoBase64: string;
  tipoArquivo: string;
}

type TabType =
  | "PRONTUARIO"
  | "RECEITA"
  | "ATESTADO"
  | "PEDIDOS_EXAME"
  | "EXAMES";

export function SalaTeleconsulta() {
  const navigate = useNavigate();
  const { agendamentoId } = useParams();
  const [user, setUser] = useState<any>(null);
  const [agendamento, setAgendamento] = useState<Agendamento | null>(null);
  const [exames, setExames] = useState<Exame[]>([]);

  const [activeTab, setActiveTab] = useState<TabType>("PRONTUARIO");

  const [queixa, setQueixa] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [conduta, setConduta] = useState("");

  const [receita, setReceita] = useState("");
  const [atestado, setAtestado] = useState("");
  const [pedidoExames, setPedidoExames] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem("activeAgeUser");
    if (!userStr) {
      navigate("/login");
      return;
    }

    const usuarioLogado = JSON.parse(userStr);
    setUser(usuarioLogado);
    carregarAgendamentoReal(usuarioLogado);
  }, []);

  const carregarAgendamentoReal = async (usuarioLogado: any) => {
    try {
      const rota =
        usuarioLogado.tipo === "PACIENTE"
          ? `paciente/${usuarioLogado.id}`
          : `medico/${usuarioLogado.id}/todos`;
      const res = await fetch(`http://localhost:8080/api/agendamentos/${rota}`);

      if (res.ok) {
        const data = await res.json();
        const consultaAtual = data.find(
          (a: Agendamento) => a.id === agendamentoId,
        );

        if (consultaAtual) {
          setAgendamento(consultaAtual);

          const hoje = new Date().toLocaleDateString("pt-BR");
          const templateAtestado = `Atesto para ____________________________________________________________________\nque o Sr. (a) ${consultaAtual.pacienteNome || "_________________________________________________________"}\nportador da Carteira de identidade nº _____________________ esteve sob\ncuidados médicos no dia ${hoje} e deverá se afastar\nde suas atividades pelo período de _________ dias até _______________\npor motivos de ____________________________________________________.\n\n\nINFORMAÇÕES RELEVANTES:\n\n\n\nCID:_________ \n\n\nLocal: _________________________________    Data: ${hoje}`;

          setAtestado(templateAtestado);

          if (usuarioLogado.tipo === "MEDICO" && consultaAtual.pacienteId) {
            carregarExamesDoPaciente(consultaAtual.pacienteId);
          }
        } else {
          Swal.fire("Erro", "Consulta não encontrada.", "error").then(() =>
            navigate("/dashboard"),
          );
        }
      }
    } catch (error) {
      Swal.fire("Sem Conexão", "Não foi possível carregar os dados.", "error");
    }
  };

  const carregarExamesDoPaciente = async (pacienteId: string) => {
    try {
      const res = await fetch(
        `http://localhost:8080/api/exames/paciente/${pacienteId}`,
      );
      if (res.ok) {
        const data = await res.json();
        setExames(data);
      }
    } catch (error) {
      console.error("Erro exames");
    }
  };

  const handleFinalizarConsulta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.tipo !== "MEDICO") return;

    if (!queixa.trim() || !diagnostico.trim() || !conduta.trim()) {
      Swal.fire(
        "Atenção",
        "Preencha a Queixa, Diagnóstico e Conduta na aba Prontuário para poder assinar o documento.",
        "warning",
      );
      setActiveTab("PRONTUARIO");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(
        `http://localhost:8080/api/prontuarios/medico/${user.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agendamentoId,
            queixaPrincipal: queixa,
            diagnostico,
            conduta,
            receita,
            atestado,
            pedidoExames,
          }),
        },
      );

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "Documentos Assinados!",
          text: "O prontuário e os anexos foram assinados digitalmente (CFM).",
          confirmButtonColor: "var(--aa-green)",
        }).then(() => navigate("/dashboard"));
      } else {
        const error = await res.json();
        Swal.fire("Erro", error.message || "Não foi possível salvar.", "error");
      }
    } catch (error) {
      Swal.fire("Sem Conexão", "Erro de rede.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const sairDaSala = () => {
    Swal.fire({
      title: "Sair da Consulta?",
      text:
        user?.tipo === "MEDICO"
          ? "Atenção: Os documentos não serão guardados se sair agora."
          : "Pode sair, mas a consulta só desaparecerá do painel quando o médico preencher o Prontuário.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Sim, sair agora",
      cancelButtonText: "Continuar",
    }).then((result) => {
      if (result.isConfirmed) {
        navigate("/dashboard");
      }
    });
  };

  if (!agendamento)
    return (
      <div className="text-center py-5">
        <div className="spinner-border"></div>
      </div>
    );

  return (
    <div className="container-fluid my-4 px-4">
      <div className="row justify-content-center g-4">
        <div
          className={
            user?.tipo === "MEDICO" ? "col-xl-6 col-lg-5" : "col-lg-10 mx-auto"
          }
        >
          <div
            className="card shadow-sm border-0 h-100"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body p-4 text-center d-flex flex-column justify-content-center">
              <h1 className="h4 mb-2" style={{ color: "var(--aa-brown)" }}>
                <i className="bi bi-hospital me-2"></i>Sala de Teleconsulta
              </h1>
              <p className="fs-6 text-muted mb-4">
                ID:{" "}
                <strong>#{agendamento.id.substring(0, 8).toUpperCase()}</strong>
              </p>
              <div
                className="bg-dark text-white rounded-4 p-5 mb-4 w-100 position-relative d-flex flex-column justify-content-center align-items-center shadow-inner"
                style={{
                  minHeight: "350px",
                  border: "4px solid var(--aa-green)",
                }}
              >
                <div className="position-absolute top-0 start-0 m-3 d-flex align-items-center">
                  <div className="spinner-grow text-danger spinner-grow-sm me-2"></div>
                  <span className="badge bg-danger">AO VIVO</span>
                </div>
                <i className="bi bi-person-video display-1 mb-3 text-muted"></i>
                <h2 className="h4">Aguardando câmera...</h2>
              </div>
              <div className="mb-4 p-3 bg-light rounded border text-start shadow-sm w-100">
                {user?.tipo === "MEDICO" ? (
                  <>
                    <p className="fs-6 mb-1 text-success fw-bold">
                      <i className="bi bi-person-badge me-2"></i>Médico:{" "}
                      {user.nome}
                    </p>
                    <p className="fs-6 mb-0 text-primary fw-bold">
                      <i className="bi bi-person-fill me-2"></i>Paciente:{" "}
                      {agendamento.pacienteNome || "Paciente não identificado"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="fs-6 mb-1 text-primary fw-bold">
                      <i className="bi bi-person-circle me-2"></i>Paciente:{" "}
                      {user.nome}
                    </p>
                    <p className="fs-6 mb-0 text-success fw-bold">
                      <i className="bi bi-hospital me-2"></i>Médico:{" "}
                      {agendamento.medicoNome || "Médico não identificado"}
                    </p>
                  </>
                )}
              </div>
              <button
                className="btn btn-danger btn-lg px-5 py-3 fw-bold shadow-sm mt-auto"
                onClick={sairDaSala}
              >
                <i className="bi bi-telephone-x-fill me-2"></i>Sair da Consulta
              </button>
            </div>
          </div>
        </div>

        {user?.tipo === "MEDICO" && (
          <div className="col-xl-6 col-lg-7">
            <div
              className="card shadow-sm border-0 h-100 d-flex flex-column"
              style={{ borderRadius: "15px", minHeight: "650px" }}
            >
              <div className="card-header bg-white border-bottom p-0 pt-3 px-3 flex-shrink-0">
                <ul
                  className="nav nav-tabs border-bottom-0 flex-nowrap overflow-x-auto custom-scrollbar"
                  style={{ whiteSpace: "nowrap" }}
                >
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link fw-bold fs-6 border-0 ${activeTab === "PRONTUARIO" ? "active text-primary border-bottom border-primary border-3" : "text-muted"}`}
                      style={{ backgroundColor: "transparent" }}
                      onClick={() => setActiveTab("PRONTUARIO")}
                    >
                      <i className="bi bi-file-medical-fill me-1"></i>Prontuário
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link fw-bold fs-6 border-0 ${activeTab === "RECEITA" ? "active text-primary border-bottom border-primary border-3" : "text-muted"}`}
                      style={{ backgroundColor: "transparent" }}
                      onClick={() => setActiveTab("RECEITA")}
                    >
                      <i className="bi bi-capsule me-1"></i>Receita
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link fw-bold fs-6 border-0 ${activeTab === "ATESTADO" ? "active text-primary border-bottom border-primary border-3" : "text-muted"}`}
                      style={{ backgroundColor: "transparent" }}
                      onClick={() => setActiveTab("ATESTADO")}
                    >
                      <i className="bi bi-file-earmark-text me-1"></i>Atestado
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link fw-bold fs-6 border-0 ${activeTab === "PEDIDOS_EXAME" ? "active text-primary border-bottom border-primary border-3" : "text-muted"}`}
                      style={{ backgroundColor: "transparent" }}
                      onClick={() => setActiveTab("PEDIDOS_EXAME")}
                    >
                      <i className="bi bi-clipboard2-pulse me-1"></i>Pedidos
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link fw-bold fs-6 border-0 ${activeTab === "EXAMES" ? "active text-primary border-bottom border-primary border-3" : "text-muted"}`}
                      style={{ backgroundColor: "transparent" }}
                      onClick={() => setActiveTab("EXAMES")}
                    >
                      <i className="bi bi-folder-plus me-1"></i>Exames Prévios
                    </button>
                  </li>
                </ul>
              </div>

              <div
                className="card-body p-0 d-flex flex-column overflow-hidden bg-light rounded-bottom"
                style={{
                  borderBottomLeftRadius: "15px",
                  borderBottomRightRadius: "15px",
                }}
              >
                <form
                  onSubmit={handleFinalizarConsulta}
                  className="d-flex flex-column h-100"
                >
                  <div className="flex-grow-1 overflow-auto p-4 animation-fade-in custom-scrollbar">
                    {activeTab === "PRONTUARIO" && (
                      <div className="d-flex flex-column h-100">
                        <div className="alert alert-warning py-2 small fw-semibold shadow-sm">
                          <i className="bi bi-exclamation-triangle-fill me-2"></i>
                          Evolução Clínica obrigatória.
                        </div>
                        <div className="mb-3">
                          <label className="form-label fw-bold small text-muted">
                            Queixa Principal e Histórico
                          </label>
                          <textarea
                            className="form-control bg-white"
                            rows={3}
                            value={queixa}
                            onChange={(e) => setQueixa(e.target.value)}
                            placeholder="Relato do paciente..."
                          ></textarea>
                        </div>
                        <div className="mb-3">
                          <label className="form-label fw-bold small text-muted">
                            Diagnóstico
                          </label>
                          <input
                            type="text"
                            className="form-control bg-white"
                            value={diagnostico}
                            onChange={(e) => setDiagnostico(e.target.value)}
                            placeholder="Ex: Hipertensão Estágio 1"
                          />
                        </div>
                        <div className="mb-3 flex-grow-1 d-flex flex-column">
                          <label className="form-label fw-bold small text-muted">
                            Conduta / Tratamento
                          </label>
                          <textarea
                            className="form-control bg-white flex-grow-1"
                            style={{ minHeight: "120px" }}
                            value={conduta}
                            onChange={(e) => setConduta(e.target.value)}
                          ></textarea>
                        </div>
                      </div>
                    )}

                    {activeTab === "RECEITA" && (
                      <div className="d-flex flex-column h-100">
                        <div className="mb-3 flex-grow-1 d-flex flex-column">
                          <label className="form-label fw-bold small text-muted">
                            Prescrição de Medicamentos
                          </label>
                          <textarea
                            className="form-control bg-white flex-grow-1"
                            style={{ minHeight: "200px" }}
                            value={receita}
                            onChange={(e) => setReceita(e.target.value)}
                            placeholder="Ex: 1. Dipirona 500mg..."
                          ></textarea>
                        </div>
                      </div>
                    )}

                    {activeTab === "ATESTADO" && (
                      <div className="d-flex flex-column h-100">
                        <div className="alert alert-info py-2 small fw-semibold shadow-sm">
                          <i className="bi bi-info-circle-fill me-2"></i>
                          Atestado Padrão. Preencha apenas os espaços.
                        </div>
                        <div className="mb-3 flex-grow-1 d-flex flex-column">
                          <textarea
                            className="form-control bg-white flex-grow-1"
                            style={{
                              minHeight: "250px",
                              fontSize: "1rem",
                              lineHeight: "1.5",
                            }}
                            value={atestado}
                            onChange={(e) => setAtestado(e.target.value)}
                          ></textarea>
                        </div>
                      </div>
                    )}

                    {activeTab === "PEDIDOS_EXAME" && (
                      <div className="d-flex flex-column h-100">
                        <div className="mb-3 flex-grow-1 d-flex flex-column">
                          <label className="form-label fw-bold small text-muted">
                            Exames Solicitados
                          </label>
                          <textarea
                            className="form-control bg-white flex-grow-1"
                            style={{ minHeight: "200px" }}
                            value={pedidoExames}
                            onChange={(e) => setPedidoExames(e.target.value)}
                            placeholder="Solicito:..."
                          ></textarea>
                        </div>
                      </div>
                    )}

                    {activeTab === "EXAMES" && (
                      <div className="d-flex flex-column h-100">
                        <h6 className="fw-bold text-muted mb-3">
                          Histórico de Uploads do Paciente
                        </h6>
                        {exames.length === 0 ? (
                          <div className="text-center py-5 bg-white rounded border border-light">
                            <i className="bi bi-folder-x fs-1 text-muted opacity-50 mb-3 d-block"></i>
                            <p className="text-muted mb-0 fw-semibold">
                              O paciente não possui exames cadastrados.
                            </p>
                          </div>
                        ) : (
                          <div className="d-flex flex-column gap-3">
                            {exames.map((exame) => (
                              <div
                                key={exame.id}
                                className="border rounded p-3 shadow-sm bg-white d-flex justify-content-between align-items-center border-start border-4 border-primary"
                              >
                                <div>
                                  <h6 className="fw-bold text-dark mb-1">
                                    {exame.nome}
                                  </h6>
                                  <span className="text-muted fw-semibold small">
                                    <i className="bi bi-calendar-event me-1"></i>
                                    Realizado:{" "}
                                    {new Date(
                                      exame.dataRealizacao,
                                    ).toLocaleDateString("pt-BR")}
                                  </span>
                                </div>
                                <a
                                  href={exame.arquivoBase64}
                                  download={`${exame.nome}_ActiveAge`}
                                  className="btn btn-sm btn-outline-primary fw-bold shadow-sm"
                                >
                                  <i className="bi bi-download"></i>
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    className="p-3 border-top bg-white d-grid flex-shrink-0"
                    style={{
                      borderBottomLeftRadius: "15px",
                      borderBottomRightRadius: "15px",
                    }}
                  >
                    <button
                      type="submit"
                      className="btn btn-success btn-lg py-3 fw-bold shadow-sm"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        "A Processar Assinatura..."
                      ) : (
                        <>
                          <i className="bi bi-pen-fill me-2"></i>Assinar
                          Digitalmente e Finalizar
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`.shadow-inner { box-shadow: inset 0 0 50px rgba(0,0,0,0.5); } .animation-fade-in { animation: fadeIn 0.2s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } } .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-track { background-color: transparent; }`}</style>
    </div>
  );
}
