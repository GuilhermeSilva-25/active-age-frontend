import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

export function Cadastro() {
  const navigate = useNavigate();

  const [tipoUsuario, setTipoUsuario] = useState<"PACIENTE" | "MEDICO">(
    "PACIENTE",
  );
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [crm, setCrm] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [aceitaTermos, setAceitaTermos] = useState(false);

  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmSenha, setShowConfirmSenha] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d)/, "$1.$2");
    value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    setCpf(value);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nome.trim().split(/\s+/).length < 2) {
      Swal.fire({
        icon: "warning",
        title: "Nome Incompleto",
        text: "Por favor, informe seu nome e sobrenome.",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Swal.fire({
        icon: "warning",
        title: "E-mail Inválido",
        text: "Por favor, informe um e-mail válido com domínio (ex: @gmail.com).",
      });
      return;
    }

    if (tipoUsuario === "MEDICO") {
      const crmRegex = /^\d+\/[A-Z]{2}$/;
      if (!crmRegex.test(crm)) {
        Swal.fire({
          icon: "warning",
          title: "CRM Incompleto",
          text: "Por favor, digite os números e a sigla do estado (Ex: 123456/SP).",
        });
        return;
      }
    }

    if (senha !== confirmarSenha) {
      Swal.fire({
        icon: "error",
        title: "Senhas Diferentes",
        text: "As senhas que você digitou não são iguais.",
      });
      return;
    }

    if (!aceitaTermos) {
      Swal.fire({
        icon: "warning",
        title: "Termos Obrigatórios",
        text: "Você precisa aceitar os Termos de Uso.",
      });
      return;
    }

    setIsLoading(true);

    const cpfLimpo = cpf.replace(/\D/g, "");
    const telefoneLimpo = telefone.replace(/\D/g, "");

    const payload = {
      nome,
      email,
      senha,
      tipo: tipoUsuario,
      cpf: tipoUsuario === "PACIENTE" ? cpfLimpo : null,
      crm: tipoUsuario === "MEDICO" ? crm : null,
      telefone: telefoneLimpo,
    };

    try {
      const response = await fetch("http://localhost:8080/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Swal.fire({
          icon: "success",
          title: "Conta Criada!",
          text: "Seu cadastro foi realizado com sucesso. Faça seu login agora.",
          confirmButtonColor: "var(--aa-green)",
        }).then(() => {
          navigate("/login");
        });
      } else {
        const errorData = await response.json().catch(() => null);
        Swal.fire({
          icon: "error",
          title: "Atenção",
          text:
            errorData?.message ||
            "Este e-mail já está cadastrado em nossa base.",
          confirmButtonColor: "var(--aa-orange)",
        });
      }
    } catch (error) {
      console.error("Erro de requisição:", error);
      Swal.fire({
        icon: "warning",
        title: "Sistema Indisponível",
        text: "Nossos servidores estão passando por uma instabilidade momentânea. Por favor, tente novamente em alguns instantes.",
        confirmButtonColor: "var(--aa-orange)",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container my-5">
      <div className="row justify-content-center">
        <div className="col-lg-7 col-md-9">
          <header className="text-center mb-4">
            <h1 className="fw-bold mb-3" style={{ color: "var(--aa-brown)" }}>
              Crie sua Conta
            </h1>
            <p className="fs-5 text-muted">
              Bem-vindo ao Active Age! Vamos começar.
            </p>
          </header>

          <div
            className="card shadow-sm border-0"
            style={{ borderRadius: "15px" }}
          >
            <div className="card-body p-4 p-md-5">
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label
                    className="form-label mb-3 fw-bold fs-5"
                    style={{ color: "var(--aa-brown)" }}
                  >
                    Qual tipo de perfil você deseja criar?
                  </label>
                  <div className="row g-3">
                    <div className="col-sm-6">
                      <input
                        type="radio"
                        className="btn-check"
                        name="tipoUsuario"
                        id="radioPaciente"
                        checked={tipoUsuario === "PACIENTE"}
                        onChange={() => {
                          setTipoUsuario("PACIENTE");
                          setCrm("");
                        }}
                      />
                      <label
                        className="btn btn-outline-primary w-100 p-4 h-100 d-flex flex-column align-items-center justify-content-center"
                        htmlFor="radioPaciente"
                      >
                        <i className="bi bi-person-heart fs-1 mb-2"></i>
                        <span className="fs-5 fw-bold">
                          Paciente ou Cuidador
                        </span>
                      </label>
                    </div>
                    <div className="col-sm-6">
                      <input
                        type="radio"
                        className="btn-check"
                        name="tipoUsuario"
                        id="radioMedico"
                        checked={tipoUsuario === "MEDICO"}
                        onChange={() => {
                          setTipoUsuario("MEDICO");
                          setCpf("");
                        }}
                      />
                      <label
                        className="btn btn-outline-primary w-100 p-4 h-100 d-flex flex-column align-items-center justify-content-center"
                        htmlFor="radioMedico"
                      >
                        <i className="bi bi-bandaid fs-1 mb-2"></i>
                        <span className="fs-5 fw-bold">Médico Geriatra</span>
                        <small className="mt-1 opacity-75">(Requer CRM)</small>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-floating mb-3">
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

                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <div className="form-floating">
                      <input
                        type="email"
                        className="form-control"
                        id="email"
                        placeholder="seu@email.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <label htmlFor="email">E-mail</label>
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
                      <label htmlFor="telefone">Telefone (Opcional)</label>
                    </div>
                  </div>
                </div>

                <div
                  className="form-floating mb-3"
                  style={{ animation: "fadeIn 0.3s" }}
                >
                  {tipoUsuario === "PACIENTE" ? (
                    <>
                      <input
                        type="text"
                        className="form-control"
                        id="cpf"
                        placeholder="000.000.000-00"
                        required
                        value={cpf}
                        onChange={handleCpfChange}
                      />
                      <label htmlFor="cpf">CPF</label>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        className="form-control"
                        id="crm"
                        placeholder="123456/SP"
                        required
                        value={crm}
                        onChange={handleCrmChange}
                      />
                      <label htmlFor="crm">
                        CRM (Digite os números e a sigla do estado)
                      </label>
                    </>
                  )}
                </div>

                <div className="form-floating mb-3 position-relative">
                  <input
                    type={showSenha ? "text" : "password"}
                    className="form-control pe-5"
                    id="senha"
                    placeholder="Senha"
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                  <label htmlFor="senha">Crie uma Senha</label>
                  <button
                    type="button"
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-secondary px-3"
                    onClick={() => setShowSenha(!showSenha)}
                  >
                    <i
                      className={`bi ${showSenha ? "bi-eye" : "bi-eye-slash"} fs-5`}
                    ></i>
                  </button>
                </div>

                <div className="form-floating mb-4 position-relative">
                  <input
                    type={showConfirmSenha ? "text" : "password"}
                    className="form-control pe-5"
                    id="confirmarSenha"
                    placeholder="Confirme sua Senha"
                    required
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                  />
                  <label htmlFor="confirmarSenha">Confirme sua Senha</label>
                  <button
                    type="button"
                    className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-secondary px-3"
                    onClick={() => setShowConfirmSenha(!showConfirmSenha)}
                  >
                    <i
                      className={`bi ${showConfirmSenha ? "bi-eye" : "bi-eye-slash"} fs-5`}
                    ></i>
                  </button>
                </div>

                <div className="form-check mb-4">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="termos"
                    required
                    checked={aceitaTermos}
                    onChange={(e) => setAceitaTermos(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="termos">
                    Eu li e aceito os{" "}
                    <Link to="/termos" className="text-decoration-none fw-bold">
                      Termos de Uso
                    </Link>{" "}
                    e a{" "}
                    <Link
                      to="/privacidade"
                      className="text-decoration-none fw-bold"
                    >
                      Política de Privacidade
                    </Link>
                    .
                  </label>
                </div>

                <div className="d-grid">
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg py-3 fs-5 shadow-sm"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          aria-hidden="true"
                        ></span>{" "}
                        Criando Conta...
                      </>
                    ) : (
                      "Criar Minha Conta"
                    )}
                  </button>
                </div>
              </form>

              <hr className="my-4" />
              <p className="text-center fs-5 mb-0">
                Já tem uma conta?{" "}
                <Link to="/login" className="text-decoration-none fw-bold">
                  Faça seu login aqui
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
