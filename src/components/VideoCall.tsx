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
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: "turn:standard.relay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:standard.relay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:standard.relay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
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
  const [errorMessage, setErrorMessage] = useState("");
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let timer: any = null;
    if (callStatus === "connected") {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
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

      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      
      // Conecta ao servidor de sinalização oficial na nuvem ou VITE_WS_URL
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
          setCallStatus("waiting");
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
              setErrorMessage(data.message || "Erro de conexão na sala.");
              setCallStatus("error");
              return;
            }

            if (data.type === "joined") {
              setCallStatus("waiting");
            } else if (data.type === "user-joined") {
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
              setCallStatus("waiting");
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
              }
              remoteStreamRef.current = null;
              if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
              }
            }
          } catch (msgErr) {
            console.error(msgErr);
          }
        };

        ws.onerror = () => {
          if (reconnectAttemptsRef.current < 12 && isMounted) {
            reconnectAttemptsRef.current += 1;
            setCallStatus("connecting");
            setErrorMessage(
              `Conectando ao servidor de teleconsulta... (tentativa ${reconnectAttemptsRef.current}/12)`
            );
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
          } else {
            setErrorMessage(
              "Não foi possível conectar ao servidor de sinalização (" + wsUrl + "). Clique em 'Tentar Novamente' abaixo."
            );
            setCallStatus("error");
          }
        };

        ws.onclose = () => {
          clearInterval(pingInterval);
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
        // Acorda o backend do Render caso esteja em modo de hibernação
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

  const getOrCreatePeerConnection = (): RTCPeerConnection => {
    if (pcRef.current && pcRef.current.signalingState !== "closed") {
      return pcRef.current;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    remoteStreamRef.current = new MediaStream();
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStreamRef.current!);
        } catch (e) {}
      });
    }

    pc.ontrack = (event) => {
      if (remoteStreamRef.current) {
        if (!remoteStreamRef.current.getTracks().some((t) => t.id === event.track.id)) {
          remoteStreamRef.current.addTrack(event.track);
        }
      }
      if (remoteVideoRef.current && remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch(() => {});
      }
      setCallStatus("connected");
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
      if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
        setCallStatus("waiting");
      } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setCallStatus("connected");
      }
    };

    return pc;
  };

  const createAndSendOffer = async () => {
    try {
      const pc = getOrCreatePeerConnection();
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
      console.error(err);
    }
  };

  const handleRemoteOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      const pc = getOrCreatePeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      while (iceCandidatesQueueRef.current.length > 0) {
        const candidate = iceCandidatesQueueRef.current.shift();
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
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
      console.error(err);
    }
  };

  const handleRemoteAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));

        while (iceCandidatesQueueRef.current.length > 0) {
          const candidate = iceCandidatesQueueRef.current.shift();
          if (candidate) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoteCandidate = async (candidate: RTCIceCandidateInit) => {
    try {
      if (pcRef.current && pcRef.current.remoteDescription) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        iceCandidatesQueueRef.current.push(candidate);
      }
    } catch (err) {
      console.error(err);
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

      {/* Vídeo Remoto (Tela Inteira) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-100 h-100 object-fit-cover"
        style={{
          display: callStatus === "connected" ? "block" : "none",
          backgroundColor: "#000",
        }}
      />

      {/* Overlay de Espera / Conectando / Erro */}
      {callStatus !== "connected" && (
        <div
          className="text-center text-white px-4 py-5"
          style={{ zIndex: 5 }}
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
                onClick={() => {
                  reconnectAttemptsRef.current = 0;
                  setCallStatus("connecting");
                  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
                  const wsUrl = (import.meta as any).env?.VITE_WS_URL || "wss://active-age-backend.onrender.com/ws/video";
                  try {
                    const ws = new WebSocket(wsUrl);
                    wsRef.current = ws;
                    ws.onopen = () => {
                      reconnectAttemptsRef.current = 0;
                      setCallStatus("waiting");
                      ws.send(JSON.stringify({ type: "join", roomId, userId, userName, userType }));
                    };
                  } catch (e) {}
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
          onClick={toggleMic}
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
          onClick={toggleVideo}
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
          onClick={toggleScreenShare}
          title={isScreenSharing ? "Parar Compartilhamento" : "Compartilhar Tela"}
        >
          <i className="bi bi-display fs-6"></i>
        </button>

        <div className="vr bg-secondary mx-1" style={{ height: "24px" }}></div>

        <button
          type="button"
          className="btn btn-danger btn-sm rounded-circle d-flex align-items-center justify-content-center shadow-sm"
          style={{ width: "42px", height: "42px" }}
          onClick={onLeave}
          title="Sair da Consulta"
        >
          <i className="bi bi-telephone-x-fill fs-6"></i>
        </button>
      </div>
    </div>
  );
};
