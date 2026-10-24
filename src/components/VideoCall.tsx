import React, { useEffect, useRef, useState } from "react";

interface VideoCallProps {
  roomId: string;
  userId: string;
  userName: string;
  userType?: "MEDICO" | "PACIENTE" | string;
  onLeave: () => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    {
      urls: "stun:stun.relay.metered.ca:80",
    },
    {
      urls: "stun:stun.l.google.com:19302",
    },
    {
      urls: "stun:stun1.l.google.com:19302",
    },
    {
      urls: "turn:br.relay.metered.ca:80",
      username: "6c34572d93f85439b12aed90",
      credential: "t599XYLCjJoKRrjG",
    },
    {
      urls: "turn:br.relay.metered.ca:80?transport=tcp",
      username: "6c34572d93f85439b12aed90",
      credential: "t599XYLCjJoKRrjG",
    },
    {
      urls: "turn:br.relay.metered.ca:443",
      username: "6c34572d93f85439b12aed90",
      credential: "t599XYLCjJoKRrjG",
    },
    {
      urls: "turns:br.relay.metered.ca:443?transport=tcp",
      username: "6c34572d93f85439b12aed90",
      credential: "t599XYLCjJoKRrjG",
    },
  ],
};

export const VideoCall: React.FC<VideoCallProps> = ({
  roomId,
  userId,
  userName,
  userType = "PACIENTE",
  onLeave,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const reconnectTimeoutRef = useRef<any>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState<
    "connecting" | "waiting" | "connected" | "error"
  >("connecting");
  const [hasRemoteMedia, setHasRemoteMedia] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(true);

  useEffect(() => {
    let timer: any = null;
    if (callStatus === "connected" || hasRemoteMedia) {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callStatus, hasRemoteMedia]);

  useEffect(() => {
    if (callStatus === "connected" && remoteVideoRef.current) {
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.volume = 1.0;
      remoteVideoRef.current.play().catch((err) => {
        console.warn("Autoplay bloqueado pelo navegador:", err);
        setNeedsAudioUnlock(true);
      });
    }
  }, [callStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    let isMounted = true;

    const setupMediaStream = async () => {
      if (localStreamRef.current) return localStreamRef.current;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30 },
            facingMode: "user",
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        return stream;
      } catch (mediaErr) {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = audioOnly;
          setVideoOff(true);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = audioOnly;
          }
          return audioOnly;
        } catch (e: any) {
          throw new Error("Permissão de câmera e microfone necessária.");
        }
      }
    };

    const connectWebSocket = () => {
      if (!isMounted) return;

      const wsUrl =
        (import.meta as any).env?.VITE_WS_URL ||
        "wss://active-age-backend.onrender.com/ws/video";

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping", roomId }));
          }
        }, 15000);

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0;
          if (!hasRemoteMedia && !remoteStreamRef.current) {
            setCallStatus("waiting");
          }
          ws.send(
            JSON.stringify({
              type: "join",
              roomId,
              userId,
              userName,
              userType,
            })
          );
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "pong") return;

            if (data.type === "error") {
              if (!hasRemoteMedia) {
                setErrorMessage(data.message || "Erro de conexão na sala.");
                setCallStatus("error");
              }
              return;
            }

            if (data.type === "joined") {
              if (!hasRemoteMedia && !remoteStreamRef.current) {
                setCallStatus("waiting");
              }
            } else if (data.type === "user-joined") {
              console.log("👤 [WebRTC] Outro participante ingressou. Enviando oferta SDP...");
              await createAndSendOffer();
            } else if (data.type === "offer") {
              await handleRemoteOffer(data.offer);
            } else if (data.type === "answer") {
              await handleRemoteAnswer(data.answer);
            } else if (data.type === "ice-candidate") {
              if (data.candidate) {
                await handleRemoteCandidate(data.candidate);
              }
            } else if (data.type === "user-left") {
              console.log("👋 [WebRTC] Notificação user-left recebida.");
              // Se os tracks de áudio/vídeo ainda estão ativos e transmitindo via TURN/P2P, NÃO derruba a chamada!
              const isMediaStillAlive =
                remoteStreamRef.current &&
                remoteStreamRef.current
                  .getTracks()
                  .some((t) => t.readyState === "live" && !t.muted);

              if (isMediaStillAlive) {
                console.log("🛡️ Transmissão de vídeo continua ativa. Ignorando user-left transitório.");
                return;
              }

              setHasRemoteMedia(false);
              setCallStatus("waiting");
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
              }
              remoteStreamRef.current = null;
              if (pcRef.current) {
                try {
                  pcRef.current.close();
                } catch (e) {}
                pcRef.current = null;
              }
            }
          } catch (msgErr) {
            console.error("Erro ao tratar mensagem WS:", msgErr);
          }
        };

        ws.onerror = () => {
          console.warn("⚠️ WebSocket de sinalização oscilou.");
          if (reconnectAttemptsRef.current < 12 && isMounted) {
            reconnectAttemptsRef.current += 1;
            // Só exibe tela de reconexão se a mídia ainda não estiver rodando
            if (!hasRemoteMedia && !remoteStreamRef.current) {
              setCallStatus("connecting");
              setErrorMessage(
                `Conectando ao servidor de teleconsulta... (tentativa ${reconnectAttemptsRef.current}/12)`
              );
            }
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
          } else if (!hasRemoteMedia) {
            setErrorMessage(
              "Não foi possível conectar ao servidor de sinalização (" + wsUrl + "). Clique em 'Tentar Novamente' abaixo."
            );
            setCallStatus("error");
          }
        };

        ws.onclose = () => {
          clearInterval(pingInterval);
          if (isMounted && reconnectAttemptsRef.current < 12 && !hasRemoteMedia) {
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
          }
        };
      } catch (e: any) {
        setErrorMessage("Erro ao iniciar WebSocket: " + e.message);
        setCallStatus("error");
      }
    };

    const initCall = async () => {
      try {
        setCallStatus("connecting");
        setErrorMessage("Iniciando dispositivos e conectando à sala...");
        fetch("https://active-age-backend.onrender.com/api/usuarios", { method: "HEAD" }).catch(() => null);
        await setupMediaStream();
        connectWebSocket();
      } catch (err: any) {
        setErrorMessage(err.message || "Erro ao acessar dispositivos de mídia.");
        setCallStatus("error");
      }
    };

    initCall();

    const handleBeforeUnload = () => {
      cleanup();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      isMounted = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      cleanup();
    };
  }, [roomId, userId]);

  const attachLocalTracks = (pc: RTCPeerConnection) => {
    if (!localStreamRef.current) return;
    const senders = pc.getSenders();
    localStreamRef.current.getTracks().forEach((track) => {
      const alreadyAdded = senders.some((s) => s.track && s.track.id === track.id);
      if (!alreadyAdded) {
        try {
          pc.addTrack(track, localStreamRef.current!);
        } catch (e) {
          console.warn("Erro ao anexar track local:", e);
        }
      }
    });
  };

  const getOrCreatePeerConnection = (): RTCPeerConnection => {
    if (pcRef.current && pcRef.current.signalingState !== "closed") {
      attachLocalTracks(pcRef.current);
      return pcRef.current;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    attachLocalTracks(pc);

    pc.ontrack = (event) => {
      console.log("🎥 [WebRTC] ontrack recebido:", event.track.kind, event.streams);

      let stream: MediaStream;
      if (event.streams && event.streams[0]) {
        stream = event.streams[0];
      } else {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        if (!remoteStreamRef.current.getTracks().some((t) => t.id === event.track.id)) {
          remoteStreamRef.current.addTrack(event.track);
        }
        stream = remoteStreamRef.current;
      }

      remoteStreamRef.current = stream;
      setHasRemoteMedia(true);
      setCallStatus("connected");

      if (event.track.kind === "video") {
        setRemoteHasVideo(true);
        event.track.onmute = () => setRemoteHasVideo(false);
        event.track.onunmute = () => {
          setRemoteHasVideo(true);
          setHasRemoteMedia(true);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => setNeedsAudioUnlock(true));
          }
        };
        event.track.onended = () => setRemoteHasVideo(false);
      }

      if (event.track.kind === "audio") {
        event.track.onunmute = () => {
          setHasRemoteMedia(true);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => setNeedsAudioUnlock(true));
          }
        };
      }

      if (remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject !== stream) {
          remoteVideoRef.current.srcObject = stream;
        }
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.volume = 1.0;

        const playPromise = remoteVideoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setNeedsAudioUnlock(false))
            .catch((err) => {
              console.warn("⚠️ Autoplay bloqueado pelo navegador:", err);
              setNeedsAudioUnlock(true);
            });
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
            roomId,
          })
        );
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE Connection State:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setCallStatus("connected");
        if (remoteVideoRef.current) {
          remoteVideoRef.current.play().catch(() => setNeedsAudioUnlock(true));
        }
      } else if (pc.iceConnectionState === "failed") {
        console.warn("⚠️ ICE Connection State FAILED. Tentando restartIce()...");
        try {
          if (typeof (pc as any).restartIce === "function") {
            (pc as any).restartIce();
            createAndSendOffer();
          }
        } catch (e) {
          console.error("Erro no restartIce:", e);
        }
      }
      // NOTA: Estados transitórios como 'disconnected' ou 'checking' NÃO expulsam para 'waiting'!
    };

    pc.onconnectionstatechange = () => {
      console.log("Peer Connection State:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setCallStatus("connected");
        if (remoteVideoRef.current) {
          remoteVideoRef.current.play().catch(() => setNeedsAudioUnlock(true));
        }
      } else if (pc.connectionState === "failed") {
        console.warn("⚠️ Peer Connection FAILED. Tentando restabelecer oferta...");
        try {
          createAndSendOffer();
        } catch (e) {}
      }
    };

    return pc;
  };

  const createAndSendOffer = async () => {
    try {
      const pc = getOrCreatePeerConnection();
      attachLocalTracks(pc);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "offer",
            offer,
            roomId,
          })
        );
      }
    } catch (err) {
      console.error("Erro ao criar/enviar offer:", err);
    }
  };

  const handleRemoteOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      const pc = getOrCreatePeerConnection();
      attachLocalTracks(pc);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      while (iceCandidatesQueueRef.current.length > 0) {
        const candidate = iceCandidatesQueueRef.current.shift();
        if (candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn("Erro ao aplicar candidato ICE:", e);
          }
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "answer",
            answer,
            roomId,
          })
        );
      }
    } catch (err) {
      console.error("Erro ao tratar offer remoto:", err);
    }
  };

  const handleRemoteAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));

        while (iceCandidatesQueueRef.current.length > 0) {
          const candidate = iceCandidatesQueueRef.current.shift();
          if (candidate) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.warn("Erro ao aplicar candidato ICE no answer:", e);
            }
          }
        }
      }
    } catch (err) {
      console.error("Erro ao tratar answer remoto:", err);
    }
  };

  const handleRemoteCandidate = async (candidate: RTCIceCandidateInit) => {
    try {
      if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        iceCandidatesQueueRef.current.push(candidate);
      }
    } catch (err) {
      console.warn("Erro ao tratar candidato remoto:", err);
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setMicMuted(!micMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setVideoOff(!videoOff);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];

        if (pcRef.current) {
          const sender = pcRef.current
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          stopScreenSharing();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error(err);
      }
    } else {
      stopScreenSharing();
    }
  };

  const stopScreenSharing = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (pcRef.current && videoTrack) {
        const sender = pcRef.current
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
    setIsScreenSharing(false);
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      remoteStreamRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "leave", roomId }));
        }
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }
  };

  return (
    <div
      className="position-relative w-100 rounded-4 overflow-hidden shadow-inner d-flex flex-column align-items-center justify-content-center"
      style={{
        height: "460px",
        backgroundColor: "#0d1117",
        border: "3px solid var(--aa-green, #28a745)",
      }}
      onClick={() => {
        if (remoteVideoRef.current && remoteVideoRef.current.paused) {
          remoteVideoRef.current.play().then(() => setNeedsAudioUnlock(false)).catch(() => {});
        }
      }}
    >
      {/* Barra de Status Superior */}
      <div
        className="position-absolute top-0 start-0 end-0 p-3 d-flex justify-content-between align-items-center"
        style={{
          zIndex: 15,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
        }}
      >
        <div className="d-flex align-items-center gap-2">
          {callStatus === "connected" && (
            <span className="badge bg-success shadow-sm d-flex align-items-center gap-2 px-3 py-2">
              <span
                className="spinner-grow spinner-grow-sm text-light"
                style={{ width: "8px", height: "8px" }}
              ></span>
              AO VIVO • {formatDuration(callDuration)}
            </span>
          )}
          {callStatus === "waiting" && (
            <span className="badge bg-warning text-dark shadow-sm px-3 py-2">
              <i className="bi bi-hourglass-split me-1"></i> Aguardando participante...
            </span>
          )}
          {callStatus === "connecting" && (
            <span className="badge bg-info shadow-sm px-3 py-2">
              <i className="bi bi-broadcast me-1"></i> Conectando...
            </span>
          )}
          {callStatus === "error" && (
            <span className="badge bg-danger shadow-sm px-3 py-2">
              <i className="bi bi-exclamation-triangle-fill me-1"></i> Erro
            </span>
          )}
        </div>

        <span className="badge bg-dark bg-opacity-75 text-light border border-secondary px-3 py-2">
          <i className="bi bi-shield-lock-fill text-success me-1"></i> WebRTC P2P Seguro
        </span>
      </div>

      {/* Vídeo Remoto (Tela Inteira) - Sempre ativo no DOM para manter o decodificador ligado */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="position-absolute top-0 start-0 w-100 h-100 object-fit-cover"
        style={{
          backgroundColor: "#0d1117",
          zIndex: 1,
        }}
      />

      {/* Indicador caso o participante remoto esteja com a câmera desligada ou somente áudio */}
      {callStatus === "connected" && !remoteHasVideo && (
        <div
          className="position-absolute top-50 start-50 translate-middle text-center text-white"
          style={{ zIndex: 6 }}
        >
          <div
            className="rounded-circle bg-secondary bg-opacity-50 d-inline-flex align-items-center justify-content-center mb-3 shadow"
            style={{ width: "90px", height: "90px" }}
          >
            <i className="bi bi-person-fill display-4 text-light"></i>
          </div>
          <h5 className="fw-bold mb-1">
            {userType === "MEDICO" ? "Paciente Conectado" : "Médico Conectado"}
          </h5>
          <span className="badge bg-success bg-opacity-75 px-3 py-2">
            <i className="bi bi-mic-fill me-1"></i> Transmissão de Áudio Ativa
          </span>
        </div>
      )}

      {/* Banner de desbloqueio de Áudio/Vídeo caso o navegador bloqueie autoplay */}
      {needsAudioUnlock && callStatus === "connected" && (
        <div
          className="position-absolute top-50 start-50 translate-middle text-center p-4 rounded-4 shadow-lg"
          style={{
            zIndex: 30,
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            border: "2px solid #ffc107",
            maxWidth: "360px",
          }}
        >
          <i className="bi bi-volume-up-fill text-warning fs-1 mb-2 d-block"></i>
          <h6 className="text-white fw-bold mb-1">Áudio ou Vídeo Bloqueado</h6>
          <p className="text-light opacity-75 small mb-3">
            O navegador pausou a mídia para evitar reprodução automática. Clique para liberar som e imagem.
          </p>
          <button
            type="button"
            className="btn btn-warning fw-bold px-4 py-2 rounded-pill shadow"
            onClick={(e) => {
              e.stopPropagation();
              if (remoteVideoRef.current) {
                remoteVideoRef.current.muted = false;
                remoteVideoRef.current.volume = 1.0;
                remoteVideoRef.current
                  .play()
                  .then(() => setNeedsAudioUnlock(false))
                  .catch(console.error);
              }
            }}
          >
            <i className="bi bi-play-circle-fill me-1"></i> Ativar Transmissão Agora
          </button>
        </div>
      )}

      {/* Overlay de Espera / Conectando / Erro */}
      {callStatus !== "connected" && !hasRemoteMedia && (
        <div
          className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center text-center text-white px-4"
          style={{ zIndex: 10, backgroundColor: "#0d1117" }}
        >
          {callStatus === "waiting" && (
            <>
              <div className="mb-3">
                <div
                  className="spinner-border text-success"
                  style={{ width: "3.5rem", height: "3.5rem" }}
                  role="status"
                >
                  <span className="visually-hidden">Aguardando...</span>
                </div>
              </div>
              <h5 className="fw-bold mb-2">Sala de Atendimento Pronta</h5>
              <p className="text-light opacity-75 mb-0" style={{ maxWidth: "380px" }}>
                Aguardando o {userType === "MEDICO" ? "paciente" : "médico"} entrar na
                sala. A transmissão iniciará automaticamente.
              </p>
            </>
          )}

          {callStatus === "connecting" && (
            <>
              <div className="spinner-border text-info mb-3" role="status"></div>
              <h5>Conectando à sala #{roomId.substring(0, 8)}...</h5>
            </>
          )}

          {callStatus === "error" && (
            <div className="alert alert-danger shadow-sm mb-0">
              <i className="bi bi-exclamation-octagon-fill fs-3 mb-2 d-block"></i>
              <h6 className="fw-bold">Problema na Conexão</h6>
              <p className="small mb-3">
                {errorMessage || "Verifique as permissões de câmera e microfone."}
              </p>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger bg-white fw-bold px-4 py-2 rounded-pill shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  reconnectAttemptsRef.current = 0;
                  setCallStatus("connecting");
                  const wsUrl = (import.meta as any).env?.VITE_WS_URL || "wss://active-age-backend.onrender.com/ws/video";
                  try {
                    const ws = new WebSocket(wsUrl);
                    wsRef.current = ws;
                    ws.onopen = () => {
                      reconnectAttemptsRef.current = 0;
                      setCallStatus("waiting");
                      ws.send(JSON.stringify({ type: "join", roomId, userId, userName, userType }));
                    };
                  } catch (err) {}
                }}
              >
                <i className="bi bi-arrow-clockwise me-1"></i> Tentar Reconectar Agora
              </button>
            </div>
          )}
        </div>
      )}

      {/* PIP do Vídeo Local (Canto Inferior Direito) */}
      <div
        className="position-absolute bottom-0 end-0 m-3 rounded-3 overflow-hidden shadow-lg border border-2 border-light"
        style={{
          width: "140px",
          height: "105px",
          zIndex: 20,
          backgroundColor: "#1e293b",
        }}
      >
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-100 h-100 object-fit-cover"
          style={{
            display: videoOff ? "none" : "block",
            transform: "scaleX(-1)",
          }}
        />

        {videoOff && (
          <div className="w-100 h-100 d-flex flex-column align-items-center justify-content-center text-white bg-dark">
            <i className="bi bi-camera-video-off-fill fs-4 text-secondary mb-1"></i>
            <span style={{ fontSize: "10px" }} className="text-muted">
              Câmera Desligada
            </span>
          </div>
        )}

        <div
          className="position-absolute bottom-0 start-0 end-0 px-2 py-1 text-truncate text-white"
          style={{
            fontSize: "11px",
            backgroundColor: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
          }}
        >
          <i className="bi bi-person-fill me-1 text-success"></i>
          {userName} (Você)
        </div>
      </div>

      {/* Barra de Ferramentas / Controles (Estilo Teams) */}
      <div
        className="position-absolute bottom-0 start-50 translate-middle-x mb-3 d-flex align-items-center gap-2 px-3 py-2 rounded-pill shadow-lg border border-secondary"
        style={{
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          backdropFilter: "blur(12px)",
          zIndex: 25,
        }}
      >
        <button
          type="button"
          className={`btn btn-sm rounded-circle d-flex align-items-center justify-content-center shadow-sm ${
            micMuted ? "btn-danger" : "btn-dark border border-secondary text-light"
          }`}
          style={{ width: "42px", height: "42px" }}
          onClick={(e) => {
            e.stopPropagation();
            toggleMic();
          }}
          title={micMuted ? "Ativar Microfone" : "Silenciar Microfone"}
        >
          <i className={`bi ${micMuted ? "bi-mic-mute-fill" : "bi-mic-fill"} fs-6`}></i>
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-circle d-flex align-items-center justify-content-center shadow-sm ${
            videoOff ? "btn-danger" : "btn-dark border border-secondary text-light"
          }`}
          style={{ width: "42px", height: "42px" }}
          onClick={(e) => {
            e.stopPropagation();
            toggleVideo();
          }}
          title={videoOff ? "Ligar Câmera" : "Desligar Câmera"}
        >
          <i
            className={`bi ${
              videoOff ? "bi-camera-video-off-fill" : "bi-camera-video-fill"
            } fs-6`}
          ></i>
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-circle d-flex align-items-center justify-content-center shadow-sm ${
            isScreenSharing ? "btn-primary" : "btn-dark border border-secondary text-light"
          }`}
          style={{ width: "42px", height: "42px" }}
          onClick={(e) => {
            e.stopPropagation();
            toggleScreenShare();
          }}
          title={isScreenSharing ? "Parar Compartilhamento" : "Compartilhar Tela"}
        >
          <i className="bi bi-display fs-6"></i>
        </button>

        <div className="vr bg-secondary mx-1" style={{ height: "24px" }}></div>

        <button
          type="button"
          className="btn btn-danger btn-sm rounded-circle d-flex align-items-center justify-content-center shadow-sm"
          style={{ width: "42px", height: "42px" }}
          onClick={(e) => {
            e.stopPropagation();
            onLeave();
          }}
          title="Sair da Consulta"
        >
          <i className="bi bi-telephone-x-fill fs-6"></i>
        </button>
      </div>
    </div>
  );
};
