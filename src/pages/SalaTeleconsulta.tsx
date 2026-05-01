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

export function SalaTeleconsulta() {
  const navigate = useNavigate();
  const { agendamentoId } = useParams();
  const [user, setUser] = useState<any>(null);
  const [agendamento, setAgendamento] = useState<Agendamento | null>(null);
  const [exames, setExames] = useState<Exame[]>([]);

  const [activeTab, setActiveTab] = useState<"PRONTUARIO" | "EXAMES">(
    "PRONTUARIO",
  );

  const [queixa, setQueixa] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [conduta, setConduta] = useState("");
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
          if (usuarioLogado.tipo === "MEDICO" && consultaAtual.pacienteId) {
            carregarExamesDoPaciente(consultaAtual.pacienteId);
          }
        } else {
          Swal.fire(
            "Erro",
            "Consulta não encontrada ou já encerrada.",
            "error",
          ).then(() => navigate("/dashboard"));
        }
      }
    } catch (error) {
      Swal.fire(
        "Sem Conexão",
        "Não foi possível carregar os dados da sala.",
        "error",
      );
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
      console.error("Erro ao carregar exames do paciente", error);
    }
  };

  const handleFinalizarConsulta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.tipo !== "MEDICO") return;

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
          }),
        },
      );

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "Prontuário Salvo!",
          text: "A consulta foi finalizada e o registro tornou-se imutável.",
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
          ? "O prontuário não será salvo se você sair agora."
          : "Você pode sair, mas a consulta só sairá do seu painel quando o médico preencher o Prontuário final.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sim, sair agora",
      cancelButtonText: "Continuar na chamada",
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
    <div className="container my-5">
      <div className="row justify-content-center">
        <div
          className={user?.tipo === "MEDICO" ? "col-lg-7" : "col-lg-10 mx-auto"}
        >
          <div
            className="card shadow-sm border-0"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body p-4 p-md-5 text-center">
              <h1 className="h3 mb-2" style={{ color: "var(--aa-brown)" }}>
                <i className="bi bi-hospital me-2"></i>Sala de Teleconsulta
              </h1>
              <p className="fs-5 text-muted mb-4">
                Consulta ID:{" "}
                <strong>#{agendamento.id.substring(0, 8).toUpperCase()}</strong>
              </p>

              <div
                className="bg-dark text-white rounded-4 p-5 my-4 position-relative d-flex flex-column justify-content-center align-items-center shadow-inner"
                style={{
                  minHeight: "350px",
                  border: "4px solid var(--aa-green)",
                }}
              >
                <div className="position-absolute top-0 start-0 m-3 d-flex align-items-center">
                  <div
                    className="spinner-grow text-danger spinner-grow-sm me-2"
                    role="status"
                  >
                    <span className="visually-hidden">Gravando...</span>
                  </div>
                  <span className="badge bg-danger">AO VIVO</span>
                </div>
                <i className="bi bi-person-video fs-1 mb-3 text-muted"></i>
                <h2 className="h4">Aguardando câmera...</h2>
                <p className="text-muted">Ambiente seguro e criptografado</p>
              </div>

              <div className="mt-4 mb-4 p-4 bg-light rounded border text-start shadow-sm">
                {user?.tipo === "MEDICO" ? (
                  <>
                    <p className="fs-5 mb-2 text-success fw-bold">
                      <i className="bi bi-person-badge me-2"></i>Logado como
                      Médico: {user.nome}
                    </p>
                    <p className="fs-5 mb-0 text-primary fw-bold">
                      <i className="bi bi-person-fill me-2"></i>Paciente:{" "}
                      {agendamento.pacienteNome || "Paciente não identificado"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="fs-5 mb-2 text-primary fw-bold">
                      <i className="bi bi-person-circle me-2"></i>Logado como
                      Paciente: {user.nome}
                    </p>
                    <p className="fs-5 mb-0 text-success fw-bold">
                      <i className="bi bi-hospital me-2"></i>Médico:{" "}
                      {agendamento.medicoNome || "Médico não identificado"}
                    </p>
                  </>
                )}
              </div>

              <button
                className="btn btn-danger btn-lg mt-2 px-5 py-3 fw-bold shadow-sm"
                onClick={sairDaSala}
              >
                <i className="bi bi-telephone-x-fill me-2"></i>Sair da Consulta
              </button>
            </div>
          </div>
        </div>

        {user?.tipo === "MEDICO" && (
          <div className="col-lg-5 mt-4 mt-lg-0">
            <div
              className="card shadow-sm border-0 h-100"
              style={{ borderRadius: "15px", maxHeight: "800px" }}
            >
              <div className="card-header bg-white border-bottom p-0 pt-3 px-3 flex-shrink-0">
                <ul className="nav nav-tabs border-bottom-0">
                  <li className="nav-item">
                    <button
                      className={`nav-link fw-bold fs-5 border-0 ${activeTab === "PRONTUARIO" ? "active text-primary border-bottom border-primary border-3" : "text-muted"}`}
                      style={{ backgroundColor: "transparent" }}
                      onClick={() => setActiveTab("PRONTUARIO")}
                    >
                      <i className="bi bi-file-medical-fill me-2"></i>Prontuário
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link fw-bold fs-5 border-0 ${activeTab === "EXAMES" ? "active text-primary border-bottom border-primary border-3" : "text-muted"}`}
                      style={{ backgroundColor: "transparent" }}
                      onClick={() => setActiveTab("EXAMES")}
                    >
                      <i className="bi bi-folder-plus me-2"></i>Exames Prévios
                      {exames.length > 0 && (
                        <span className="badge bg-danger ms-2">
                          {exames.length}
                        </span>
                      )}
                    </button>
                  </li>
                </ul>
              </div>

              <div
                className="card-body p-4 d-flex flex-column overflow-hidden bg-light rounded-bottom"
                style={{
                  borderBottomLeftRadius: "15px",
                  borderBottomRightRadius: "15px",
                }}
              >
                {activeTab === "PRONTUARIO" && (
                  <form
                    onSubmit={handleFinalizarConsulta}
                    className="d-flex flex-column h-100 animation-fade-in"
                  >
                    <div className="flex-grow-1 overflow-auto pe-2 pb-2">
                      <div className="alert alert-warning py-2 small fw-semibold shadow-sm">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        Ao salvar, este registro torna-se imutável.
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold small text-muted">
                          Queixa Principal e Histórico
                        </label>
                        <textarea
                          className="form-control bg-white"
                          rows={3}
                          required
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
                          required
                          value={diagnostico}
                          onChange={(e) => setDiagnostico(e.target.value)}
                          placeholder="Ex: Hipertensão Estágio 1"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-bold small text-muted">
                          Conduta / Tratamento
                        </label>
                        <textarea
                          className="form-control bg-white"
                          rows={4}
                          required
                          value={conduta}
                          onChange={(e) => setConduta(e.target.value)}
                          placeholder="Orientações e prescrições..."
                        ></textarea>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-top d-grid flex-shrink-0">
                      <button
                        type="submit"
                        className="btn btn-success btn-lg py-3 fw-bold shadow-sm"
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          "Salvando..."
                        ) : (
                          <>
                            <i className="bi bi-check-circle-fill me-2"></i>
                            Assinar e Finalizar
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {activeTab === "EXAMES" && (
                  <div className="d-flex flex-column h-100 overflow-auto pe-2 animation-fade-in">
                    <h6 className="fw-bold text-muted mb-3">
                      Histórico Clínico do Paciente
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
                            className="border rounded p-3 shadow-sm bg-white d-flex flex-column gap-2 border-start border-4 border-primary"
                          >
                            <div>
                              <h6 className="fw-bold text-dark mb-1">
                                {exame.nome}
                              </h6>
                              <span className="text-muted fw-semibold small">
                                <i className="bi bi-calendar-event me-1"></i>
                                {new Date(
                                  exame.dataRealizacao,
                                ).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                            <div className="d-grid mt-2">
                              <a
                                href={exame.arquivoBase64}
                                download={`${exame.nome}_ActiveAge`}
                                className="btn btn-sm btn-outline-primary fw-bold"
                              >
                                <i className="bi bi-download me-2"></i>Baixar
                                Exame
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`.shadow-inner { box-shadow: inset 0 0 50px rgba(0,0,0,0.5); } .animation-fade-in { animation: fadeIn 0.3s ease-in-out; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
