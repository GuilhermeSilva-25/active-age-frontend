import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: "PACIENTE" | "MEDICO" | "ADMIN";
}

export function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("activeAgeToken");
    const userStr = localStorage.getItem("activeAgeUser");

    if (!token || !userStr) {
      Swal.fire({
        icon: "warning",
        title: "Acesso Negado",
        text: "Você precisa fazer login para acessar o painel.",
        confirmButtonColor: "var(--aa-orange)",
      }).then(() => {
        navigate("/login");
      });
      return;
    }

    const usuarioLogado: Usuario = JSON.parse(userStr);
    setUser(usuarioLogado);
    setIsLoading(false);
  }, [navigate]);

  if (isLoading || !user) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: "60vh" }}
      >
        <div
          className="spinner-border text-primary"
          style={{ width: "3rem", height: "3rem" }}
          role="status"
        >
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  const renderPaciente = () => (
    <div className="row g-4 animation-fade-in">
      <div className="col-lg-8">
        <div
          className="card shadow-sm border-0 h-100"
          style={{
            borderRadius: "15px",
            borderLeft: "5px solid var(--aa-orange)",
          }}
        >
          <div className="card-body p-4 d-flex flex-column justify-content-center">
            <h4 style={{ color: "var(--aa-brown)" }}>
              <i className="bi bi-calendar-event me-2"></i>Sua Próxima Consulta
            </h4>
            <div className="mt-3 p-3 bg-light rounded d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <h5 className="mb-1 fw-bold">Dr. Carlos Mendes (Geriatra)</h5>
                <p className="mb-0 text-muted">
                  <i className="bi bi-clock me-1"></i> Amanhã, 14:30
                </p>
              </div>
              <button className="btn btn-primary px-4 shadow-sm" disabled>
                <i className="bi bi-camera-video me-2"></i>Entrar na Sala (Em
                breve)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="col-lg-4">
        <Link to="#" className="text-decoration-none">
          <div
            className="card shadow-sm border-0 h-100 service-feature bg-white"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body text-center p-4">
              <div className="mb-3">
                <i
                  className="bi bi-search display-4"
                  style={{ color: "var(--aa-green)" }}
                ></i>
              </div>
              <h4 style={{ color: "var(--aa-brown)" }}>Agendar Consulta</h4>
              <p className="text-muted mb-0">
                Encontre especialistas disponíveis.
              </p>
            </div>
          </div>
        </Link>
      </div>

      <div className="col-md-6">
        <div
          className="card shadow-sm border-0"
          style={{ borderRadius: "15px" }}
        >
          <div className="card-body p-4">
            <h5 style={{ color: "var(--aa-brown)" }}>
              <i className="bi bi-clipboard2-pulse me-2"></i>Meu Histórico
            </h5>
            <p className="text-muted">
              Você ainda não possui consultas finalizadas.
            </p>
          </div>
        </div>
      </div>
      <div className="col-md-6">
        <div
          className="card shadow-sm border-0"
          style={{ borderRadius: "15px" }}
        >
          <div className="card-body p-4">
            <h5 style={{ color: "var(--aa-brown)" }}>
              <i className="bi bi-file-earmark-medical me-2"></i>Minhas Receitas
            </h5>
            <p className="text-muted">Nenhuma receita prescrita no momento.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMedico = () => (
    <div className="row g-4 animation-fade-in">
      <div className="col-12">
        <div
          className="alert alert-warning border-0 shadow-sm d-flex align-items-center"
          role="alert"
          style={{ borderRadius: "10px" }}
        >
          <i className="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
          <div>
            <strong>Atenção:</strong> Seu perfil está em análise pela
            administração (Validação de CRM). Algumas funções estão restritas.
          </div>
        </div>
      </div>

      <div className="col-lg-8">
        <div
          className="card shadow-sm border-0 h-100"
          style={{ borderRadius: "15px" }}
        >
          <div className="card-body p-4">
            <h4 style={{ color: "var(--aa-brown)" }} className="mb-4">
              <i className="bi bi-calendar-check me-2"></i>Consultas de Hoje
            </h4>
            <div className="text-center py-5 text-muted">
              <i className="bi bi-cup-hot display-4 mb-3 d-block text-secondary opacity-50"></i>
              <h5>Sua agenda está livre hoje!</h5>
              <p>Aproveite para atualizar seu perfil ou revisar prontuários.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="col-lg-4 d-flex flex-column gap-4">
        <Link to="#" className="text-decoration-none">
          <div
            className="card shadow-sm border-0 service-feature bg-white p-3"
            style={{ borderRadius: "15px", height: "auto" }}
          >
            <h5 style={{ color: "var(--aa-brown)" }} className="m-0">
              <i className="bi bi-gear me-2"></i>Configurar Agenda
            </h5>
          </div>
        </Link>
        <Link to="#" className="text-decoration-none">
          <div
            className="card shadow-sm border-0 service-feature bg-white p-3"
            style={{ borderRadius: "15px", height: "auto" }}
          >
            <h5 style={{ color: "var(--aa-brown)" }} className="m-0">
              <i className="bi bi-person-lines-fill me-2"></i>Meus Pacientes
            </h5>
          </div>
        </Link>
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="row g-4 animation-fade-in">
      <div className="col-md-4">
        <div
          className="card shadow-sm border-0 text-center p-4 h-100"
          style={{
            borderRadius: "15px",
            borderBottom: "5px solid var(--aa-orange)",
          }}
        >
          <i
            className="bi bi-people-fill display-4 mb-2"
            style={{ color: "var(--aa-brown)" }}
          ></i>
          <h2 className="fw-bold">124</h2>
          <p className="text-muted mb-0">Pacientes Ativos</p>
        </div>
      </div>
      <div className="col-md-4">
        <div
          className="card shadow-sm border-0 text-center p-4 h-100"
          style={{
            borderRadius: "15px",
            borderBottom: "5px solid var(--aa-green)",
          }}
        >
          <i
            className="bi bi-bandaid display-4 mb-2"
            style={{ color: "var(--aa-brown)" }}
          ></i>
          <h2 className="fw-bold">18</h2>
          <p className="text-muted mb-0">Médicos Aprovados</p>
        </div>
      </div>
      <div className="col-md-4">
        <div
          className="card shadow-sm border-0 text-center p-4 h-100 bg-warning bg-opacity-10"
          style={{ borderRadius: "15px", borderBottom: "5px solid #ffc107" }}
        >
          <i className="bi bi-person-vcard display-4 mb-2 text-warning"></i>
          <h2 className="fw-bold">3</h2>
          <p className="text-muted mb-0">Validações de CRM Pendentes</p>
          <button className="btn btn-warning btn-sm mt-2 fw-bold text-dark">
            Revisar Agora
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <main className="container my-5 pb-5">
      {/* Cabeçalho do Dashboard Limpo */}
      <div className="mb-5 pb-3 border-bottom">
        <h1 className="fw-bold mb-1" style={{ color: "var(--aa-brown)" }}>
          Olá, {user.nome.split(" ")[0]}! 👋
        </h1>
        <p className="fs-5 text-muted mb-0">
          {user.tipo === "PACIENTE" && "Como está sua saúde hoje?"}
          {user.tipo === "MEDICO" && "Bem-vindo(a) ao seu consultório virtual."}
          {user.tipo === "ADMIN" && "Visão geral da plataforma Active Age."}
        </p>
      </div>

      {user.tipo === "PACIENTE" && renderPaciente()}
      {user.tipo === "MEDICO" && renderMedico()}
      {user.tipo === "ADMIN" && renderAdmin()}

      <style>{`
        .animation-fade-in {
          animation: fadeIn 0.4s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
