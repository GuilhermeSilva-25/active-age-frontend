import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

const LISTA_ESPECIALIDADES = [
  "Cardiologia",
  "Neurologia",
  "Psiquiatria",
  "Ortopedia",
  "Nutrologia",
  "Oncologia",
  "Reumatologia",
  "Endocrinologia",
  "Dermatologia",
  "Pneumologia",
];

interface Medico {
  id: string;
  nome: string;
  crm: string;
  especializacao?: string;
}

export function BuscaMedicos() {
  const navigate = useNavigate();
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [buscaNome, setBuscaNome] = useState("");
  const [filtroEspecialidade, setFiltroEspecialidade] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const paletaFundo = ["90c28d", "007bff", "17a2b8", "6f42c1", "e86542"];
  const paletaBorda = ["5a3a2d", "6c757d", "343a40", "28a745", "dc3545"];

  const getCoresAvatar = (nome: string) => {
    let hash = 0;
    for (let i = 0; i < nome.length; i++)
      hash = nome.charCodeAt(i) + ((hash << 5) - hash);
    return {
      fundo: paletaFundo[Math.abs(hash) % paletaFundo.length],
      borda: paletaBorda[Math.abs(hash * 2) % paletaBorda.length],
    };
  };

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
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const medicosFiltrados = medicos.filter((medico) => {
    const matchNome = medico.nome
      .toLowerCase()
      .includes(buscaNome.toLowerCase());
    const matchEsp =
      filtroEspecialidade === "" ||
      (medico.especializacao &&
        medico.especializacao.includes(filtroEspecialidade));
    return matchNome && matchEsp;
  });

  return (
    <main className="container my-5 pb-5">
      <header className="mb-5 pb-3 border-bottom">
        <Link to="/dashboard" className="btn btn-outline-secondary mb-3">
          <i className="bi bi-arrow-left me-2"></i>Voltar
        </Link>
        <h1 className="fw-bold mb-1" style={{ color: "var(--aa-brown)" }}>
          Especialistas
        </h1>
        <p className="fs-5 text-muted mb-0">
          Encontre geriatras e especialistas integrados.
        </p>
      </header>

      <section className="row justify-content-center mb-5">
        <div className="col-lg-8">
          <div
            className="card shadow-sm border-0"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body p-4 d-flex gap-3 flex-column flex-md-row">
              <div className="input-group input-group-lg w-100">
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="Buscar por nome..."
                  value={buscaNome}
                  onChange={(e) => setBuscaNome(e.target.value)}
                />
              </div>
              <select
                className="form-select form-select-lg"
                style={{ maxWidth: "250px" }}
                value={filtroEspecialidade}
                onChange={(e) => setFiltroEspecialidade(e.target.value)}
              >
                <option value="">Todas (Geriatria)</option>
                {LISTA_ESPECIALIDADES.map((esp) => (
                  <option key={esp} value={esp}>
                    {esp}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary"></div>
        </div>
      ) : medicosFiltrados.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <h4>Nenhum médico encontrado.</h4>
        </div>
      ) : (
        <div className="row g-4">
          {medicosFiltrados.map((medico) => {
            const cores = getCoresAvatar(medico.nome);
            return (
              <div className="col-md-6 col-lg-4" key={medico.id}>
                <div
                  className="card shadow-sm border-0 h-100 bg-white"
                  style={{ borderRadius: "15px", transition: "transform 0.2s" }}
                >
                  <div className="card-body text-center p-4 d-flex flex-column">
                    <img
                      src={`https://ui-avatars.com/api/?name=${medico.nome.replace(" ", "+")}&background=${cores.fundo}&color=fff&size=100`}
                      alt={medico.nome}
                      className="rounded-circle shadow-sm mx-auto mb-3"
                      style={{
                        border: `4px solid #${cores.borda}`,
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
                    <p
                      className="text-muted mb-2 fw-semibold"
                      style={{ color: `var(--aa-green)` }}
                    >
                      <i className="bi bi-star-fill text-warning me-1"></i>{" "}
                      {medico.especializacao}
                    </p>
                    <span className="badge bg-light text-dark border mb-4 mx-auto p-2 w-75">
                      CRM: {medico.crm}
                    </span>

                    <div className="mt-auto">
                      <button
                        className="btn btn-primary w-100 py-2 fw-bold shadow-sm"
                        onClick={() => Swal.fire("Agenda", "Em breve!", "info")}
                      >
                        <i className="bi bi-calendar-plus me-2"></i> Ver Agenda
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
