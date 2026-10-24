import { useState, useEffect } from "react";
import Swal from "sweetalert2";

export interface PlanoPagamento {
  id: string;
  nome: string;
  valor: number;
  ciclo?: "MENSAL" | "ANUAL" | "AVULSO" | "CONSULTA";
  tipo?: "PLANO" | "CONSULTA";
  dataHoraFormatada?: string;
  duracaoMinutos?: number;
}

interface ModalPagamentoMercadoPagoProps {
  plano: PlanoPagamento;
  medico?: {
    id?: string;
    nome?: string;
    email?: string;
    crm?: string;
  };
  paciente?: {
    id?: string;
    nome?: string;
    email?: string;
    cpf?: string;
  };
  tipoItem?: "PLANO" | "CONSULTA";
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (detalhesTransacao: any) => void;
}

type MetodoPagamento = "SALDO_MP" | "PIX";

export const MP_PUBLIC_KEY = "APP_USR-43875c7c-802f-4097-bc37-d857251f04e4";
export const MP_ACCESS_TOKEN =
  "APP_USR-3713581704728784-101013-5bc4fbeaad1f159f55f7240f77eec7bc-3754873488";

// ==========================================
// FUNÇÕES AUXILIARES DO PADRÃO OFICIAL BACEN
// ==========================================
function formatTLV(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function calcularCRC16(str: string): string {
  let crc = 0xffff;
  const poly = 0x1021;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ poly) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function gerarPixEMV(params: {
  chave: string;
  valor: number;
  beneficiario?: string;
  cidade?: string;
  txId?: string;
  descricao?: string;
}): string {
  const chave = params.chave;
  const valor = Number(params.valor || 0).toFixed(2);
  const beneficiario = (params.beneficiario || "ACTIVE AGE BRASIL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .substring(0, 25);
  const cidade = (params.cidade || "SAO PAULO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .substring(0, 15);
  const txId = (params.txId || "ACTIVEAGE")
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 25);

  let merchantAccount = formatTLV("00", "BR.GOV.BCB.PIX");
  merchantAccount += formatTLV("01", chave);
  if (params.descricao) {
    merchantAccount += formatTLV("02", params.descricao.substring(0, 40));
  }

  let payload = "";
  payload += formatTLV("00", "01");
  payload += formatTLV("01", "12");
  payload += formatTLV("26", merchantAccount);
  payload += formatTLV("52", "0000");
  payload += formatTLV("53", "986");
  payload += formatTLV("54", valor);
  payload += formatTLV("58", "BR");
  payload += formatTLV("59", beneficiario);
  payload += formatTLV("60", cidade);
  payload += formatTLV("62", formatTLV("05", txId));
  payload += "6304";

  const crc = calcularCRC16(payload);
  return payload + crc;
}

export function ModalPagamentoMercadoPago({
  plano,
  medico,
  paciente,
  tipoItem = "PLANO",
  isOpen,
  onClose,
  onSuccess,
}: ModalPagamentoMercadoPagoProps) {
  const isConsulta =
    tipoItem === "CONSULTA" ||
    plano.tipo === "CONSULTA" ||
    plano.ciclo === "CONSULTA";

  const [metodoSelecionado, setMetodoSelecionado] =
    useState<MetodoPagamento>("SALDO_MP");
  const [isProcessando, setIsProcessando] = useState(false);
  const [etapa, setEtapa] = useState<
    "FORMULARIO" | "PIX_GERADO" | "CHECKOUT_EMBARCADO" | "SUCESSO"
  >("FORMULARIO");

  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [isIframeCarregando, setIsIframeCarregando] = useState(true);
  const [transacaoId, setTransacaoId] = useState("");
  const [detalhesFinalizados, setDetalhesFinalizados] = useState<any>(null);

  const [nomeTitular, setNomeTitular] = useState("");
  const [emailPagador, setEmailPagador] = useState("");
  const [codigoPixCopiaCola, setCodigoPixCopiaCola] = useState("");
  const [tempoRestantePix, setTempoRestantePix] = useState(900);

  useEffect(() => {
    if (isOpen) {
      setEtapa("FORMULARIO");
      setIsProcessando(false);
      setDetalhesFinalizados(null);
      setCheckoutUrl("");
      setIsIframeCarregando(true);

      const novaTx = `MP-${Math.floor(10000000 + Math.random() * 90000000)}`;
      setTransacaoId(novaTx);
      setTempoRestantePix(900);

      const emailFinal =
        paciente?.email ||
        medico?.email ||
        (localStorage.getItem("activeAgeUser") &&
          JSON.parse(localStorage.getItem("activeAgeUser") || "{}").email) ||
        "usuario@mercadopago.com.br";
      setEmailPagador(emailFinal);

      const nomeFinal =
        paciente?.nome ||
        medico?.nome ||
        (localStorage.getItem("activeAgeUser") &&
          JSON.parse(localStorage.getItem("activeAgeUser") || "{}").nome) ||
        "";
      setNomeTitular(nomeFinal);

      salvarPagamentoPendente("Mercado Pago", novaTx);
    }
  }, [isOpen, plano, paciente, medico]);

  useEffect(() => {
    let timer: any = null;
    if (etapa === "PIX_GERADO" && tempoRestantePix > 0) {
      timer = setInterval(() => {
        setTempoRestantePix((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [etapa, tempoRestantePix]);

  // Polling automático no checkout embarcado
  useEffect(() => {
    let intervalo: any = null;
    if (etapa === "CHECKOUT_EMBARCADO" && plano.id) {
      intervalo = setInterval(async () => {
        try {
          const resultado = await verificarPagamentoNoMercadoPago();
          if (resultado.valido) {
            clearInterval(intervalo);
            await confirmarPagamentoNoBackend({
              transacaoId: resultado.paymentId || transacaoId,
              metodo: resultado.metodo || "Mercado Pago / Mercado Livre",
              planoNome: plano.nome,
              valor: resultado.valorPago || plano.valor,
              detalhes: "Pagamento Verificado e Aprovado Oficialmente no Mercado Pago",
            });
          }
        } catch (e) {
          // segue polling silencioso
        }
      }, 4000);
    }
    return () => clearInterval(intervalo);
  }, [etapa, plano.id, plano.valor, transacaoId]);

  // Listener para eventos de checkout do Mercado Pago
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (
        event.data?.type === "MERCADO_PAGO_APPROVED" ||
        event.data?.status === "approved"
      ) {
        const paymentId = event.data?.paymentId;
        const resultado = await verificarPagamentoNoMercadoPago(paymentId);
        if (resultado.valido) {
          confirmarPagamentoNoBackend({
            transacaoId: resultado.paymentId || paymentId || transacaoId,
            metodo: resultado.metodo || "Mercado Pago / Mercado Livre",
            planoNome: plano.nome,
            valor: resultado.valorPago || plano.valor,
            detalhes: "Pagamento Validado e Confirmado via Mercado Pago",
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [transacaoId, plano]);

  if (!isOpen) return null;

  const formatarTempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const salvarPagamentoPendente = (metodo: string, tx: string) => {
    const usuarioLogadoId =
      paciente?.id ||
      (localStorage.getItem("activeAgeUser")
        ? JSON.parse(localStorage.getItem("activeAgeUser") || "{}").id
        : null);

    const token = localStorage.getItem("activeAgeToken");
    const headersReq: any = { 
      "Content-Type": "application/json",
      "X-Ignore-Auth-Redirect": "true" 
    };
    if (token) headersReq.Authorization = `Bearer ${token}`;

    if (isConsulta && plano.id && usuarioLogadoId) {
      fetch(
        `https://active-age-backend.onrender.com/api/agendamentos/marcar/${plano.id}/paciente/${usuarioLogadoId}`,
        { method: "PUT", headers: headersReq }
      ).catch(() => null);
    }

    try {
      const pendente = {
        id: String(plano.id),
        transacaoPagamentoId: tx,
        dataHora: plano.dataHoraFormatada || new Date().toISOString(),
        status: "AGUARDANDO_PAGAMENTO",
        medicoNome: medico?.nome || "Médico Especialista",
        medicoCrm: medico?.crm || "Não informado",
        medicoEspecializacao: plano.nome || "Teleconsulta Médica",
        pacienteNome:
          paciente?.nome ||
          (localStorage.getItem("activeAgeUser")
            ? JSON.parse(localStorage.getItem("activeAgeUser") || "{}").nome
            : "Paciente"),
        pacienteCpf: paciente?.cpf,
        valor: Number(plano.valor || 0) || 180,
        valorPago: null,
        metodoPagamento: metodo,
        moeda: "BRL",
        tipoItem: isConsulta ? "CONSULTA" : "PLANO",
        dataCriacao: new Date().toISOString(),
      };

      const lista = JSON.parse(
        localStorage.getItem("activeAgePagamentosPendentes") || "[]"
      );
      const filtrada = Array.isArray(lista)
        ? lista.filter((p: any) => String(p.id) !== String(plano.id))
        : [];
      filtrada.unshift(pendente);
      localStorage.setItem(
        "activeAgePagamentosPendentes",
        JSON.stringify(filtrada)
      );

      const ultimo = {
        itemId: plano.id,
        tipoItem: isConsulta ? "CONSULTA" : "PLANO",
        planoNome: plano.nome,
        valor: plano.valor,
        medicoId: medico?.id,
        medicoNome: medico?.nome,
        pacienteId: usuarioLogadoId,
        pacienteNome: paciente?.nome,
        email: emailPagador,
        timestamp: Date.now(),
        transacaoId: tx,
        metodo,
      };
      localStorage.setItem(
        "activeAgeUltimoPagamento",
        JSON.stringify(ultimo)
      );

      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(
        new CustomEvent("activeage:pagamento_pendente", { detail: pendente })
      );
      window.dispatchEvent(new CustomEvent("activeage:pagamento_atualizado"));
    } catch (e) {
      console.warn("Erro ao salvar pagamento pendente:", e);
    }
  };

  const handleGerarPix = () => {
    setIsProcessando(true);
    salvarPagamentoPendente("PIX", transacaoId);

    setTimeout(() => {
      const payloadPix = gerarPixEMV({
        chave: "financeiro@activeage.com.br",
        valor: plano.valor,
        beneficiario: "ACTIVE AGE BRASIL",
        cidade: "SAO PAULO",
        txId: transacaoId.replace(/[^a-zA-Z0-9]/g, ""),
        descricao: plano.nome.substring(0, 30),
      });

      setCodigoPixCopiaCola(payloadPix);
      setEtapa("PIX_GERADO");
      setIsProcessando(false);
    }, 400);
  };

  const handlePagarComSaldoMercadoPago = async () => {
    setIsProcessando(true);
    salvarPagamentoPendente("Mercado Pago", transacaoId);

    try {
      let initPoint = "";

      // 1. Tentar gerar via microserviço de pagamentos (porta 8081 local ou nuvem)
      try {
        const respMS = await fetch("http://localhost:8081/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Number(plano.valor || 0),
            description: plano.nome.substring(0, 100),
            payerEmail:
              emailPagador || paciente?.email || "usuario@mercadopago.com.br",
            type: isConsulta ? "CONSULTATION" : "SUBSCRIPTION",
            referenceId: isConsulta
              ? `AGEND-${plano.id}`
              : `MED-${medico?.id || ""}`,
          }),
        });

        if (respMS.ok) {
          const dataMS = await respMS.json();
          if (dataMS.checkoutUrl) {
            initPoint = dataMS.checkoutUrl;
          }
        }
      } catch (e) {
        console.warn(
          "Microserviço local 8081 indisponível, usando API direta do Mercado Pago:",
          e
        );
      }

      // 2. Fallback: API oficial direta do Mercado Pago
      if (!initPoint) {
        const urlSuccess = `${window.location.origin}/dashboard?status=approved&item_id=${encodeURIComponent(
          plano.id
        )}&tipo=${encodeURIComponent(isConsulta ? "CONSULTA" : "PLANO")}`;
        const urlFailure = `${window.location.origin}/dashboard?status=failure`;
        const urlPending = `${window.location.origin}/dashboard?status=pending`;

        const respMP = await fetch(
          "https://api.mercadopago.com/checkout/preferences",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              items: [
                {
                  id: String(plano.id),
                  title: plano.nome.substring(0, 100),
                  quantity: 1,
                  currency_id: "BRL",
                  unit_price: Number(plano.valor || 0),
                },
              ],
              payer: {
                name: nomeTitular || paciente?.nome || "Paciente",
                email:
                  emailPagador ||
                  paciente?.email ||
                  "usuario@mercadopago.com.br",
              },
              back_urls: {
                success: urlSuccess,
                failure: urlFailure,
                pending: urlPending,
              },
              external_reference: isConsulta
                ? `AGEND-${plano.id}`
                : `MED-${medico?.id || ""}`,
            }),
          }
        );

        if (respMP.ok) {
          const dataMP = await respMP.json();
          initPoint = dataMP.init_point || dataMP.sandbox_init_point;
        } else {
          const errText = await respMP.text();
          console.error("Erro da API do Mercado Pago:", errText);
        }
      }

      if (initPoint) {
        setCheckoutUrl(initPoint);
        setIsIframeCarregando(true);
        setEtapa("CHECKOUT_EMBARCADO");
        setIsProcessando(false);
      } else {
        throw new Error(
          "Não foi possível gerar a página de pagamento do Mercado Pago."
        );
      }
    } catch (e: any) {
      console.error("Erro ao iniciar pagamento com Mercado Pago:", e);
      setIsProcessando(false);
      Swal.fire({
        icon: "error",
        title: "Erro ao Conectar com Mercado Pago",
        text:
          e?.message ||
          "Ocorreu uma instabilidade ao gerar o checkout do Mercado Pago. Tente novamente.",
        confirmButtonColor: "#009ee3",
      });
    }
  };

  const verificarPagamentoNoMercadoPago = async (
    forcedPaymentId?: string
  ): Promise<{
    valido: boolean;
    status: string;
    valorPago: number;
    paymentId?: string;
    metodo?: string;
    mensagem?: string;
  }> => {
    const referenceId = isConsulta
      ? `AGEND-${plano.id}`
      : `MED-${medico?.id || ""}`;
    const valorEsperado = Number(plano.valor || 0);

    // 1. Tenta validar no microserviço de pagamentos (porta 8081)
    try {
      const qParams = new URLSearchParams();
      if (referenceId) qParams.append("referenceId", referenceId);
      if (forcedPaymentId) qParams.append("paymentId", forcedPaymentId);
      if (valorEsperado) qParams.append("expectedAmount", String(valorEsperado));

      const resp = await fetch(
        `http://localhost:8081/api/payments/verify?${qParams.toString()}`
      );
      if (resp.ok) {
        const data = await resp.json();
        return {
          valido: data.valid === true,
          status: data.status,
          valorPago: data.amountPaid,
          paymentId: data.paymentId,
          metodo: data.paymentMethod || "Mercado Pago",
          mensagem: data.message,
        };
      }
    } catch (e) {
      console.warn("Microserviço local 8081 indisponível:", e);
    }

    // 2. Consulta direta à API do Mercado Pago
    try {
      if (forcedPaymentId && !forcedPaymentId.startsWith("MP-")) {
        const idLimpo = forcedPaymentId.replace(/[^0-9]/g, "");
        if (idLimpo) {
          const resp = await fetch(
            `https://api.mercadopago.com/v1/payments/${idLimpo}`,
            {
              headers: {
                Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            const isApproved = data.status === "approved";
            const amount = Number(data.transaction_amount || 0);
            if (isApproved && amount >= valorEsperado) {
              return {
                valido: true,
                status: data.status,
                valorPago: amount,
                paymentId: String(data.id),
                metodo: data.payment_method_id || "Mercado Pago",
                mensagem: "Pagamento validado e aprovado com sucesso no Mercado Pago.",
              };
            }
          }
        }
      }

      const searchResp = await fetch(
        `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(
          referenceId
        )}&sort=date_created&criteria=desc`,
        {
          headers: {
            Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (searchResp.ok) {
        const sData = await searchResp.json();
        if (sData.results && sData.results.length > 0) {
          for (const item of sData.results) {
            const isApproved = item.status === "approved";
            const amount = Number(item.transaction_amount || 0);
            if (isApproved && amount >= valorEsperado) {
              return {
                valido: true,
                status: item.status,
                valorPago: amount,
                paymentId: String(item.id),
                metodo: item.payment_method_id || "Mercado Pago",
                mensagem: "Pagamento aprovado e verificado com sucesso no Mercado Pago.",
              };
            }
          }
        }
      }
    } catch (e) {
      console.error("Erro na consulta direta ao Mercado Pago:", e);
    }

    return {
      valido: false,
      status: "nao_localizado",
      valorPago: 0,
      mensagem: "Nenhum pagamento aprovado foi localizado no Mercado Pago para esta transação.",
    };
  };

  const handleValidarConfirmacaoManual = async () => {
    setIsProcessando(true);
    const resultado = await verificarPagamentoNoMercadoPago();

    if (resultado.valido) {
      await confirmarPagamentoNoBackend({
        transacaoId: resultado.paymentId || transacaoId,
        metodo: resultado.metodo || "Mercado Pago / Mercado Livre",
        planoNome: plano.nome,
        valor: resultado.valorPago || plano.valor,
        detalhes: "Pagamento Validado e Confirmado Oficialmente no Mercado Pago",
      });
    } else {
      Swal.fire({
        icon: "warning",
        title: "Pagamento Não Confirmado no Mercado Pago",
        html: `
          <div class="text-start">
            <p class="mb-2 text-danger fw-bold">${
              resultado.mensagem || "Não identificamos a aprovação do valor correto."
            }</p>
            <p class="small text-muted mb-0">
              Para a sua segurança e integridade do agendamento, a teleconsulta só é liberada após a confirmação oficial de pagamento no valor exato de <strong>R$ ${Number(
                plano.valor || 0
              ).toFixed(2)}</strong> pelo Mercado Pago.
            </p>
          </div>
        `,
        confirmButtonText: "Entendi, vou concluir o pagamento",
        confirmButtonColor: "#009ee3",
      });
    }
    setIsProcessando(false);
  };

  const confirmarPagamentoNoBackend = async (detalhes: any) => {
    try {
      if (isConsulta) {
        const agendamentoId = plano.id;
        const usuarioLogadoId =
          paciente?.id ||
          (localStorage.getItem("activeAgeUser")
            ? JSON.parse(localStorage.getItem("activeAgeUser") || "{}").id
            : null);

        if (agendamentoId && usuarioLogadoId) {
          await fetch(
            `https://active-age-backend.onrender.com/api/agendamentos/marcar/${agendamentoId}/paciente/${usuarioLogadoId}`,
            { method: "PUT", headers: { "X-Ignore-Auth-Redirect": "true" } }
          ).catch(() => null);

          await fetch(
            `https://active-age-backend.onrender.com/api/agendamentos/${agendamentoId}/confirmar-pagamento`,
            {
              method: "PUT",
              headers: { 
                "Content-Type": "application/json",
                "X-Ignore-Auth-Redirect": "true"
              },
              body: JSON.stringify({
                transacaoId: detalhes.transacaoId,
                metodo: detalhes.metodo,
                valorPago: plano.valor,
                dataPagamento: new Date().toISOString(),
              }),
            }
          ).catch((e) =>
            console.error("Erro ao confirmar pagamento no backend:", e)
          );
        }
      } else {
        const medicoId =
          medico?.id ||
          (localStorage.getItem("activeAgeUser")
            ? JSON.parse(localStorage.getItem("activeAgeUser") || "{}").id
            : null);

        if (medicoId) {
          await fetch(
            `https://active-age-backend.onrender.com/api/usuarios/medicos/MED-${medicoId}/assinatura/ativar`,
            { method: "PUT", headers: { "X-Ignore-Auth-Redirect": "true" } }
          ).catch(() => null);

          const userStr = localStorage.getItem("activeAgeUser");
          if (userStr) {
            const user = JSON.parse(userStr);
            user.assinaturaAtiva = true;
            localStorage.setItem("activeAgeUser", JSON.stringify(user));
          }
        }
      }

      // Limpa pagamentos pendentes locais
      try {
        const pendentes = JSON.parse(
          localStorage.getItem("activeAgePagamentosPendentes") || "[]"
        );
        const filtrada = Array.isArray(pendentes)
          ? pendentes.filter(
              (p: any) =>
                String(p.id) !== String(plano.id) &&
                p.transacaoPagamentoId !== detalhes.transacaoId
            )
          : [];
        localStorage.setItem(
          "activeAgePagamentosPendentes",
          JSON.stringify(filtrada)
        );
        localStorage.removeItem("activeAgeUltimoPagamento");
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("activeage:pagamento_atualizado"));
      } catch {}
    } catch (e) {
      console.error("Erro na sincronização de pagamento:", e);
    }

    setDetalhesFinalizados(detalhes);
    setEtapa("SUCESSO");
  };

  const handleConcluirSucesso = () => {
    if (detalhesFinalizados) {
      onSuccess(detalhesFinalizados);
    }
    onClose();
  };

  const copiarCodigoPix = () => {
    navigator.clipboard.writeText(codigoPixCopiaCola);
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Código PIX copiado!",
      showConfirmButton: false,
      timer: 2000,
    });
  };

  const urlQrCode = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=2&data=${encodeURIComponent(
    codigoPixCopiaCola ||
      gerarPixEMV({
        chave: "financeiro@activeage.com.br",
        valor: plano.valor,
        txId: transacaoId.replace(/[^a-zA-Z0-9]/g, ""),
      })
  )}`;

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 1060,
      }}
    >
      <div
        className={`modal-dialog modal-dialog-centered ${
          etapa === "CHECKOUT_EMBARCADO" ? "modal-xl" : ""
        }`}
        style={{
          maxWidth: etapa === "CHECKOUT_EMBARCADO" ? "1200px" : "680px",
          width: etapa === "CHECKOUT_EMBARCADO" ? "98%" : "95%",
          transition: "max-width 0.3s ease-in-out, width 0.3s ease-in-out",
        }}
      >
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          {/* HEADER DO MODAL (ESTILO VERCEL) */}
          <div
            className="p-3 px-4 text-white d-flex justify-content-between align-items-center"
            style={{
              background: "linear-gradient(135deg, #0077b6 0%, #009ee3 100%)",
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-shield-check fs-3 text-warning"></i>
              <div>
                <h4 className="fw-bold mb-0" style={{ fontSize: "1.3rem" }}>
                  {etapa === "SUCESSO"
                    ? "Comprovante de Pagamento"
                    : etapa === "PIX_GERADO"
                    ? "Pagar com PIX"
                    : etapa === "CHECKOUT_EMBARCADO"
                    ? "Pagamento com Cartão / Mercado Pago"
                    : isConsulta
                    ? "Pagamento da Consulta"
                    : "Pagamento do Plano Médico"}
                </h4>
                <small className="text-white-50" style={{ fontSize: "0.88rem" }}>
                  Ambiente simples e protegido da Active Age
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-outline-light btn-sm fw-bold px-3 py-1 rounded-pill"
              onClick={onClose}
              disabled={isProcessando}
              aria-label="Fechar"
            >
              ✕ Fechar
            </button>
          </div>

          {/* CORPO DO MODAL */}
          <div
            className={`modal-body bg-light ${
              etapa === "CHECKOUT_EMBARCADO" ? "p-2 p-md-3" : "p-3 p-md-4"
            }`}
          >
            {etapa === "SUCESSO" ? (
              <div className="text-center py-3">
                <div
                  className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle text-success shadow-sm"
                  style={{
                    width: "80px",
                    height: "80px",
                    backgroundColor: "#e8f5e9",
                    fontSize: "2.8rem",
                  }}
                >
                  <i className="bi bi-check-circle-fill"></i>
                </div>
                <h3 className="fw-bold mb-2 text-dark">
                  Pagamento Confirmado!
                </h3>
                <p className="text-muted mb-4 fs-5">
                  {isConsulta
                    ? `Sua consulta com ${
                        medico?.nome || "o médico"
                      } está confirmada.`
                    : `Seu consultório virtual no ${plano.nome} foi ativado.`}
                </p>

                <div
                  className="bg-white p-4 rounded-4 border text-start mb-4 mx-auto shadow-sm"
                  style={{ maxWidth: "480px" }}
                >
                  <div className="d-flex justify-content-between mb-2 fs-6">
                    <span className="text-muted">Serviço:</span>
                    <strong className="text-dark">{plano.nome}</strong>
                  </div>
                  {isConsulta && plano.dataHoraFormatada && (
                    <div className="d-flex justify-content-between mb-2 fs-6">
                      <span className="text-muted">Horário Agendado:</span>
                      <strong className="text-dark">
                        {plano.dataHoraFormatada}
                      </strong>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-2 fs-6">
                    <span className="text-muted">Forma de Pagamento:</span>
                    <span className="badge bg-success-subtle text-success fs-6 border px-2 py-1">
                      {detalhesFinalizados?.metodo || "Mercado Pago"}
                    </span>
                  </div>
                  <hr className="my-3" />
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-dark fs-5">Valor Pago:</span>
                    <strong className="text-success fs-3">
                      R$ {Number(plano.valor || 0).toFixed(2).replace(".", ",")}
                    </strong>
                  </div>
                </div>

                <button
                  className="btn btn-success btn-lg px-4 py-3 fw-bold shadow-sm rounded-pill fs-5"
                  onClick={handleConcluirSucesso}
                >
                  <i className="bi bi-arrow-right-circle-fill me-2"></i>
                  {isConsulta
                    ? "Ir para Minhas Consultas"
                    : "Acessar Meu Consultório"}
                </button>
              </div>
            ) : etapa === "PIX_GERADO" ? (
              <div className="text-center py-2">
                {/* VALOR EM DESTAQUE */}
                <div className="p-3 mb-3 bg-white rounded-4 border shadow-sm">
                  <span className="text-muted small text-uppercase fw-semibold d-block">
                    Valor a ser pago:
                  </span>
                  <span
                    className="text-success fw-bold"
                    style={{ fontSize: "2.3rem" }}
                  >
                    R$ {Number(plano.valor || 0).toFixed(2).replace(".", ",")}
                  </span>
                </div>

                {/* INSTRUÇÕES DO PIX */}
                <div className="bg-white p-3 p-md-4 rounded-4 border shadow-sm mb-3 text-start">
                  <h5 className="fw-bold text-dark mb-3 fs-5">
                    Como pagar no seu celular:
                  </h5>
                  <div className="d-flex align-items-start gap-3 mb-3">
                    <div
                      className="rounded-circle bg-success text-white fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: "32px",
                        height: "32px",
                        fontSize: "1.1rem",
                      }}
                    >
                      1
                    </div>
                    <p className="mb-0 fs-6 text-dark" style={{ lineHeight: "1.4" }}>
                      Abra o <strong>aplicativo do seu banco</strong> no celular
                      e selecione <strong>Pagar com PIX</strong>.
                    </p>
                  </div>
                  <div className="d-flex align-items-start gap-3 mb-3">
                    <div
                      className="rounded-circle bg-success text-white fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: "32px",
                        height: "32px",
                        fontSize: "1.1rem",
                      }}
                    >
                      2
                    </div>
                    <p className="mb-0 fs-6 text-dark" style={{ lineHeight: "1.4" }}>
                      Aponte a câmera para o <strong>QR Code</strong> abaixo ou
                      clique em <strong>Copiar Código</strong>.
                    </p>
                  </div>
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="rounded-circle bg-success text-white fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: "32px",
                        height: "32px",
                        fontSize: "1.1rem",
                      }}
                    >
                      3
                    </div>
                    <p className="mb-0 fs-6 text-dark" style={{ lineHeight: "1.4" }}>
                      Confirme os dados e o valor. A confirmação é instantânea e
                      automática!
                    </p>
                  </div>
                </div>

                {/* QR CODE E TEMPO */}
                <div className="bg-white p-3 p-md-4 rounded-4 shadow-sm border d-inline-block mb-3">
                  <img
                    src={urlQrCode}
                    alt="QR Code PIX Válido"
                    style={{ width: "220px", height: "220px" }}
                    className="img-fluid rounded"
                  />
                  <div className="mt-2 text-muted d-flex align-items-center justify-content-center gap-1 fs-6">
                    <i className="bi bi-clock-history text-warning"></i>
                    <span>Expira em: </span>
                    <strong className="text-danger">
                      {formatarTempo(tempoRestantePix)}
                    </strong>
                  </div>
                </div>

                {/* CÓDIGO PIX COPIA E COLA */}
                <div className="mb-3 text-start bg-white p-3 rounded-4 border shadow-sm">
                  <label className="form-label fw-bold small text-muted text-uppercase d-flex justify-content-between mb-2">
                    <span>Código PIX Copia e Cola:</span>
                    <span className="text-success small fw-semibold">
                      <i className="bi bi-shield-check me-1"></i>Padrão BACEN Oficial
                    </span>
                  </label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control font-monospace small bg-light"
                      value={codigoPixCopiaCola}
                      readOnly
                    />
                    <button
                      className="btn btn-success fw-bold px-3 d-flex align-items-center gap-1"
                      type="button"
                      onClick={copiarCodigoPix}
                    >
                      <i className="bi bi-clipboard"></i> Copiar Código
                    </button>
                  </div>
                </div>

                <div className="d-flex justify-content-center gap-2 flex-wrap">
                  <button
                    className="btn btn-outline-secondary px-3 py-2 rounded-pill"
                    onClick={() => setEtapa("FORMULARIO")}
                    disabled={isProcessando}
                  >
                    <i className="bi bi-arrow-left me-1"></i> Alterar Método
                  </button>
                  <button
                    className="btn btn-success fw-bold px-4 py-2 rounded-pill shadow-sm"
                    onClick={handleValidarConfirmacaoManual}
                    disabled={isProcessando}
                  >
                    {isProcessando ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1"></span>
                        Verificando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-1"></i> Já Realizei o Pagamento
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : etapa === "CHECKOUT_EMBARCADO" ? (
              <div className="py-1">
                {/* BARRA SUPERIOR DE INFORMAÇÕES E CONTROLES */}
                <div className="d-flex justify-content-between align-items-center mb-3 bg-white p-2 px-3 rounded-3 border shadow-sm">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary text-white px-2 py-1 small fw-semibold">
                      <i className="bi bi-wallet2 me-1"></i> Mercado Pago / Mercado Livre
                    </span>
                    <span className="small text-muted d-none d-md-inline">
                      Total a pagar:{" "}
                      <strong className="text-success">
                        R$ {Number(plano.valor || 0).toFixed(2).replace(".", ",")}
                      </strong>
                    </span>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary rounded-pill"
                      onClick={() => setEtapa("FORMULARIO")}
                      disabled={isProcessando}
                    >
                      <i className="bi bi-arrow-left me-1"></i> Voltar às opções
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary rounded-circle"
                      title="Recarregar tela de pagamento"
                      onClick={() => {
                        setIsIframeCarregando(true);
                        const iframe = document.getElementById(
                          "mpCheckoutIframe"
                        ) as HTMLIFrameElement;
                        if (iframe) iframe.src = checkoutUrl;
                      }}
                    >
                      <i className="bi bi-arrow-clockwise"></i>
                    </button>
                  </div>
                </div>

                {/* IFRAME EMBARCADO DO MERCADO PAGO */}
                <div
                  className="position-relative w-100 rounded-3 overflow-hidden shadow-sm border bg-white"
                  style={{ height: "680px" }}
                >
                  {isIframeCarregando && (
                    <div className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white z-2">
                      <div
                        className="spinner-border text-primary mb-3"
                        style={{ width: "3rem", height: "3rem" }}
                        role="status"
                      >
                        <span className="visually-hidden">Carregando...</span>
                      </div>
                      <h6 className="fw-bold text-dark mb-1">
                        Carregando Mercado Pago / Mercado Livre...
                      </h6>
                      <small className="text-muted">
                        Preparando o ambiente seguro de pagamento
                      </small>
                    </div>
                  )}

                  <iframe
                    id="mpCheckoutIframe"
                    src={checkoutUrl}
                    title="Mercado Pago Checkout"
                    className="w-100 h-100 border-0"
                    allow="payment *"
                    onLoad={() => setIsIframeCarregando(false)}
                  />
                </div>
              </div>
            ) : (
              /* ETAPA FORMULÁRIO (TELA INICIAL DO MODAL - ESTILO VERCEL) */
              <div>
                {/* CARD DE RESUMO DA CONSULTA / PLANO */}
                <div className="bg-white p-3 p-md-4 rounded-4 border shadow-sm mb-4">
                  <div className="row align-items-center g-3">
                    <div className="col-12 col-md-7">
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 rounded-pill fw-semibold mb-2 d-inline-flex align-items-center gap-1">
                        <i className="bi bi-stethoscope"></i>{" "}
                        {isConsulta ? "Teleconsulta" : "Plano de Assinatura"}
                      </span>
                      <h4 className="fw-bold mb-1 text-dark">
                        {isConsulta
                          ? medico?.nome
                            ? `Dr(a). ${medico.nome}`
                            : plano.nome
                          : plano.nome}
                      </h4>
                      {isConsulta && plano.dataHoraFormatada && (
                        <p className="text-muted small mb-0 d-flex align-items-center gap-1">
                          <i className="bi bi-calendar-check text-primary"></i>{" "}
                          Horário: <strong>{plano.dataHoraFormatada}</strong>
                        </p>
                      )}
                    </div>
                    <div className="col-12 col-md-5 text-md-end border-top border-md-top-0 pt-3 pt-md-0">
                      <span className="text-muted d-block small text-uppercase fw-semibold">
                        VALOR A PAGAR:
                      </span>
                      <strong
                        className="text-success fw-bold"
                        style={{ fontSize: "2.3rem", lineHeight: 1.1 }}
                      >
                        R$ {Number(plano.valor || 0).toFixed(2).replace(".", ",")}
                      </strong>
                    </div>
                  </div>
                </div>

                <h5 className="fw-bold text-dark mb-3 fs-5">
                  Escolha como deseja pagar:
                </h5>

                {/* OPÇÃO 1: PIX */}
                <div
                  className={`p-3 p-md-4 rounded-4 mb-3 transition-all ${
                    metodoSelecionado === "PIX"
                      ? "bg-success bg-opacity-10 shadow-sm"
                      : "bg-white"
                  }`}
                  style={{
                    cursor: "pointer",
                    border:
                      metodoSelecionado === "PIX"
                        ? "2.5px solid #198754"
                        : "2px solid #e2e8f0",
                  }}
                  onClick={() => setMetodoSelecionado("PIX")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                        style={{
                          width: "52px",
                          height: "52px",
                          backgroundColor: "#198754",
                          fontSize: "1.6rem",
                        }}
                      >
                        <i className="bi bi-qr-code"></i>
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <h5 className="fw-bold mb-0 text-dark fs-5">
                            Pagar com PIX
                          </h5>
                          <span className="badge bg-success text-white small px-2 py-1 rounded-pill">
                            Mais Rápido
                          </span>
                        </div>
                        <p
                          className="text-muted mb-0 mt-1"
                          style={{ fontSize: "0.95rem" }}
                        >
                          Pague pelo aplicativo do seu banco com o celular.
                        </p>
                      </div>
                    </div>
                    <div className="form-check fs-4 me-2">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="metodoPagamento"
                        checked={metodoSelecionado === "PIX"}
                        onChange={() => setMetodoSelecionado("PIX")}
                      />
                    </div>
                  </div>
                </div>

                {/* OPÇÃO 2: CARTÃO DE CRÉDITO OU MERCADO PAGO */}
                <div
                  className={`p-3 p-md-4 rounded-4 mb-4 transition-all ${
                    metodoSelecionado === "SALDO_MP"
                      ? "bg-primary bg-opacity-10 shadow-sm"
                      : "bg-white"
                  }`}
                  style={{
                    cursor: "pointer",
                    border:
                      metodoSelecionado === "SALDO_MP"
                        ? "2.5px solid #009ee3"
                        : "2px solid #e2e8f0",
                  }}
                  onClick={() => setMetodoSelecionado("SALDO_MP")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                        style={{
                          width: "52px",
                          height: "52px",
                          backgroundColor: "#009ee3",
                          fontSize: "1.6rem",
                        }}
                      >
                        <i className="bi bi-credit-card-2-front"></i>
                      </div>
                      <div>
                        <h5 className="fw-bold mb-0 text-dark fs-5">
                          Cartão de Crédito ou Mercado Pago
                        </h5>
                        <p
                          className="text-muted mb-0 mt-1"
                          style={{ fontSize: "0.95rem" }}
                        >
                          Pague com cartão de crédito, débito ou conta Mercado Pago.
                        </p>
                      </div>
                    </div>
                    <div className="form-check fs-4 me-2">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="metodoPagamento"
                        checked={metodoSelecionado === "SALDO_MP"}
                        onChange={() => setMetodoSelecionado("SALDO_MP")}
                      />
                    </div>
                  </div>
                </div>

                {/* BOTÃO DE CONTINUAR */}
                <div className="pt-2">
                  {metodoSelecionado === "PIX" ? (
                    <button
                      className="btn btn-success btn-lg w-100 py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 rounded-pill fs-5"
                      onClick={handleGerarPix}
                      disabled={isProcessando}
                    >
                      {isProcessando ? (
                        <>
                          <span className="spinner-border spinner-border-sm"></span>
                          Gerando PIX...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-qr-code-scan fs-4"></i> Continuar com PIX
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      className="btn btn-lg w-100 py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 rounded-pill fs-5 text-white"
                      style={{ backgroundColor: "#e86542", borderColor: "#d55635" }}
                      onClick={handlePagarComSaldoMercadoPago}
                      disabled={isProcessando}
                    >
                      {isProcessando ? (
                        <>
                          <span className="spinner-border spinner-border-sm"></span>
                          Abrindo pagamento...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-credit-card fs-4"></i> Continuar para Pagamento com Cartão
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
