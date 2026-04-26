import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

interface Medico {
  id: string;
  nome: string;
  crm: string;
}

export function BuscaMedicos() {
  const navigate = useNavigate();
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [buscaNome, setBuscaNome] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("activeAgeToken")) {
      navigate("/login");
      return;
    }
    carregarMedicos();
  }, [navigate]);

  const carregarMedicos = async () => {
    try {
      const response = await fetch(
        "http://localhost:8080/api/usuarios/medicos",
      );
      if (response.ok) {
        const data = await response.json();
        setMedicos(data);
      } else {
        Swal.fire(
          "Erro",
          "Não foi possível carregar a lista de especialistas.",
          "error",
        );
      }
    } catch (error) {
      console.error(error);
      Swal.fire("Sem Conexão", "O servidor parece estar offline.", "warning");
    } finally {
      setIsLoading(false);
    }
  };

  const medicosFiltrados = medicos.filter((medico) =>
    medico.nome.toLowerCase().includes(buscaNome.toLowerCase()),
  );

  return (
    <main className="container my-5 pb-5">
      <header className="mb-5 pb-3 border-bottom">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <Link to="/dashboard" className="btn btn-outline-secondary mb-3">
              <i className="bi bi-arrow-left me-2"></i>Voltar ao Painel
            </Link>
            <h1 className="fw-bold mb-1" style={{ color: "var(--aa-brown)" }}>
              Especialistas
            </h1>
            <p className="fs-5 text-muted mb-0">
              Encontre e agende consultas com nossos geriatras aprovados.
            </p>
          </div>
        </div>
      </header>

      <section className="row justify-content-center mb-5">
        <div className="col-lg-8">
          <div
            className="card shadow-sm border-0"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body p-4 d-flex gap-3 flex-column flex-md-row">
              <div className="input-group input-group-lg w-100">
                <span className="input-group-text bg-white border-end-0 text-muted">
                  <i className="bi bi-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="Buscar médico por nome..."
                  value={buscaNome}
                  onChange={(e) => setBuscaNome(e.target.value)}
                />
              </div>
              <select
                className="form-select form-select-lg"
                style={{ maxWidth: "250px" }}
                disabled
              >
                <option value="">Todas Especialidades</option>
                <option value="geriatria" selected>
                  Geriatria
                </option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="text-center py-5">
          <div
            className="spinner-border text-primary"
            style={{ width: "3rem", height: "3rem" }}
            role="status"
          ></div>
          <p className="mt-3 text-muted">Buscando especialistas...</p>
        </div>
      ) : medicosFiltrados.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-emoji-frown display-1 text-muted opacity-50 mb-3"></i>
          <h3 style={{ color: "var(--aa-brown)" }}>Nenhum médico encontrado</h3>
          <p className="text-muted">
            Tente buscar por outro nome ou verifique a ortografia.
          </p>
        </div>
      ) : (
        <div className="row g-4">
          {medicosFiltrados.map((medico) => (
            <div className="col-md-6 col-lg-4" key={medico.id}>
              <div
                className="card shadow-sm border-0 h-100 service-feature bg-white"
                style={{ borderRadius: "15px", cursor: "default" }}
              >
                <div className="card-body text-center p-4 d-flex flex-column">
                  <img
                    src={`https://ui-avatars.com/api/?name=${medico.nome.replace(" ", "+")}&background=e86542&color=fff&size=100`}
                    alt={medico.nome}
                    className="rounded-circle shadow-sm mx-auto mb-3"
                    style={{
                      border: "4px solid var(--aa-orange)",
                      width: "100px",
                      height: "100px",
                    }}
                  />
                  <h4
                    className="fw-bold mb-1"
                    style={{ color: "var(--aa-brown)" }}
                  >
                    {medico.nome}
                  </h4>
                  <p className="text-muted mb-2">
                    <i className="bi bi-star-fill text-warning me-1"></i>{" "}
                    Geriatra
                  </p>
                  <span className="badge bg-light text-dark border mb-4 mx-auto p-2 w-75">
                    CRM: {medico.crm}
                  </span>

                  <div className="mt-auto">
                    <button
                      className="btn btn-primary w-100 py-2 fw-bold"
                      onClick={() =>
                        Swal.fire(
                          "Em Breve",
                          "A funcionalidade de ver a agenda e marcar horário será implementada no próximo módulo (UC06).",
                          "info",
                        )
                      }
                    >
                      <i className="bi bi-calendar-plus me-2"></i> Ver Agenda
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
