import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";

interface Agendamento {
  id: string;
  dataHora: string;
  status: string;
  pacienteId: string | null;
}

interface Usuario {
  id: string;
  nome: string;
  tipo: string;
}

export function AgendaMedico() {
  const navigate = useNavigate();
  const [user, setUser] = useState<Usuario | null>(null);
  const [horarios, setHorarios] = useState<Agendamento[]>([]);
  const [dataNova, setDataNova] = useState("");
  const [horaNova, setHoraNova] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userStr = localStorage.getItem("activeAgeUser");
    if (!userStr) {
      navigate("/login");
      return;
    }

    const usuarioLogado = JSON.parse(userStr);
    if (usuarioLogado.tipo !== "MEDICO") {
      navigate("/dashboard");
      return;
    }

    setUser(usuarioLogado);
    carregarAgenda(usuarioLogado.id);
  }, [navigate]);

  const carregarAgenda = async (medicoId: string) => {
    try {
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  };

  const handleCriarHorario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataNova || !horaNova) {
      Swal.fire("Atenção", "Selecione data e hora válidas.", "warning");
      return;
    }

    const dataHoraIso = `${dataNova}T${horaNova}:00`; // Formata para o Java (LocalDateTime)

    try {
      const response = await fetch(
        `http://localhost:8080/api/agendamentos/medico/${user?.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ horarios: [dataHoraIso] }),
        },
      );

      if (response.ok) {
        Swal.fire(
          "Sucesso",
          "Horário disponibilizado para os pacientes!",
          "success",
        );
        setHorarios([
          ...horarios,
          {
            id: Date.now().toString(),
            dataHora: dataHoraIso,
            status: "DISPONIVEL",
            pacienteId: null,
          },
        ]);
        setDataNova("");
        setHoraNova("");
      } else {
        Swal.fire("Erro", "Não foi possível salvar o horário.", "error");
      }
    } catch (error) {
      Swal.fire("Erro", "Servidor offline.", "error");
    }
  };

  const cancelarHorario = async (id: string) => {
    Swal.fire({
      title: "Cancelar horário?",
      text: "Os pacientes não poderão mais agendar neste horário.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "var(--aa-brown)",
      confirmButtonText: "Sim, cancelar",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(
            `http://localhost:8080/api/agendamentos/cancelar/${id}/usuario/${user?.id}`,
            { method: "PUT" },
          );
          if (res.ok) {
            setHorarios(horarios.filter((h) => h.id !== id));
            Swal.fire(
              "Cancelado!",
              "O horário foi removido da sua agenda.",
              "success",
            );
          }
        } catch (error) {
          Swal.fire("Erro", "Não foi possível cancelar.", "error");
        }
      }
    });
  };

  if (isLoading)
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary"></div>
      </div>
    );

  return (
    <main className="container my-5 pb-5">
      <header className="mb-5 pb-3 border-bottom">
        <Link to="/dashboard" className="btn btn-outline-secondary mb-3">
          <i className="bi bi-arrow-left me-2"></i>Voltar
        </Link>
        <h1 className="fw-bold mb-1" style={{ color: "var(--aa-brown)" }}>
          Configurar Agenda
        </h1>
        <p className="fs-5 text-muted mb-0">
          Disponibilize seus horários para atendimento.
        </p>
      </header>

      <div className="row">
        <div className="col-lg-4 mb-4">
          <div
            className="card shadow-sm border-0"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body p-4">
              <h5 className="fw-bold mb-4" style={{ color: "var(--aa-brown)" }}>
                <i className="bi bi-plus-circle me-2"></i>Novo Horário
              </h5>
              <form onSubmit={handleCriarHorario}>
                <div className="mb-3">
                  <label className="form-label text-muted">Data</label>
                  <input
                    type="date"
                    className="form-control"
                    required
                    value={dataNova}
                    onChange={(e) => setDataNova(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="form-label text-muted">Hora</label>
                  <input
                    type="time"
                    className="form-control"
                    required
                    value={horaNova}
                    onChange={(e) => setHoraNova(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary w-100 fw-bold shadow-sm"
                >
                  Adicionar à Agenda
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div
            className="card shadow-sm border-0"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body p-4">
              <h5 className="fw-bold mb-4" style={{ color: "var(--aa-brown)" }}>
                <i className="bi bi-calendar-week me-2"></i>Meus Horários
                Disponíveis
              </h5>

              {horarios.length === 0 ? (
                <div className="alert alert-light border text-center py-4">
                  <i className="bi bi-inbox fs-1 text-muted opacity-50 mb-2"></i>
                  <p className="mb-0 text-muted">
                    Você ainda não tem horários cadastrados.
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle">
                    <tbody>
                      {horarios.map((h) => (
                        <tr key={h.id}>
                          <td>
                            <div className="d-flex align-items-center">
                              <div
                                className="bg-light rounded p-2 text-center me-3"
                                style={{
                                  minWidth: "70px",
                                  borderLeft: "4px solid var(--aa-orange)",
                                }}
                              >
                                <span className="d-block fw-bold">
                                  {new Date(h.dataHora).toLocaleDateString(
                                    "pt-BR",
                                    { day: "2-digit", month: "short" },
                                  )}
                                </span>
                              </div>
                              <div>
                                <h6 className="mb-0 fw-bold">
                                  {new Date(h.dataHora).toLocaleTimeString(
                                    "pt-BR",
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                </h6>
                                <small className="text-muted">{h.status}</small>
                              </div>
                            </div>
                          </td>
                          <td className="text-end">
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => cancelarHorario(h.id)}
                            >
                              <i className="bi bi-trash"></i> Cancelar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
