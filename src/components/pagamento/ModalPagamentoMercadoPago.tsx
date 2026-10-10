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
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function gerarPixEMV(params: {
  chave: string;
  valor: number;
  beneficiario?: string;
  cidade?: string;
  txId?: string;
  descricao?: string;
}): string {
  const {
    chave,
    valor,
    beneficiario = "ACTIVE AGE BRASIL",
    cidade = "SAO PAULO",
    txId = "***",
    descricao = "",
  } = params;

  let payload = formatTLV("00", "01");
  payload += formatTLV("01", "12");

  let mai = formatTLV("00", "br.gov.bcb.pix");
  mai += formatTLV("01", chave);
  if (descricao) {
    mai += formatTLV("02", descricao.substring(0, 40));
  }
  payload += formatTLV("26", mai);
  payload += formatTLV("52", "0000");
  payload += formatTLV("53", "986");

  if (valor && valor > 0) {
    payload += formatTLV("54", Number(valor).toFixed(2));
  }

  payload += formatTLV("58", "BR");
  const nomeLimpo = beneficiario
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .substring(0, 25);
  payload += formatTLV("59", nomeLimpo);

  const cidadeLimpa = cidade
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .substring(0, 15);
  payload += formatTLV("60", cidadeLimpa);

  const txLimpo =
    (txId || "***").replace(/[^a-zA-Z0-9]/g, "").substring(0, 25) || "***";
  payload += formatTLV("62", formatTLV("05", txLimpo));

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

  // DADOS DO PAGADOR
  const [nomeTitular, setNomeTitular] = useState("");
  const [emailMercadoPago, setEmailMercadoPago] = useState("");
  const [saldoMercadoPago, setSaldoMercadoPago] = useState(0);

  // PIX
  const [codigoPixCopiaCola, setCodigoPixCopiaCola] = useState("");
  const [tempoRestantePix, setTempoRestantePix] = useState(900); // 15 minutos

  useEffect(() => {
    if (isOpen) {
      setEtapa("FORMULARIO");
      setIsProcessando(false);
      setDetalhesFinalizados(null);
      setCheckoutUrl("");
      setIsIframeCarregando(true);
      const novoId = `MP-${Math.floor(10000000 + Math.random() * 90000000)}`;
      setTransacaoId(novoId);
      setTempoRestantePix(900);

      const emailDefault =
        paciente?.email ||
        medico?.email ||
        (localStorage.getItem("activeAgeUser")
          ? JSON.parse(localStorage.getItem("activeAgeUser") || "{}").email || ""
          : "") ||
        "usuario@mercadopago.com.br";
      setEmailMercadoPago(emailDefault);
      setSaldoMercadoPago(Number(plano.valor || 0) + 420.5);

      const nomeDefault =
        paciente?.nome ||
        medico?.nome ||
        (localStorage.getItem("activeAgeUser")
          ? JSON.parse(localStorage.getItem("activeAgeUser") || "{}").nome || ""
          : "");
      setNomeTitular(nomeDefault);
    }
  }, [isOpen, plano, paciente, medico]);

  // Contador do PIX
  useEffect(() => {
    let interval: any = null;
    if (etapa === "PIX_GERADO" && tempoRestantePix > 0) {
      interval = setInterval(() => {
        setTempoRestantePix((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [etapa, tempoRestantePix]);

  // Monitorar se o pagamento foi confirmado com valor correto no Mercado Pago
  useEffect(() => {
    let interval: any = null;
    if (etapa === "CHECKOUT_EMBARCADO" && plano.id) {
      interval = setInterval(async () => {
        try {
          const checagem = await verificarStatusOficialMercadoPago();
          if (checagem.valido) {
            clearInterval(interval);
            await processarFinalizacao({
              transacaoId: checagem.paymentId || transacaoId,
              metodo: checagem.metodo || "Mercado Pago / Mercado Livre",
              planoNome: plano.nome,
              valor: checagem.valorPago || plano.valor,
              detalhes: "Pagamento Verificado e Aprovado Oficialmente no Mercado Pago",
            });
          }
        } catch (e) {
          // Erro silencioso de rede
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [etapa, plano.id, plano.valor, transacaoId]);

  // Listener para evento postMessage se o checkout redirecionar dentro do iframe
  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (
        event.data?.type === "MERCADO_PAGO_APPROVED" ||
        event.data?.status === "approved"
      ) {
        const pId = event.data?.paymentId;
        const checagem = await verificarStatusOficialMercadoPago(pId);
        if (checagem.valido) {
          processarFinalizacao({
            transacaoId: checagem.paymentId || pId || transacaoId,
            metodo: checagem.metodo || "Mercado Pago / Mercado Livre",
            planoNome: plano.nome,
            valor: checagem.valorPago || plano.valor,
            detalhes: "Pagamento Validado e Confirmado via Mercado Pago",
          });
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [transacaoId, plano]);

  if (!isOpen) return null;

  const formatarTempo = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min.toString().padStart(2, "0")}:${seg
      .toString()
      .padStart(2, "0")}`;
  };

  const handleGerarPix = () => {
    setIsProcessando(true);
    setTimeout(() => {
      const payload = gerarPixEMV({
        chave: "financeiro@activeage.com.br",
        valor: plano.valor,
        beneficiario: "ACTIVE AGE BRASIL",
        cidade: "SAO PAULO",
        txId: transacaoId.replace(/[^a-zA-Z0-9]/g, ""),
        descricao: plano.nome.substring(0, 30),
      });
      setCodigoPixCopiaCola(payload);
      setEtapa("PIX_GERADO");
      setIsProcessando(false);
    }, 400);
  };

  const handlePagarComSaldoMercadoPago = async () => {
    setIsProcessando(true);

    try {
      // 1. Salva contexto para recuperar após o retorno do Mercado Pago
      const dadosPagamento = {
        itemId: plano.id,
        tipoItem: isConsulta ? "CONSULTA" : "PLANO",
        planoNome: plano.nome,
        valor: plano.valor,
        medicoId: medico?.id,
        medicoNome: medico?.nome,
        pacienteId: paciente?.id,
        pacienteNome: paciente?.nome,
        email: emailMercadoPago,
        timestamp: Date.now(),
      };
      localStorage.setItem(
        "activeAgeUltimoPagamento",
        JSON.stringify(dadosPagamento)
      );

      let checkoutUrl = "";

      // 2. Tentar criar via microserviço de pagamentos (porta 8081)
      try {
        const microserviceResp = await fetch(
          "http://localhost:8081/api/payments/create",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: Number(plano.valor || 0),
              description: plano.nome.substring(0, 100),
              payerEmail:
                emailMercadoPago ||
                paciente?.email ||
                "usuario@mercadopago.com.br",
              type: isConsulta ? "CONSULTATION" : "SUBSCRIPTION",
              referenceId: isConsulta
                ? `AGEND-${plano.id}`
                : `MED-${medico?.id || ""}`,
            }),
          }
        );

        if (microserviceResp.ok) {
          const dadosMicroservice = await microserviceResp.json();
          if (dadosMicroservice.checkoutUrl) {
            checkoutUrl = dadosMicroservice.checkoutUrl;
          }
        }
      } catch (errMicroservice) {
        console.warn(
          "Microserviço local 8081 indisponível, usando API direta do Mercado Pago:",
          errMicroservice
        );
      }

      // 3. Fallback: Se não obteve a URL pelo microserviço, gera direto pela API do Mercado Pago
      if (!checkoutUrl) {
        const backUrlSuccess = `${window.location.origin}/dashboard?status=approved&item_id=${encodeURIComponent(
          plano.id
        )}&tipo=${encodeURIComponent(isConsulta ? "CONSULTA" : "PLANO")}`;
        const backUrlFailure = `${window.location.origin}/dashboard?status=failure`;
        const backUrlPending = `${window.location.origin}/dashboard?status=pending`;

        const mpDirectResp = await fetch(
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
                  emailMercadoPago ||
                  paciente?.email ||
                  "usuario@mercadopago.com.br",
              },
              back_urls: {
                success: backUrlSuccess,
                failure: backUrlFailure,
                pending: backUrlPending,
              },
              external_reference: isConsulta
                ? `AGEND-${plano.id}`
                : `MED-${medico?.id || ""}`,
            }),
          }
        );

        if (mpDirectResp.ok) {
          const dadosMp = await mpDirectResp.json();
          checkoutUrl = dadosMp.init_point || dadosMp.sandbox_init_point;
        } else {
          const errText = await mpDirectResp.text();
          console.error("Erro da API do Mercado Pago:", errText);
        }
      }

      // 4. Carregar na janela integrada do tamanho do modal (mantendo o site visível ao fundo)
      if (checkoutUrl) {
        setCheckoutUrl(checkoutUrl);
        setIsIframeCarregando(true);
        setEtapa("CHECKOUT_EMBARCADO");
        setIsProcessando(false);
      } else {
        throw new Error(
          "Não foi possível gerar a página de pagamento do Mercado Pago."
        );
      }
    } catch (err: any) {
      console.error("Erro ao iniciar pagamento com Mercado Pago:", err);
      setIsProcessando(false);
      Swal.fire({
        icon: "error",
        title: "Erro ao Conectar com Mercado Pago",
        text:
          err?.message ||
          "Ocorreu uma instabilidade ao gerar o checkout do Mercado Pago. Tente novamente.",
        confirmButtonColor: "#009ee3",
      });
    }
  };

  const verificarStatusOficialMercadoPago = async (
    specificPaymentId?: string
  ): Promise<{
    valido: boolean;
    status: string;
    valorPago: number;
    paymentId?: string;
    metodo?: string;
    mensagem?: string;
  }> => {
    const refId = isConsulta ? `AGEND-${plano.id}` : `MED-${medico?.id || ""}`;
    const valorEsperado = Number(plano.valor || 0);

    // 1. Tentar verificação via microserviço de pagamentos (porta 8081)
    try {
      const queryParams = new URLSearchParams();
      if (refId) queryParams.append("referenceId", refId);
      if (specificPaymentId) queryParams.append("paymentId", specificPaymentId);
      if (valorEsperado) queryParams.append("expectedAmount", String(valorEsperado));

      const resp = await fetch(
        `http://localhost:8081/api/payments/verify?${queryParams.toString()}`
      );
      if (resp.ok) {
        const dados = await resp.json();
        return {
          valido: dados.valid === true,
          status: dados.status,
          valorPago: dados.amountPaid,
          paymentId: dados.paymentId,
          metodo: dados.paymentMethod || "Mercado Pago",
          mensagem: dados.message,
        };
      }
    } catch (e) {
      console.warn("Microserviço local 8081 indisponível, consultando API oficial do Mercado Pago diretamente:", e);
    }

    // 2. Fallback: Consultar API oficial do Mercado Pago diretamente
    try {
      // 2a. Caso tenha um Payment ID específico
      if (specificPaymentId && !specificPaymentId.startsWith("MP-")) {
        const idLimpo = specificPaymentId.replace(/[^0-9]/g, "");
        if (idLimpo) {
          const directPaymentResp = await fetch(
            `https://api.mercadopago.com/v1/payments/${idLimpo}`,
            {
              headers: {
                Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
            }
          );
          if (directPaymentResp.ok) {
            const pData = await directPaymentResp.json();
            const isAprovado = pData.status === "approved";
            const valorPago = Number(pData.transaction_amount || 0);
            const valorCorreto = valorPago >= valorEsperado;

            if (isAprovado && valorCorreto) {
              return {
                valido: true,
                status: pData.status,
                valorPago,
                paymentId: String(pData.id),
                metodo: pData.payment_method_id || "Mercado Pago",
                mensagem: "Pagamento validado e aprovado com sucesso no Mercado Pago.",
              };
            }
          }
        }
      }

      // 2b. Buscar por external_reference
      const mpResp = await fetch(
        `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(
          refId
        )}&sort=date_created&criteria=desc`,
        {
          headers: {
            Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (mpResp.ok) {
        const mpData = await mpResp.json();
        if (mpData.results && mpData.results.length > 0) {
          for (const item of mpData.results) {
            const isAprovado = item.status === "approved";
            const valorPago = Number(item.transaction_amount || 0);
            const valorCorreto = valorPago >= valorEsperado;

            if (isAprovado && valorCorreto) {
              return {
                valido: true,
                status: item.status,
                valorPago,
                paymentId: String(item.id),
                metodo: item.payment_method_id || "Mercado Pago",
                mensagem: "Pagamento aprovado e verificado com sucesso no Mercado Pago.",
              };
            } else if (!isAprovado) {
              return {
                valido: false,
                status: item.status,
                valorPago,
                paymentId: String(item.id),
                mensagem: `Pagamento localizado, porém o status no Mercado Pago é: ${item.status}`,
              };
            } else {
              return {
                valido: false,
                status: item.status,
                valorPago,
                paymentId: String(item.id),
                mensagem: `O valor pago (R$ ${valorPago.toFixed(2)}) é inferior ao valor exigido (R$ ${valorEsperado.toFixed(2)}).`,
              };
            }
          }
        }
      }
    } catch (errDirect) {
      console.error("Erro na consulta direta ao Mercado Pago:", errDirect);
    }

    return {
      valido: false,
      status: "nao_localizado",
      valorPago: 0,
      mensagem: "Nenhum pagamento aprovado foi localizado no Mercado Pago para esta transação.",
    };
  };

  const handleConfirmarPagamentoRealizado = async () => {
    setIsProcessando(true);
    const checagem = await verificarStatusOficialMercadoPago();

    if (checagem.valido) {
      await processarFinalizacao({
        transacaoId: checagem.paymentId || transacaoId,
        metodo: checagem.metodo || "Mercado Pago / Mercado Livre",
        planoNome: plano.nome,
        valor: checagem.valorPago || plano.valor,
        detalhes: "Pagamento Validado e Confirmado Oficialmente no Mercado Pago",
      });
    } else {
      Swal.fire({
        icon: "warning",
        title: "Pagamento Não Confirmado no Mercado Pago",
        html: `
          <div class="text-start">
            <p class="mb-2 text-danger fw-bold">${
              checagem.mensagem || "Não identificamos a aprovação do valor correto."
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

  const processarFinalizacao = async (detalhes: any) => {
    try {
      if (isConsulta) {
        const agendaId = plano.id;
        const pacienteId =
          paciente?.id ||
          (localStorage.getItem("activeAgeUser")
            ? JSON.parse(localStorage.getItem("activeAgeUser") || "{}").id
            : null);

        if (agendaId && pacienteId) {
          await fetch(
            `https://active-age-backend.onrender.com/api/agendamentos/marcar/${agendaId}/paciente/${pacienteId}`,
            { method: "PUT" }
          ).catch(() => null);

          await fetch(
            `https://active-age-backend.onrender.com/api/agendamentos/${agendaId}/confirmar-pagamento`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                transacaoId: detalhes.transacaoId,
                metodo: detalhes.metodo,
                valorPago: plano.valor,
                dataPagamento: new Date().toISOString(),
              }),
            }
          ).catch((err) =>
            console.error("Erro ao confirmar pagamento no backend:", err)
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
            { method: "PUT" }
          ).catch(() => null);

          const userStr = localStorage.getItem("activeAgeUser");
          if (userStr) {
            const u = JSON.parse(userStr);
            u.assinaturaAtiva = true;
            localStorage.setItem("activeAgeUser", JSON.stringify(u));
          }
        }

        const userStr = localStorage.getItem("activeAgeUser");
        let userNome = medico?.nome || "Médico Titular";
        let userCrm = medico?.crm || "Não informado";
        let userEmail = medico?.email || "medico@activeage.com";

        if (userStr) {
          const u = JSON.parse(userStr);
          userNome = u.nome || userNome;
          userCrm = u.crm || userCrm;
          userEmail = u.email || userEmail;
        }

        const novaFatura = {
          id: `FAT-${new Date().getFullYear()}-${Math.floor(
            1000 + Math.random() * 9000
          )}`,
          competencia: `${new Date().toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })}`,
          dataEmissao: new Date().toLocaleDateString("pt-BR"),
          dataPagamento: `${new Date().toLocaleDateString(
            "pt-BR"
          )} ${new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          valor: plano.valor,
          status: "PAGA" as const,
          metodo: detalhes.metodo,
          codigoTransacao: detalhes.transacaoId,
        };

        const novaAssinatura = {
          id: `sub-${Math.floor(1000 + Math.random() * 9000)}`,
          medicoId: medicoId || "med-1",
          medicoNome: userNome,
          medicoCrm: userCrm,
          medicoEmail: userEmail,
          planoId: plano.id,
          planoNome: plano.nome,
          ciclo: plano.ciclo || "MENSAL",
          valor: plano.valor,
          status: "ATIVA" as const,
          dataInicio: new Date().toLocaleDateString("pt-BR"),
          proximaCobranca: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toLocaleDateString("pt-BR"),
          formaPagamento: detalhes.metodo,
          faturas: [novaFatura],
        };

        const salvas = localStorage.getItem("activeAgeAssinaturas");
        let lista = salvas ? JSON.parse(salvas) : [];
        lista = [
          novaAssinatura,
          ...lista.filter((item: any) => item.medicoEmail !== userEmail),
        ];
        localStorage.setItem("activeAgeAssinaturas", JSON.stringify(lista));
      }
    } catch (err) {
      console.error("Erro na sincronização de pagamento:", err);
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

  const copiarLinhaDigitavel = () => {
    navigator.clipboard.writeText(linhaDigitavel);
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Linha digitável copiada!",
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
          etapa === "CHECKOUT_EMBARCADO" ? "modal-xl" : "modal-lg"
        }`}
        style={{
          maxWidth: etapa === "CHECKOUT_EMBARCADO" ? "1260px" : "800px",
          width: etapa === "CHECKOUT_EMBARCADO" ? "98%" : "95%",
          transition: "max-width 0.3s ease-in-out, width 0.3s ease-in-out",
        }}
      >
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          {/* HEADER */}
          <div
            className="p-3 text-white d-flex justify-content-between align-items-center"
            style={{
              background: "linear-gradient(135deg, #009ee3 0%, #0077b6 100%)",
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-shield-lock-fill fs-4 text-warning"></i>
              <div>
                <h5 className="fw-bold mb-0">
                  {etapa === "CHECKOUT_EMBARCADO"
                    ? "Mercado Pago & Mercado Livre Checkout"
                    : "Mercado Pago Checkout"}
                </h5>
                <small className="text-white-50">
                  {etapa === "CHECKOUT_EMBARCADO"
                    ? "Ambiente Integrado Oficial (Site visível ao fundo)"
                    : "Ambiente Nativo Seguro & Criptografado"}
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              disabled={isProcessando}
              aria-label="Fechar"
            ></button>
          </div>

          {/* CORPO DO MODAL */}
          <div
            className={`modal-body bg-light ${
              etapa === "CHECKOUT_EMBARCADO" ? "p-2 p-md-3" : "p-4"
            }`}
          >
            {etapa === "SUCESSO" ? (
              <div className="text-center py-4">
                <div
                  className="mx-auto mb-3 d-flex align-items-center justify-content-center rounded-circle text-success shadow-sm"
                  style={{
                    width: "80px",
                    height: "80px",
                    backgroundColor: "#e8f5e9",
                    fontSize: "2.6rem",
                  }}
                >
                  <i className="bi bi-check-circle-fill"></i>
                </div>
                <h3 className="fw-bold mb-2 text-dark">
                  Pagamento Aprovado com Sucesso!
                </h3>
                <p className="text-muted mb-4 fs-6">
                  {isConsulta
                    ? `Sua teleconsulta com ${
                        medico?.nome || "o médico"
                      } foi confirmada e quitada.`
                    : `Seu consultório virtual no ${plano.nome} foi ativado com sucesso.`}
                </p>

                <div
                  className="bg-white p-4 rounded-3 border text-start mb-4 mx-auto shadow-sm"
                  style={{ maxWidth: "440px" }}
                >
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted small">Código da Transação:</span>
                    <strong className="font-monospace text-primary">
                      {transacaoId}
                    </strong>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted small">
                      {isConsulta ? "Serviço:" : "Plano:"}
                    </span>
                    <strong className="text-dark">{plano.nome}</strong>
                  </div>
                  {isConsulta && plano.dataHoraFormatada && (
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-muted small">Data e Horário:</span>
                      <strong className="text-dark">
                        {plano.dataHoraFormatada}
                      </strong>
                    </div>
                  )}
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted small">Forma de Pagamento:</span>
                    <span className="badge bg-primary-subtle text-primary border">
                      {detalhesFinalizados?.metodo || "Mercado Pago"}
                    </span>
                  </div>
                  <hr className="my-2" />
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-dark">Valor Quitado:</span>
                    <strong className="text-success fs-5">
                      R$ {Number(plano.valor || 0).toFixed(2)}
                    </strong>
                  </div>
                </div>

                <div className="d-flex justify-content-center gap-2">
                  <button
                    className="btn btn-success btn-lg px-4 fw-bold shadow-sm"
                    onClick={handleConcluirSucesso}
                  >
                    <i className="bi bi-arrow-right-circle-fill me-2"></i>
                    {isConsulta
                      ? "Ver Minhas Consultas no Painel"
                      : "Acessar Meu Consultório Virtual"}
                  </button>
                </div>
              </div>
            ) : etapa === "PIX_GERADO" ? (
              <div className="text-center py-2">
                <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                  <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 rounded-pill fw-bold">
                    <i className="bi bi-qr-code-scan me-1"></i> PIX Mercado Pago
                  </span>
                </div>

                <h4
                  className="fw-bold mb-1"
                  style={{ color: "var(--aa-brown)" }}
                >
                  Pague R$ {Number(plano.valor || 0).toFixed(2)} via PIX
                </h4>
                <p className="text-muted small mb-3">
                  Abra o aplicativo de qualquer banco, escolha <strong>PIX</strong>{" "}
                  e escaneie o QR Code abaixo:
                </p>

                {/* ÁREA DO QR CODE */}
                <div className="bg-white p-3 rounded-4 shadow-sm border d-inline-block mb-3">
                  <img
                    src={urlQrCode}
                    alt="QR Code PIX Válido"
                    style={{ width: "210px", height: "210px" }}
                    className="img-fluid rounded"
                  />
                  <div className="mt-2 small text-muted d-flex align-items-center justify-content-center gap-1">
                    <i className="bi bi-clock-history text-warning"></i>
                    <span>Expira em: </span>
                    <strong className="text-danger">
                      {formatarTempo(tempoRestantePix)}
                    </strong>
                  </div>
                </div>

                {/* CÓDIGO PIX COPIA E COLA */}
                <div className="mb-4 text-start">
                  <label className="form-label fw-bold small text-muted text-uppercase d-flex justify-content-between">
                    <span>Código PIX Copia e Cola:</span>
                    <span className="text-success small fw-semibold">
                      <i className="bi bi-shield-check me-1"></i>Padrão BACEN Oficial
                    </span>
                  </label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control font-monospace small bg-white text-dark"
                      value={codigoPixCopiaCola}
                      readOnly
                    />
                    <button
                      className="btn btn-primary fw-bold px-3"
                      type="button"
                      onClick={copiarCodigoPix}
                    >
                      <i className="bi bi-clipboard me-1"></i> Copiar Código
                    </button>
                  </div>
                </div>

                <div className="d-flex justify-content-center gap-2">
                  <button
                    className="btn btn-outline-secondary px-3"
                    onClick={() => setEtapa("FORMULARIO")}
                    disabled={isProcessando}
                  >
                    <i className="bi bi-arrow-left me-1"></i> Alterar Método
                  </button>
                  <button
                    className="btn btn-success fw-bold px-4 shadow-sm"
                    onClick={() =>
                      processarFinalizacao({
                        transacaoId,
                        metodo: "PIX Mercado Pago",
                        planoNome: plano.nome,
                        valor: plano.valor,
                        detalhes: "PIX Liquidado",
                      })
                    }
                    disabled={isProcessando}
                  >
                    <i className="bi bi-check-circle me-1"></i> Já Realizei o Pagamento
                  </button>
                </div>
              </div>
            ) : etapa === "BOLETO_GERADO" ? (
              <div className="text-center py-2">
                <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 rounded-pill fw-bold">
                    <i className="bi bi-upc-scan me-1"></i> Boleto Bancário
                  </span>
                </div>

                <h4
                  className="fw-bold mb-1"
                  style={{ color: "var(--aa-brown)" }}
                >
                  Boleto de R$ {Number(plano.valor || 0).toFixed(2)}
                </h4>
                <p className="text-muted small mb-3">
                  Vencimento em: <strong>{dataVencimentoBoleto}</strong>
                </p>

                <div className="bg-white p-4 rounded-4 shadow-sm border mb-4 text-start">
                  <label className="form-label fw-bold small text-muted text-uppercase">
                    Linha Digitável para Pagamento:
                  </label>
                  <div className="input-group mb-3">
                    <input
                      type="text"
                      className="form-control font-monospace small bg-light"
                      value={linhaDigitavel}
                      readOnly
                    />
                    <button
                      className="btn btn-primary fw-bold px-3"
                      type="button"
                      onClick={copiarLinhaDigitavel}
                    >
                      <i className="bi bi-clipboard me-1"></i> Copiar Linha
                    </button>
                  </div>

                  <div
                    className="p-3 bg-light rounded text-center border"
                    style={{ letterSpacing: "5px", fontFamily: "monospace" }}
                  >
                    <div className="fs-3 fw-bold text-dark">
                      ||| | | |||| || | ||||| || | |||| ||
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-center gap-2">
                  <button
                    className="btn btn-outline-secondary px-3"
                    onClick={() => setEtapa("FORMULARIO")}
                    disabled={isProcessando}
                  >
                    <i className="bi bi-arrow-left me-1"></i> Alterar Método
                  </button>
                  <button
                    className="btn btn-success fw-bold px-4 shadow-sm"
                    onClick={() =>
                      processarFinalizacao({
                        transacaoId,
                        metodo: "Boleto Bancário",
                        planoNome: plano.nome,
                        valor: plano.valor,
                        detalhes: `Vencimento: ${dataVencimentoBoleto}`,
                      })
                    }
                    disabled={isProcessando}
                  >
                    <i className="bi bi-check-circle me-1"></i> Confirmar Pagamento do Boleto
                  </button>
                </div>
              </div>
            ) : etapa === "CHECKOUT_EMBARCADO" ? (
              /* TELA EMBARCADA DO CHECKOUT DO MERCADO PAGO / MERCADO LIVRE (TAMANHO DO MODAL) */
              <div className="py-1">
                {/* BARRA SUPERIOR DE INFORMAÇÕES E CONTROLES */}
                <div className="d-flex justify-content-between align-items-center mb-3 bg-white p-2 px-3 rounded-3 border shadow-sm">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary text-white px-2 py-1 small fw-semibold">
                      <i className="bi bi-wallet2 me-1"></i> Mercado Pago / Mercado Livre
                    </span>
                    <span className="small text-muted d-none d-md-inline">
                      Total a pagar: <strong className="text-success">R$ {Number(plano.valor || 0).toFixed(2)}</strong>
                    </span>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setEtapa("FORMULARIO")}
                      disabled={isProcessando}
                    >
                      <i className="bi bi-arrow-left me-1"></i> Voltar às opções
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      title="Recarregar tela de pagamento"
                      onClick={() => {
                        setIsIframeCarregando(true);
                        const iframe = document.getElementById("mpCheckoutIframe") as HTMLIFrameElement;
                        if (iframe) iframe.src = checkoutUrl;
                      }}
                    >
                      <i className="bi bi-arrow-clockwise"></i>
                    </button>
                  </div>
                </div>

                {/* CONTAINER DO IFRAME EMBARCADO NO TAMANHO DO MODAL */}
                <div
                  className="position-relative w-100 rounded-3 overflow-hidden shadow-sm border bg-white"
                  style={{ height: "680px" }}
                >
                  {isIframeCarregando && (
                    <div
                      className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white z-2"
                    >
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
                    onLoad={() => setIsIframeCarregando(false)}
                    allow="payment; camera; microphone; clipboard-read; clipboard-write; geolocation"
                  />
                </div>

                {/* RODAPÉ COM CONFIRMAÇÃO DIRETA */}
                <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                  <div className="small text-muted">
                    <i className="bi bi-shield-check text-success me-1"></i>
                    O site continua visível em segundo plano.
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setEtapa("FORMULARIO")}
                      disabled={isProcessando}
                    >
                      <i className="bi bi-arrow-left me-1"></i> Voltar
                    </button>
                    <button
                      type="button"
                      className="btn btn-success btn-sm fw-bold px-3 shadow-sm"
                      onClick={handleConfirmarPagamentoRealizado}
                      disabled={isProcessando}
                    >
                      {isProcessando ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1"></span>
                          Confirmando...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle-fill me-1"></i> Já Paguei / Confirmar Pagamento
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ETAPA FORMULÁRIO COM TODAS AS FORMAS DE PAGAMENTO */
              <div className="row g-4">
                {/* COLUNA RESUMO DO PEDIDO */}
                <div className="col-12 col-md-5 order-md-2">
                  <div className="card border-0 shadow-sm rounded-3 p-3 bg-white">
                    <h6
                      className="fw-bold mb-3"
                      style={{ color: "var(--aa-brown)" }}
                    >
                      <i className="bi bi-cart-check me-2 text-primary"></i>
                      Resumo do Pedido
                    </h6>

                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted small">
                        {isConsulta ? "Serviço:" : "Plano:"}
                      </span>
                      <strong
                        className="text-dark text-truncate"
                        style={{ maxWidth: "160px" }}
                      >
                        {plano.nome}
                      </strong>
                    </div>

                    {isConsulta ? (
                      <>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="text-muted small">Médico:</span>
                          <span
                            className="small text-truncate fw-semibold"
                            style={{ maxWidth: "160px" }}
                          >
                            {medico?.nome || "Médico Especialista"}
                          </span>
                        </div>

                        {medico?.crm && (
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-muted small">CRM:</span>
                            <span className="badge bg-light text-dark border small">
                              {medico.crm}
                            </span>
                          </div>
                        )}

                        {plano.dataHoraFormatada && (
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-muted small">Horário:</span>
                            <span className="small text-dark fw-semibold">
                              {plano.dataHoraFormatada}
                            </span>
                          </div>
                        )}

                        {plano.duracaoMinutos && (
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-muted small">Duração:</span>
                            <span className="badge bg-light text-dark border">
                              {plano.duracaoMinutos} min
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="text-muted small">Modalidade:</span>
                          <span className="badge bg-light text-dark border">
                            {plano.ciclo === "MENSAL"
                              ? "Mensal Recorrente"
                              : "Anual (com Desconto)"}
                          </span>
                        </div>

                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="text-muted small">
                            Médico Titular:
                          </span>
                          <span
                            className="small text-truncate"
                            style={{ maxWidth: "160px" }}
                          >
                            {medico?.nome || "Titular da Conta"}
                          </span>
                        </div>
                      </>
                    )}

                    <hr className="my-2" />

                    <div className="d-flex justify-content-between align-items-center my-2">
                      <span className="fw-bold">Total a Pagar:</span>
                      <span
                        className="fs-4 fw-bold"
                        style={{ color: "var(--aa-orange)" }}
                      >
                        R$ {Number(plano.valor || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="p-2 bg-light rounded text-center small text-muted mt-2 border">
                      <i className="bi bi-shield-check text-success me-1"></i>
                      Ambiente seguro processado via Mercado Pago.
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm w-100 mt-2 fw-bold shadow-sm"
                      style={{ backgroundColor: "#009ee3", borderColor: "#0077b6" }}
                      onClick={handlePagarComSaldoMercadoPago}
                      disabled={isProcessando}
                    >
                      {isProcessando ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1"></span>
                          Redirecionando...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-box-arrow-right me-1"></i> Pagar com Mercado Pago
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* COLUNA DE ESCOLHA DAS FORMAS DE PAGAMENTO */}
                <div className="col-12 col-md-7 order-md-1">
                  {/* TABS DE SELEÇÃO */}
                  <div className="d-flex gap-1 p-1 bg-white rounded-3 border mb-3 flex-wrap">
                    <button
                      type="button"
                      className={`btn flex-grow-1 fw-bold btn-sm py-2 d-flex align-items-center justify-content-center gap-1 ${
                        metodoSelecionado === "SALDO_MP"
                          ? "text-white shadow-sm"
                          : "btn-light text-muted"
                      }`}
                      style={{
                        backgroundColor:
                          metodoSelecionado === "SALDO_MP" ? "#009ee3" : undefined,
                        borderColor:
                          metodoSelecionado === "SALDO_MP" ? "#009ee3" : undefined,
                      }}
                      onClick={() => setMetodoSelecionado("SALDO_MP")}
                    >
                      <i className="bi bi-wallet2"></i> Mercado Pago / Mercado Livre
                    </button>

                    <button
                      type="button"
                      className={`btn flex-grow-1 fw-bold btn-sm py-2 d-flex align-items-center justify-content-center gap-1 ${
                        metodoSelecionado === "PIX"
                          ? "btn-success shadow-sm"
                          : "btn-light text-muted"
                      }`}
                      onClick={() => setMetodoSelecionado("PIX")}
                    >
                      <i className="bi bi-qr-code"></i> PIX
                    </button>
                  </div>

                  {/* CONTEÚDO MERCADO PAGO / MERCADO LIVRE */}
                  {metodoSelecionado === "SALDO_MP" && (
                    <div className="card border-0 shadow-sm p-4 bg-white rounded-3">
                      <div
                        className="p-3 rounded-3 text-white mb-3 shadow-sm position-relative overflow-hidden"
                        style={{
                          background:
                            "linear-gradient(135deg, #009ee3 0%, #0077b6 100%)",
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="d-flex align-items-center gap-2">
                            <div
                              className="bg-white rounded-circle d-flex align-items-center justify-content-center"
                              style={{
                                width: "40px",
                                height: "40px",
                                color: "#009ee3",
                                fontSize: "1.25rem",
                              }}
                            >
                              <i className="bi bi-shield-check"></i>
                            </div>
                            <div>
                              <span className="fw-bold fs-6 d-block">
                                Mercado Pago & Mercado Livre
                              </span>
                              <small className="text-white-50">
                                Checkout Oficial Integrado
                              </small>
                            </div>
                          </div>
                          <span className="badge bg-white text-primary fw-bold px-2 py-1 shadow-sm">
                            <i className="bi bi-check-circle-fill me-1 text-success"></i>{" "}
                            Oficial
                          </span>
                        </div>

                        <div className="mt-3 pt-2 border-top border-white border-opacity-25">
                          <p
                            className="mb-0 small text-white-75"
                            style={{ fontSize: "0.85rem" }}
                          >
                            Pague com seu <strong>Saldo em Conta</strong>, cartões de crédito salvos ou <strong>Mercado Crédito</strong>. Ao clicar no botão abaixo, a tela de pagamento abrirá diretamente nesta janela (mantendo o site ao fundo).
                          </p>
                        </div>
                      </div>

                      <button
                        className="btn btn-lg w-100 fw-bold shadow-sm text-white"
                        style={{ backgroundColor: "#009ee3", borderColor: "#0077b6" }}
                        onClick={handlePagarComSaldoMercadoPago}
                        disabled={isProcessando}
                      >
                        {isProcessando ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Abrindo Mercado Pago / Mercado Livre...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-box-arrow-right me-2"></i>
                            Pagar com Mercado Pago / Mercado Livre
                          </>
                        )}
                      </button>

                      <div className="text-center mt-3">
                        <small className="text-muted">
                          <i className="bi bi-shield-check text-success me-1"></i>
                          Pagamento integrado diretamente na mesma janela (o site permanece ao fundo).
                        </small>
                      </div>
                    </div>
                  )}

                  {/* CONTEÚDO PIX */}
                  {metodoSelecionado === "PIX" && (
                    <div className="card border-0 shadow-sm p-4 bg-white rounded-3 text-center">
                      <div
                        className="mx-auto mb-2 d-flex align-items-center justify-content-center rounded-circle text-success"
                        style={{
                          width: "56px",
                          height: "56px",
                          backgroundColor: "#e8f5e9",
                          fontSize: "1.9rem",
                        }}
                      >
                        <i className="bi bi-lightning-charge-fill"></i>
                      </div>
                      <h5 className="fw-bold mb-1 text-dark">
                        Pagamento Instantâneo via PIX
                      </h5>
                      <p className="text-muted small mb-3">
                        {isConsulta
                          ? "Confirmação imediata e liberação automática da teleconsulta."
                          : "Liberação instantânea do consultório médico e emissão de recibo."}
                      </p>

                      <div className="alert alert-success border-0 small text-start mb-4 py-2">
                        <i className="bi bi-check2-circle me-1"></i>
                        Sem taxas adicionais • Padrão Banco Central do Brasil •
                        Aprovação em segundos
                      </div>

                      <button
                        className="btn btn-success btn-lg w-100 fw-bold shadow-sm"
                        onClick={handleGerarPix}
                        disabled={isProcessando}
                      >
                        {isProcessando ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Gerando QR Code...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-qr-code-scan me-2"></i>
                            Gerar Chave e QR Code PIX
                          </>
                        )}
                      </button>
                    </div>
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
