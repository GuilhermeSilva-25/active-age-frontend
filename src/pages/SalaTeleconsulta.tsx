import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";

interface Agendamento {
  id: string;
  dataHora: string;
  medicoNome?: string;
  pacienteNome?: string;
  status: string;
}

export function SalaTeleconsulta() {
  const navigate = useNavigate();
  const { agendamentoId } = useParams();
  const [user, setUser] = useState<any>(null);
  const [agendamento, setAgendamento] = useState<Agendamento | null>(null);
  
  const [queixa, setQueixa] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [conduta, setConduta] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem("activeAgeUser");
    if (!userStr) { navigate("/login"); return; }
    setUser(JSON.parse(userStr));
    carregarAgendamento();
  }, []);

  const carregarAgendamento = async () => {
    setAgendamento({
      id: agendamentoId || "123",
      dataHora: new Date().toISOString(),
      status: "AGENDADO",
      medicoNome: "Dr. Guilherme Silva",
      pacienteNome: "Antônio Carlos"
    });
  };

  const handleFinalizarConsulta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.tipo !== "MEDICO") return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`http://localhost:8080/api/prontuarios/medico/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agendamentoId, queixaPrincipal: queixa, diagnostico, conduta })
      });

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "Prontuário Salvo!",
          text: "A consulta foi finalizada e o registro tornou-se imutável.",
          confirmButtonColor: "var(--aa-green)"
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
      title: 'Sair da Consulta?',
      text: user?.tipo === "MEDICO" ? "O prontuário não será salvo se você sair agora." : "Tem certeza que deseja encerrar a chamada e voltar ao seu painel?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sim, sair agora',
      cancelButtonText: 'Continuar na chamada'
    }).then((result) => {
      if (result.isConfirmed) {
        navigate("/dashboard");
      }
    });
  };

  if (!agendamento) return <div className="text-center py-5"><div className="spinner-border"></div></div>;

  return (
    <div className="container my-5">
      <div className="row justify-content-center">
        
        <div className={user?.tipo === "MEDICO" ? "col-lg-7" : "col-lg-10 mx-auto"}>
          <div className="card shadow-sm border-0" style={{ borderRadius: "15px" }}>
            <div className="card-body p-4 p-md-5 text-center">
              
              <h1 className="h3 mb-2" style={{ color: "var(--aa-brown)" }}>
                <i className="bi bi-hospital me-2"></i>Sala de Teleconsulta
              </h1>
              <p className="fs-5 text-muted mb-4">
                Consulta ID: <strong>#{agendamento.id.substring(0, 8).toUpperCase()}</strong>
              </p>

              <div className="bg-dark text-white rounded-4 p-5 my-4 position-relative d-flex flex-column justify-content-center align-items-center shadow-inner" style={{ minHeight: "350px", border: "4px solid var(--aa-green)" }}>
                
                <div className="position-absolute top-0 start-0 m-3 d-flex align-items-center">
                  <div className="spinner-grow text-danger spinner-grow-sm me-2" role="status">
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
                    <p className="fs-5 mb-2 text-success fw-bold"><i className="bi bi-person-badge me-2"></i>Logado como Médico: {user.nome}</p>
                    <p className="fs-5 mb-0 text-primary fw-bold"><i className="bi bi-person-fill me-2"></i>Paciente: {agendamento.pacienteNome || "Aguardando paciente..."}</p>
                  </>
                ) : (
                  <>
                    <p className="fs-5 mb-2 text-primary fw-bold"><i className="bi bi-person-circle me-2"></i>Logado como Paciente: {user.nome}</p>
                    <p className="fs-5 mb-0 text-success fw-bold"><i className="bi bi-hospital me-2"></i>Médico: {agendamento.medicoNome || "Aguardando médico..."}</p>
                  </>
                )}
              </div>

              <button className="btn btn-danger btn-lg mt-2 px-5 py-3 fw-bold shadow-sm" onClick={sairDaSala}>
                <i className="bi bi-telephone-x-fill me-2"></i>Sair da Consulta
              </button>

            </div>
          </div>
        </div>

        {user?.tipo === "MEDICO" && (
          <div className="col-lg-5 mt-4 mt-lg-0">
            <div className="card shadow-sm border-0 h-100" style={{ borderRadius: "15px" }}>
              <div className="card-header bg-white border-bottom p-4">
                <h5 className="fw-bold mb-0" style={{ color: 'var(--aa-brown)' }}>
                  <i className="bi bi-file-medical-fill me-2 text-primary"></i>Prontuário Eletrônico
                </h5>
              </div>
              
              <div className="card-body p-4 d-flex flex-column">
                <form onSubmit={handleFinalizarConsulta} className="d-flex flex-column h-100">
                  <div className="alert alert-warning py-2 small fw-semibold shadow-sm">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>Ao salvar, este registro torna-se imutável.
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label fw-bold small text-muted">Queixa Principal e Histórico</label>
                    <textarea className="form-control bg-light" rows={3} required value={queixa} onChange={e => setQueixa(e.target.value)} placeholder="Relato do paciente..."></textarea>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold small text-muted">Diagnóstico</label>
                    <input type="text" className="form-control bg-light" required value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Ex: Hipertensão Estágio 1" />
                  </div>

                  <div className="mb-4 flex-grow-1">
                    <label className="form-label fw-bold small text-muted">Conduta / Tratamento</label>
                    <textarea className="form-control bg-light h-100" style={{ minHeight: '120px' }} required value={conduta} onChange={e => setConduta(e.target.value)} placeholder="Orientações e prescrições..."></textarea>
                  </div>

                  <div className="d-grid mt-auto">
                    <button type="submit" className="btn btn-success btn-lg py-3 fw-bold shadow-sm" disabled={isSaving}>
                      {isSaving ? "Salvando..." : <><i className="bi bi-check-circle-fill me-2"></i>Assinar e Finalizar</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </div>
      <style>{`.shadow-inner { box-shadow: inset 0 0 50px rgba(0,0,0,0.5); }`}</style>
    </div>
  );
}