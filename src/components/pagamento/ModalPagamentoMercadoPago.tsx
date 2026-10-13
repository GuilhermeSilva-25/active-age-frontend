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
  const [linhaDigitavel, setLinhaDigitavel] = useState("");
  const [dataVencimentoBoleto, setDataVencimentoBoleto] = useState("");

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
          etapa === "CHECKOUT_EMBARCADO" ? "modal-xl" : ""
        }`}
        style={{
          maxWidth: etapa === "CHECKOUT_EMBARCADO" ? "1200px" : "680px",
          width: etapa === "CHECKOUT_EMBARCADO" ? "98%" : "95%",
          transition: "max-width 0.3s ease-in-out, width 0.3s ease-in-out",
        }}
      >
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          {/* CABEÇALHO CLARO E ACOLHEDOR EM AZUL */}
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
          <div className={`modal-body bg-light ${etapa === "CHECKOUT_EMBARCADO" ? "p-2 p-md-3" : "p-3 p-md-4"}`}>
            {etapa === "SUCESSO" ? (
              /* ETAPA: SUCESSO */
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
                    ? `Sua consulta com ${medico?.nome || "o médico"} está confirmada.`
                    : `Seu consultório virtual no ${plano.nome} foi ativado.`}
                </p>

                {/* RESUMO SIMPLES */}
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
                      <strong className="text-dark">{plano.dataHoraFormatada}</strong>
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
                  {isConsulta ? "Ir para Minhas Consultas" : "Acessar Meu Consultório"}
                </button>
              </div>
            ) : etapa === "PIX_GERADO" ? (
              /* ETAPA: PIX GERADO */
              <div className="text-center py-2">
                {/* VALOR EM DESTAQUE */}
                <div className="p-3 mb-3 bg-white rounded-4 border shadow-sm">
                  <span className="text-muted small text-uppercase fw-semibold d-block">
                    Valor a ser pago:
                  </span>
                  <span className="text-success fw-bold" style={{ fontSize: "2.3rem" }}>
                    R$ {Number(plano.valor || 0).toFixed(2).replace(".", ",")}
                  </span>
                </div>

                {/* INSTRUÇÕES SIMPLES EM 3 PASSOS */}
                <div className="bg-white p-3 p-md-4 rounded-4 border shadow-sm mb-3 text-start">
                  <h5 className="fw-bold text-dark mb-3 fs-5">
                    Como pagar no seu celular:
                  </h5>
                  <div className="d-flex align-items-start gap-3 mb-3">
                    <div
                      className="rounded-circle bg-success text-white fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "32px", height: "32px", fontSize: "1.1rem" }}
                    >
                      1
                    </div>
                    <p className="mb-0 fs-6 text-dark" style={{ lineHeight: "1.4" }}>
                      Abra o <strong>aplicativo do seu banco</strong> no celular.
                    </p>
                  </div>

                  <div className="d-flex align-items-start gap-3 mb-3">
                    <div
                      className="rounded-circle bg-success text-white fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "32px", height: "32px", fontSize: "1.1rem" }}
                    >
                      2
                    </div>
                    <p className="mb-0 fs-6 text-dark" style={{ lineHeight: "1.4" }}>
                      Escolha a opção <strong>PIX</strong> e aponte a câmera para o QR Code abaixo:
                    </p>
                  </div>

                  {/* QR CODE CENTRALIZADO */}
                  <div className="text-center my-3">
                    <div className="p-3 bg-light rounded-4 border d-inline-block shadow-sm">
                      <img
                        src={urlQrCode}
                        alt="QR Code PIX"
                        style={{ width: "210px", height: "210px" }}
                        className="img-fluid rounded-3"
                      />
                      <div className="mt-2 small text-muted d-flex align-items-center justify-content-center gap-1">
                        <i className="bi bi-clock text-warning"></i>
                        <span>Tempo restante: </span>
                        <strong className="text-danger fs-6">{formatarTempo(tempoRestantePix)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="rounded-circle bg-success text-white fw-bold d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "32px", height: "32px", fontSize: "1.1rem" }}
                    >
                      3
                    </div>
                    <div className="w-100">
                      <p className="mb-2 fs-6 text-dark" style={{ lineHeight: "1.4" }}>
                        Se preferir pagar no mesmo celular, copie o código PIX:
                      </p>
                      <button
                        className="btn btn-outline-primary btn-lg w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2 rounded-3"
                        type="button"
                        onClick={copiarCodigoPix}
                      >
                        <i className="bi bi-clipboard fs-5"></i> Copiar Código PIX
                      </button>
                    </div>
                  </div>
                </div>

                {/* BOTÕES DE AÇÃO */}
                <div className="d-flex flex-column gap-2 mt-3">
                  <button
                    className="btn btn-success btn-lg py-3 fw-bold shadow-sm rounded-pill fs-5 d-flex align-items-center justify-content-center gap-2"
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
                    <i className="bi bi-check-circle-fill fs-4"></i>
                    Já Fiz o Pagamento no Meu Banco
                  </button>
                  <button
                    className="btn btn-link text-secondary text-decoration-none mt-1"
                    onClick={() => setEtapa("FORMULARIO")}
                    disabled={isProcessando}
                  >
                    ← Voltar e escolher outra forma de pagamento
                  </button>
                </div>
              </div>
            ) : etapa === "CHECKOUT_EMBARCADO" ? (
              /* ETAPA: CHECKOUT MERCADO PAGO INTEGRADO */
              <div className="py-1">
                {/* INSTRUÇÃO CLARA */}
                <div className="d-flex justify-content-between align-items-center mb-2 bg-white p-3 rounded-3 border shadow-sm">
                  <div>
                    <h6 className="fw-bold mb-0 text-dark fs-6">
                      <i className="bi bi-credit-card-2-front text-primary me-2"></i>
                      Tela de Pagamento do Mercado Pago
                    </h6>
                    <small className="text-muted">
                      Preencha os dados abaixo. Após concluir, clique em <strong>Confirmar Pagamento</strong>.
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary px-3 py-1 rounded-pill"
                    onClick={() => setEtapa("FORMULARIO")}
                    disabled={isProcessando}
                  >
                    ← Trocar Método
                  </button>
                </div>

                {/* IFRAME */}
                <div
                  className="position-relative w-100 rounded-3 overflow-hidden shadow-sm border bg-white"
                  style={{ height: "650px" }}
                >
                  {isIframeCarregando && (
                    <div className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-white z-2">
                      <div className="spinner-border text-primary mb-3" style={{ width: "3rem", height: "3rem" }}>
                        <span className="visually-hidden">Carregando...</span>
                      </div>
                      <h5 className="fw-bold text-dark mb-1">
                        Carregando a tela de pagamento...
                      </h5>
                      <small className="text-muted">Por favor, aguarde alguns instantes</small>
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

                {/* RODAPÉ COM BOTÃO GRANDE DE CONFIRMAR */}
                <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-3 py-2 rounded-pill"
                    onClick={() => setEtapa("FORMULARIO")}
                    disabled={isProcessando}
                  >
                    ← Voltar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg fw-bold px-4 py-2 shadow-sm rounded-pill fs-5 d-flex align-items-center gap-2 text-white"
                    style={{ backgroundColor: "#009ee3", borderColor: "#0077b6" }}
                    onClick={handleConfirmarPagamentoRealizado}
                    disabled={isProcessando}
                  >
                    {isProcessando ? (
                      <>
                        <span className="spinner-border spinner-border-sm"></span>
                        Verificando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill"></i>
                        Já Concluí o Pagamento / Confirmar
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* ETAPA INICIAL: FORMULÁRIO SIMPLIFICADO PARA IDOSOS */
              <div className="py-2">
                {/* 1. RESUMO CLARO DA CONSULTA / SERVIÇO */}
                <div className="p-3 p-md-4 mb-4 rounded-4 border bg-white shadow-sm">
                  <div className="row align-items-center g-3">
                    <div className="col-12 col-md-7">
                      <span className="badge bg-primary-subtle text-primary fs-6 px-3 py-1 rounded-pill mb-2 fw-semibold">
                        {isConsulta ? "🩺 Teleconsulta" : "💼 Plano Active Age"}
                      </span>
                      <h4 className="fw-bold text-dark mb-1" style={{ fontSize: "1.35rem" }}>
                        {isConsulta ? (medico?.nome ? `Dr(a). ${medico.nome}` : plano.nome) : plano.nome}
                      </h4>
                      {isConsulta && plano.dataHoraFormatada && (
                        <p className="text-secondary mb-0 fs-6 mt-1">
                          <i className="bi bi-calendar-check text-primary me-2"></i>
                          Horário: <strong>{plano.dataHoraFormatada}</strong>
                        </p>
                      )}
                    </div>
                    <div className="col-12 col-md-5 text-md-end border-top border-md-top-0 pt-3 pt-md-0">
                      <span className="text-muted d-block small text-uppercase fw-semibold">
                        Valor a Pagar:
                      </span>
                      <strong className="text-success fw-bold" style={{ fontSize: "2.3rem", lineHeight: 1.1 }}>
                        R$ {Number(plano.valor || 0).toFixed(2).replace(".", ",")}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 2. ESCOLHA SIMPLES DO MÉTODO DE PAGAMENTO */}
                <h5 className="fw-bold text-dark mb-3 fs-5">
                  Escolha como deseja pagar:
                </h5>

                {/* CARD 1: PIX */}
                <div
                  className={`p-3 p-md-4 rounded-4 mb-3 transition-all ${
                    metodoSelecionado === "PIX"
                      ? "bg-success bg-opacity-10 shadow-sm"
                      : "bg-white"
                  }`}
                  style={{
                    cursor: "pointer",
                    border: metodoSelecionado === "PIX" ? "2.5px solid #198754" : "2px solid #e2e8f0",
                  }}
                  onClick={() => setMetodoSelecionado("PIX")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                        style={{ width: "52px", height: "52px", backgroundColor: "#198754", fontSize: "1.6rem" }}
                      >
                        <i className="bi bi-qr-code"></i>
                      </div>
                      <div>
                        <div className="d-flex align-items-center gap-2">
                          <h5 className="fw-bold mb-0 text-dark fs-5">Pagar com PIX</h5>
                          <span className="badge bg-success text-white small px-2 py-1 rounded-pill">
                            Mais Rápido
                          </span>
                        </div>
                        <p className="text-muted mb-0 mt-1" style={{ fontSize: "0.95rem" }}>
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

                {/* CARD 2: CARTÃO DE CRÉDITO OU MERCADO PAGO */}
                <div
                  className={`p-3 p-md-4 rounded-4 mb-4 transition-all ${
                    metodoSelecionado === "SALDO_MP"
                      ? "bg-primary bg-opacity-10 shadow-sm"
                      : "bg-white"
                  }`}
                  style={{
                    cursor: "pointer",
                    border: metodoSelecionado === "SALDO_MP" ? "2.5px solid #009ee3" : "2px solid #e2e8f0",
                  }}
                  onClick={() => setMetodoSelecionado("SALDO_MP")}
                  role="button"
                  tabIndex={0}
                >
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                        style={{ width: "52px", height: "52px", backgroundColor: "#009ee3", fontSize: "1.6rem" }}
                      >
                        <i className="bi bi-credit-card-2-front"></i>
                      </div>
                      <div>
                        <h5 className="fw-bold mb-0 text-dark fs-5">Cartão de Crédito ou Mercado Pago</h5>
                        <p className="text-muted mb-0 mt-1" style={{ fontSize: "0.95rem" }}>
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

                {/* 3. BOTÃO DE AÇÃO PRINCIPAL GRANDE */}
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
                          <i className="bi bi-qr-code-scan fs-4"></i>
                          Continuar com PIX
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary btn-lg w-100 py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2 rounded-pill fs-5 text-white"
                      style={{
                        backgroundColor: "#009ee3",
                        borderColor: "#008ac5",
                      }}
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
                          <i className="bi bi-credit-card fs-4"></i>
                          Continuar para Pagamento com Cartão
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

