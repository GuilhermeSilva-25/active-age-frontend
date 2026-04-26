import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Swal from "sweetalert2";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: "PACIENTE" | "MEDICO" | "ADMIN";
  crm?: string;
  statusValidacao?: "PENDENTE" | "EM_ANALISE" | "APROVADO" | "REPROVADO";
  mensagemValidacao?: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pedidosAdmin, setPedidosAdmin] = useState<Usuario[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("activeAgeToken");
    const userStr = localStorage.getItem("activeAgeUser");

    if (!token || !userStr) {
      navigate("/login");
      return;
    }

    const usuarioLogado: Usuario = JSON.parse(userStr);

    if (usuarioLogado.tipo === "MEDICO" && !usuarioLogado.statusValidacao) {
      usuarioLogado.statusValidacao = "PENDENTE";
    }

    setUser(usuarioLogado);

    if (usuarioLogado.tipo === "ADMIN") {
      carregarPendentes();
    }

    setIsLoading(false);
  }, [navigate]);

  const carregarPendentes = async () => {
    try {
      const res = await fetch("http://localhost:8080/api/validacoes/pendentes");
      if (res.ok) {
        const data = await res.json();
        setPedidosAdmin(data);
      }
    } catch (error) {
      console.error("Erro ao buscar pendentes:", error);
    }
  };

  const solicitarValidacao = async () => {
    if (!user) return;
    try {
      const res = await fetch(
        `http://localhost:8080/api/validacoes/solicitar/${user.id}`,
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

  const enviarAvaliacao = async (
    id: string,
    nome: string,
    status: string,
    mensagem: string,
  ) => {
    try {
      const res = await fetch(
        `http://localhost:8080/api/validacoes/avaliar/${id}`,
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
        enviarAvaliacao(id, nome, "APROVADO", "Aprovado com sucesso.");
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
        enviarAvaliacao(id, nome, "REPROVADO", result.value);
    });
  };

  const getPrimeiroNome = (nomeCompleto: string) => {
    const partes = nomeCompleto.trim().split(" ");
    if (
      partes[0].toLowerCase() === "dr." ||
      partes[0].toLowerCase() === "dra."
    ) {
      return partes.length > 1 ? `${partes[0]} ${partes[1]}` : partes[0];
    }
    return partes[0];
  };

  if (isLoading || !user) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary"></div>
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
                <i className="bi bi-camera-video me-2"></i>Entrar na Sala
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="col-lg-4">
        <Link to="/busca" className="text-decoration-none">
          <div
            className="card shadow-sm border-0 h-100 service-feature bg-white"
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
              <p className="text-muted mb-0">
                Encontre especialistas disponíveis.
              </p>
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
                  <p>
                    Aproveite para atualizar seu perfil ou revisar prontuários.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-4 d-flex flex-column gap-4">
            <Link to="/agenda-medico" className="text-decoration-none">
              <div
                className="card shadow-sm border-0 service-feature bg-white p-3"
                style={{
                  borderRadius: "15px",
                  height: "auto",
                  cursor: "pointer",
                }}
              >
                <h5 style={{ color: "var(--aa-brown)" }} className="m-0">
                  <i className="bi bi-gear me-2"></i>Configurar Agenda
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
                    Confirme seus dados abaixo para enviar à moderação.
                  </p>
                  <button
                    className="btn btn-primary btn-lg px-5"
                    onClick={solicitarValidacao}
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
                    Sua solicitação está sendo analisada pela equipe
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
            <i className="bi bi-check-circle-fill me-2"></i>Tudo limpo!
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
                        className="btn btn-success w-50"
                        onClick={() => aprovarMedico(pedido.id, pedido.nome)}
                      >
                        <i className="bi bi-check-lg me-1"></i> Aprovar
                      </button>
                      <button
                        className="btn btn-outline-danger w-50"
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
      <div className="mb-5 pb-3 border-bottom d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
        <div>
          <h1 className="fw-bold mb-1" style={{ color: "var(--aa-brown)" }}>
            Olá, {getPrimeiroNome(user.nome)}! 👋
          </h1>
          <p className="fs-5 text-muted mb-0">
            {user.tipo === "PACIENTE" && "Como está sua saúde hoje?"}
            {user.tipo === "MEDICO" &&
              "Área restrita para profissionais da saúde."}
            {user.tipo === "ADMIN" && "Painel Administrativo Active Age."}
          </p>
        </div>

        {user.tipo !== "ADMIN" && (
          <div>
            <Link
              to="/perfil"
              className="btn btn-outline-secondary shadow-sm px-4"
            >
              <i className="bi bi-person-lines-fill me-2"></i>Editar Perfil
            </Link>
          </div>
        )}
      </div>

      {user.tipo === "PACIENTE" && renderPaciente()}
      {user.tipo === "MEDICO" && renderMedico()}
      {user.tipo === "ADMIN" && renderAdmin()}

      <style>{`.animation-fade-in { animation: fadeIn 0.4s ease-in-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </main>
  );
}
