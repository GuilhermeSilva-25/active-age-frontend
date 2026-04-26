import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: "PACIENTE" | "MEDICO" | "ADMIN";
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
}

export function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<Usuario | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userStr = localStorage.getItem("activeAgeUser");
    if (!userStr) {
      navigate("/login");
      return;
    }
    const usuarioLogado: Usuario = JSON.parse(userStr);
    setUser(usuarioLogado);
    carregarDados(usuarioLogado);
  }, [navigate]);

  const carregarDados = async (u: Usuario) => {
    try {
      const rota =
        u.tipo === "PACIENTE" ? `paciente/${u.id}` : `medico/${u.id}/todos`;
      const res = await fetch(`http://localhost:8080/api/agendamentos/${rota}`);
      if (res.ok) {
        const data = await res.json();
        setAgendamentos(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelar = async (id: string) => {
    Swal.fire({
      title: "Deseja cancelar?",
      text:
        user?.tipo === "PACIENTE"
          ? "O horário voltará para a agenda do médico."
          : "Este horário será invalidado.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sim, cancelar",
      cancelButtonText: "Voltar",
    }).then(async (result) => {
      if (result.isConfirmed && user) {
        const res = await fetch(
          `http://localhost:8080/api/agendamentos/cancelar/${id}/usuario/${user.id}`,
          { method: "PUT" },
        );
        if (res.ok) {
          Swal.fire("Cancelado", "Consulta cancelada com sucesso.", "success");
          carregarDados(user);
        }
      }
    });
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

  if (isLoading || !user)
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary"></div>
      </div>
    );

  const agendamentosFuturos = agendamentos
    .filter(
      (a) => a.status === "AGENDADO" && new Date(a.dataHora) >= new Date(),
    )
    .sort(
      (a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime(),
    );

  const proxima =
    agendamentosFuturos.length > 0 ? agendamentosFuturos[0] : null;
  const outrasConsultas = agendamentosFuturos.filter(
    (a) => a.id !== proxima?.id,
  );

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
                    {proxima.medicoEspecializacao || "Geriatria"} | CRM:{" "}
                    {proxima.medicoCrm || "N/A"}
                  </p>
                  <p className="mb-0 text-dark fw-bold fs-5">
                    <i className="bi bi-calendar3 text-primary me-2"></i>
                    {formatarDataHora(proxima.dataHora).dia} às{" "}
                    {formatarDataHora(proxima.dataHora).hora}
                  </p>
                </div>
                <div className="d-flex flex-column gap-2 align-items-stretch">
                  <a
                    href={proxima.linkTeleconsulta}
                    target="_blank"
                    className="btn btn-primary shadow-sm btn-lg fw-bold"
                  >
                    <i className="bi bi-camera-video me-2"></i>Entrar na Sala
                  </a>
                  <button
                    className="btn btn-outline-danger shadow-sm"
                    onClick={() => handleCancelar(proxima.id)}
                  >
                    Cancelar Consulta
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
            <h5 style={{ color: "var(--aa-brown)" }} className="mb-4">
              <i className="bi bi-list-ul me-2"></i>Minha Agenda
            </h5>
            {outrasConsultas.length > 0 ? (
              <div className="d-flex flex-column gap-3">
                {outrasConsultas.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 border shadow-sm bg-white d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3"
                    style={{ borderRadius: "12px" }}
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
                      <span className="badge bg-primary bg-opacity-10 text-primary border border-primary fs-6 px-3 py-2 rounded-pill">
                        <i className="bi bi-clock-fill me-2"></i>
                        {formatarDataHora(a.dataHora).dia} às{" "}
                        {formatarDataHora(a.dataHora).hora}
                      </span>
                    </div>
                    <div>
                      <button
                        className="btn btn-outline-danger px-4 shadow-sm fw-bold"
                        onClick={() => handleCancelar(a.id)}
                      >
                        <i className="bi bi-x-circle me-2"></i>Cancelar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="alert alert-light text-center border">
                <p className="text-muted small mb-0">
                  Sem outros compromissos na agenda.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-lg-4">
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
      </div>
    </div>
  );

  const renderMedico = () => (
    <div className="row g-4 animation-fade-in">
      <div className="col-lg-8">
        <div
          className="card shadow-sm border-0 h-100"
          style={{ borderRadius: "15px" }}
        >
          <div className="card-body p-4">
            <h4 style={{ color: "var(--aa-brown)" }} className="mb-4">
              <i className="bi bi-calendar-check me-2"></i>Agenda do Dia
            </h4>
            {agendamentos.filter((a) => a.status === "AGENDADO").length > 0 ? (
              <div className="list-group list-group-flush gap-2">
                {agendamentos
                  .filter((a) => a.status === "AGENDADO")
                  .sort(
                    (a, b) =>
                      new Date(a.dataHora).getTime() -
                      new Date(b.dataHora).getTime(),
                  )
                  .map((a) => (
                    <div
                      key={a.id}
                      className="list-group-item d-flex flex-column flex-md-row justify-content-between align-items-md-center border rounded p-3 shadow-sm bg-white"
                    >
                      <div
                        className="mb-3 mb-md-0 ps-3"
                        style={{ borderLeft: "4px solid var(--aa-orange)" }}
                      >
                        <span className="fw-bold fs-5 text-dark d-block">
                          {formatarDataHora(a.dataHora).dia} às{" "}
                          {formatarDataHora(a.dataHora).hora}
                        </span>
                        <span className="text-muted fw-semibold small">
                          <i className="bi bi-person-fill me-1"></i> Paciente
                          Identificado
                        </span>
                      </div>

                      <div className="d-flex gap-2 w-100 w-md-auto justify-content-end">
                        <button
                          className="btn btn-outline-danger px-3 shadow-sm fw-bold"
                          onClick={() => handleCancelar(a.id)}
                        >
                          Cancelar
                        </button>
                        <a
                          href={a.linkTeleconsulta}
                          target="_blank"
                          className="btn btn-primary px-4 shadow-sm fw-bold"
                        >
                          <i className="bi bi-camera-video me-2"></i>Iniciar
                        </a>
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
      </div>
      <div className="col-lg-4 d-flex flex-column gap-4">
        <Link to="/agenda-medico" className="text-decoration-none">
          <div
            className="card shadow-sm border-0 service-feature bg-white p-3"
            style={{ borderRadius: "15px" }}
          >
            <h5 style={{ color: "var(--aa-brown)" }} className="m-0">
              <i className="bi bi-gear me-2"></i>Configurar Agenda
            </h5>
          </div>
        </Link>
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
          <p className="fs-5 text-muted mb-0">Bem-vindo ao Active Age.</p>
        </div>
        <Link to="/perfil" className="btn btn-outline-secondary px-4">
          <i className="bi bi-person-lines-fill me-2"></i>Editar Perfil
        </Link>
      </div>
      {user.tipo === "PACIENTE" ? renderPaciente() : renderMedico()}
      <style>{`.animation-fade-in { animation: fadeIn 0.4s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </main>
  );
}
