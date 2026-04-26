import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  tipo: "PACIENTE" | "MEDICO" | "ADMIN";
  crm?: string;
  cpf?: string;
  statusValidacao?: "PENDENTE" | "EM_ANALISE" | "APROVADO" | "REPROVADO";
  mensagemValidacao?: string;
}

export function Perfil() {
  const navigate = useNavigate();
  const [user, setUser] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [crm, setCrm] = useState("");

  const [email, setEmail] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("activeAgeToken");
    const userStr = localStorage.getItem("activeAgeUser");

    if (!token || !userStr) {
      navigate("/login");
      return;
    }

    const usuarioLogado: Usuario = JSON.parse(userStr);
    setUser(usuarioLogado);

    setNome(usuarioLogado.nome || "");
    setEmail(usuarioLogado.email || "");
    setTelefone(usuarioLogado.telefone || "");
    setCrm(usuarioLogado.crm || "");

    setIsLoading(false);
  }, [navigate]);

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{2})(\d)/, "($1) $2");
    value = value.replace(/(\d{5})(\d{1,4})$/, "$1-$2");
    setTelefone(value);
  };

  const handleCrmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "");
    const numeros = value.replace(/[^0-9]/g, "");
    let letras = value.replace(/[^A-Z]/g, "");
    if (letras.length > 2) letras = letras.slice(0, 2);
    if (letras.length > 0) {
      setCrm(`${numeros}/${letras}`);
    } else {
      setCrm(numeros);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    if (nome.trim().split(/\s+/).length < 2) {
      Swal.fire({
        icon: "warning",
        title: "Nome Incompleto",
        text: "Por favor, informe seu nome e sobrenome.",
      });
      setIsSaving(false);
      return;
    }

    if (user?.tipo === "MEDICO" && (!crm || !/^\d+\/[A-Z]{2}$/.test(crm))) {
      Swal.fire({
        icon: "warning",
        title: "CRM Incompleto",
        text: "Por favor, digite os números e a sigla do estado.",
      });
      setIsSaving(false);
      return;
    }

    const telefoneLimpo = telefone.replace(/\D/g, "");

    const payload = {
      nome,
      telefone: telefoneLimpo,
      crm: user?.tipo === "MEDICO" ? crm : undefined,
    };

    try {
      const res = await fetch(
        `http://localhost:8080/api/usuarios/perfil/${user?.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("activeAgeToken")}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        const usuarioAtualizado = await res.json();

        if (
          usuarioAtualizado.tipo === "MEDICO" &&
          user?.statusValidacao === "REPROVADO"
        ) {
          usuarioAtualizado.statusValidacao = "PENDENTE";
        }

        localStorage.setItem(
          "activeAgeUser",
          JSON.stringify(usuarioAtualizado),
        );
        setUser(usuarioAtualizado);

        Swal.fire(
          "Atualizado!",
          "Seus dados foram salvos com sucesso.",
          "success",
        );
      } else {
        const userFakeUpdate = {
          ...user,
          nome,
          telefone,
          crm,
          statusValidacao:
            user?.statusValidacao === "REPROVADO"
              ? "PENDENTE"
              : user?.statusValidacao,
        };
        localStorage.setItem("activeAgeUser", JSON.stringify(userFakeUpdate));
        setUser(userFakeUpdate as Usuario);

        Swal.fire(
          "Atualizado!",
          "Seus dados foram atualizados no navegador (Modo Simulação).",
          "success",
        );
      }
    } catch (error) {
      Swal.fire("Erro", "Não foi possível conectar ao servidor.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: "60vh" }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  const avatarColor =
    user.tipo === "PACIENTE"
      ? "90c28d"
      : user.tipo === "MEDICO"
        ? "e86542"
        : "5a3a2d";
  const isCrmBloqueado =
    user.tipo === "MEDICO" &&
    (user.statusValidacao === "EM_ANALISE" ||
      user.statusValidacao === "APROVADO");

  return (
    <main className="container my-5 pb-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <header className="mb-5 pb-3 border-bottom d-flex align-items-center">
            <img
              src={`https://ui-avatars.com/api/?name=${user.nome.replace(" ", "+")}&background=${avatarColor}&color=fff&size=80`}
              alt="Avatar"
              className="rounded-circle shadow-sm me-4"
              style={{ border: `3px solid #${avatarColor}` }}
            />
            <div>
              <h1 className="fw-bold mb-1" style={{ color: "var(--aa-brown)" }}>
                Meu Perfil
              </h1>
              <p className="fs-5 text-muted mb-0">
                Gerencie suas informações pessoais e credenciais.
              </p>
            </div>
          </header>

          {user.tipo === "MEDICO" && user.statusValidacao === "REPROVADO" && (
            <div className="alert alert-danger shadow-sm mb-4" role="alert">
              <h4 className="alert-heading fw-bold">
                <i className="bi bi-exclamation-octagon-fill me-2"></i>Atenção
                Necessária
              </h4>
              <p>
                Sua validação foi recusada pelo administrador:{" "}
                <strong>"{user.mensagemValidacao}"</strong>
              </p>
              <hr />
              <p className="mb-0">
                Por favor, atualize os dados incorretos abaixo e salve para
                submeter a uma nova análise.
              </p>
            </div>
          )}

          <div
            className="card shadow-sm border-0 mb-4"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-header bg-white p-4 border-bottom-0">
              <h4 className="mb-0 fw-bold" style={{ color: "var(--aa-brown)" }}>
                <i className="bi bi-person-lines-fill me-2"></i>Dados Pessoais
              </h4>
            </div>
            <div className="card-body p-4 pt-0">
              <form onSubmit={handleUpdateProfile}>
                <div className="row g-3 mb-3">
                  <div className="col-md-12">
                    <div className="form-floating">
                      <input
                        type="text"
                        className="form-control"
                        id="nome"
                        placeholder="Nome Completo"
                        required
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                      />
                      <label htmlFor="nome">Nome Completo</label>
                    </div>
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <div className="form-floating">
                      <input
                        type="email"
                        className="form-control bg-light"
                        id="email"
                        value={email}
                        readOnly
                        disabled
                      />
                      <label htmlFor="email">E-mail (Não alterável)</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-floating">
                      <input
                        type="tel"
                        className="form-control"
                        id="telefone"
                        placeholder="(11) 99999-9999"
                        value={telefone}
                        onChange={handleTelefoneChange}
                      />
                      <label htmlFor="telefone">Telefone</label>
                    </div>
                  </div>
                </div>

                {user.tipo === "MEDICO" && (
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <div className="form-floating">
                        <input
                          type="text"
                          className={`form-control ${isCrmBloqueado ? "bg-light" : ""}`}
                          id="crm"
                          placeholder="CRM"
                          value={crm}
                          onChange={handleCrmChange}
                          readOnly={isCrmBloqueado}
                          disabled={isCrmBloqueado}
                        />
                        <label htmlFor="crm">
                          CRM {isCrmBloqueado && "(Validado)"}
                        </label>
                      </div>
                      {isCrmBloqueado && (
                        <small className="text-muted mt-1 d-block">
                          <i className="bi bi-lock-fill me-1"></i>O CRM não pode
                          ser alterado durante ou após a análise.
                        </small>
                      )}
                    </div>
                  </div>
                )}

                {user.tipo === "PACIENTE" && user.cpf && (
                  <div className="row g-3 mb-4">
                    <div className="col-md-6">
                      <div className="form-floating">
                        <input
                          type="text"
                          className="form-control bg-light"
                          id="cpf"
                          value={user.cpf}
                          readOnly
                          disabled
                        />
                        <label htmlFor="cpf">CPF (Não alterável)</label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="d-flex justify-content-end">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg px-5 shadow-sm"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>{" "}
                        Salvando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-floppy me-2"></i>Salvar Alterações
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div
            className="card shadow-sm border-0"
            style={{ borderRadius: "15px" }}
          >
            <div
              className="card-body p-4 d-flex justify-content-between align-items-center bg-light rounded-bottom"
              style={{ borderRadius: "15px" }}
            >
              <div>
                <h5
                  className="fw-bold mb-1"
                  style={{ color: "var(--aa-brown)" }}
                >
                  <i className="bi bi-shield-lock me-2"></i>Segurança
                </h5>
                <p className="text-muted mb-0">
                  Deseja alterar sua senha de acesso?
                </p>
              </div>
              <button
                className="btn btn-outline-secondary"
                onClick={() =>
                  Swal.fire(
                    "Em Breve",
                    "A funcionalidade de troca de senha será liberada nas próximas atualizações.",
                    "info",
                  )
                }
              >
                Alterar Senha
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
