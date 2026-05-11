import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Send,
  Users,
  MessageSquareText,
} from "lucide-react";

function getToken() {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken");

  return token ? String(token).replace("Bearer ", "").trim() : "";
}

function getSocketUrl() {
  return "https://gas-hr-project.onrender.com";
}

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function MeetingRoomPage() {
  const { meetingId } = useParams();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const peersRef = useRef({});
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");

  const socketUrl = useMemo(() => getSocketUrl(), []);

  async function getLocalMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    return stream;
  }

  function createPeerConnection(targetSocketId) {
    const pc = new RTCPeerConnection(iceServers);
    const localStream = localStreamRef.current;

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("meeting:signal", {
          to: targetSocketId,
          signal: {
            type: "candidate",
            candidate: event.candidate,
          },
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;

      setRemoteStreams((prev) => {
        const exists = prev.some((item) => item.socketId === targetSocketId);

        if (exists) {
          return prev.map((item) =>
            item.socketId === targetSocketId ? { ...item, stream } : item
          );
        }

        return [...prev, { socketId: targetSocketId, stream }];
      });
    };

    peersRef.current[targetSocketId] = pc;
    return pc;
  }

  async function callParticipant(targetSocketId) {
    const pc = createPeerConnection(targetSocketId);
    const offer = await pc.createOffer();

    await pc.setLocalDescription(offer);

    socketRef.current?.emit("meeting:signal", {
      to: targetSocketId,
      signal: offer,
    });
  }

  async function handleSignal({ from, signal }) {
    let pc = peersRef.current[from];

    if (!pc) {
      pc = createPeerConnection(from);
    }

    if (signal.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current?.emit("meeting:signal", {
        to: from,
        signal: answer,
      });
    }

    if (signal.type === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
    }

    if (signal.type === "candidate") {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } catch {
        // ignore duplicated candidate errors
      }
    }
  }

  async function replaceVideoTrack(newTrack) {
    Object.values(peersRef.current).forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");

      if (sender) {
        sender.replaceTrack(newTrack);
      }
    });
  }

  async function toggleScreenShare() {
    try {
      if (!sharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        const screenTrack = screenStream.getVideoTracks()[0];

        await replaceVideoTrack(screenTrack);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = async () => {
          const cameraTrack = localStreamRef.current?.getVideoTracks()?.[0];

          if (cameraTrack) {
            await replaceVideoTrack(cameraTrack);

            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStreamRef.current;
            }
          }

          setSharing(false);
        };

        setSharing(true);
      } else {
        const cameraTrack = localStreamRef.current?.getVideoTracks()?.[0];

        if (cameraTrack) {
          await replaceVideoTrack(cameraTrack);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        }

        setSharing(false);
      }
    } catch (err) {
      setError(err.message || "Screen sharing failed");
    }
  }

  function toggleMic() {
    const audioTrack = localStreamRef.current?.getAudioTracks()?.[0];

    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setMicOn(audioTrack.enabled);

    socketRef.current?.emit("meeting:media-state", {
      micOn: audioTrack.enabled,
      cameraOn,
    });
  }

  function toggleCamera() {
    const videoTrack = localStreamRef.current?.getVideoTracks()?.[0];

    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;
    setCameraOn(videoTrack.enabled);

    socketRef.current?.emit("meeting:media-state", {
      micOn,
      cameraOn: videoTrack.enabled,
    });
  }

  function sendMessage(e) {
    e.preventDefault();

    if (!chatText.trim()) return;

    socketRef.current?.emit("meeting:chat", {
      message: chatText,
    });

    setChatText("");
  }

  function leaveMeeting() {
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};

    localStreamRef.current?.getTracks()?.forEach((track) => track.stop());

    socketRef.current?.disconnect();

    try {
      const userData = JSON.parse(
        localStorage.getItem("hr_portal_user") || "{}"
      );

      const role = String(
        userData?.role || userData?.roleName || ""
      ).toLowerCase();

      if (role === "employee") {
        navigate("/meetings", { replace: true });
      } else {
        navigate("/admin/meetings", { replace: true });
      }
    } catch {
      navigate("/admin/meetings", { replace: true });
    }
  }

  useEffect(() => {
    let mounted = true;

    async function start() {
      try {
        const token = getToken();

        if (!token) {
          setError("Missing login token. Please login again.");
          return;
        }

        await getLocalMedia();

        if (!mounted) return;

        const socket = io(socketUrl, {
          transports: ["websocket", "polling"],
          auth: { token },
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          setConnected(true);
          setError("");
          socket.emit("meeting:join", { meetingId });
        });

        socket.on("connect_error", (err) => {
          setConnected(false);
          setError(err.message || "Failed to connect meeting room");
        });

        socket.on("disconnect", () => {
          setConnected(false);
        });

        socket.on("meeting:error", (payload) => {
          setError(payload?.message || "Meeting room error");
        });

        socket.on(
          "meeting:joined",
          async ({ participants: currentParticipants, socketId }) => {
            setParticipants(currentParticipants || []);

            const others = (currentParticipants || []).filter(
              (item) => item.socketId !== socketId
            );

            for (const participant of others) {
              await callParticipant(participant.socketId);
            }
          }
        );

        socket.on("meeting:user-joined", (participant) => {
          setParticipants((prev) => {
            const exists = prev.some(
              (item) => item.socketId === participant.socketId
            );

            return exists ? prev : [...prev, participant];
          });
        });

        socket.on("meeting:user-left", ({ socketId }) => {
          peersRef.current[socketId]?.close();
          delete peersRef.current[socketId];

          setParticipants((prev) =>
            prev.filter((item) => item.socketId !== socketId)
          );

          setRemoteStreams((prev) =>
            prev.filter((item) => item.socketId !== socketId)
          );
        });

        socket.on("meeting:signal", handleSignal);

        socket.on("meeting:chat", (message) => {
          setMessages((prev) => [...prev, message]);
        });

        socket.on("meeting:media-state", ({ socketId, micOn, cameraOn }) => {
          setParticipants((prev) =>
            prev.map((item) =>
              item.socketId === socketId
                ? { ...item, micOn, cameraOn }
                : item
            )
          );
        });
      } catch (err) {
        setError(err.message || "Could not start meeting room");
      }
    }

    start();

    return () => {
      mounted = false;

      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};

      localStreamRef.current?.getTracks()?.forEach((track) => track.stop());
      socketRef.current?.disconnect();
    };
  }, [meetingId, socketUrl]);

  return (
    <div className="meeting-room-page">
      <style>{`
        .meeting-room-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          background: #020617;
          color: #fff;
          overflow: hidden;
        }

        .meeting-main {
          min-width: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          padding: 18px;
          gap: 14px;
        }

        .meeting-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .meeting-header h1 {
          margin: 0;
          font-size: 1.25rem;
        }

        .meeting-status {
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(34,197,94,.14);
          color: #bbf7d0;
          font-weight: 900;
          font-size: .8rem;
        }

        .meeting-status.off {
          background: rgba(239,68,68,.14);
          color: #fecaca;
        }

        .video-grid {
          min-height: 0;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 14px;
          align-content: start;
          overflow: auto;
          padding-bottom: 8px;
        }

        .video-card {
          position: relative;
          min-height: 220px;
          border-radius: 24px;
          overflow: hidden;
          background: #0f172a;
          border: 1px solid rgba(148,163,184,.22);
          box-shadow: 0 24px 60px rgba(0,0,0,.28);
        }

        .video-card video {
          width: 100%;
          height: 100%;
          min-height: 220px;
          object-fit: cover;
          background: #020617;
        }

        .video-name {
          position: absolute;
          left: 12px;
          bottom: 12px;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(15,23,42,.76);
          backdrop-filter: blur(12px);
          font-weight: 900;
          font-size: .78rem;
        }

        .controls {
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          padding: 12px;
          border-radius: 24px;
          background: rgba(15,23,42,.82);
          border: 1px solid rgba(148,163,184,.18);
        }

        .control-btn {
          min-width: 54px;
          height: 54px;
          border-radius: 18px;
          border: none;
          background: #1e293b;
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .control-btn.active {
          background: #2563eb;
        }

        .control-btn.danger {
          background: #dc2626;
        }

        .meeting-side {
          border-left: 1px solid rgba(148,163,184,.16);
          background: #0f172a;
          display: grid;
          grid-template-rows: auto 1fr auto;
          min-height: 100vh;
        }

        .side-section {
          padding: 16px;
          border-bottom: 1px solid rgba(148,163,184,.16);
        }

        .side-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 950;
          margin-bottom: 12px;
        }

        .participant-list {
          display: grid;
          gap: 8px;
        }

        .participant {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 16px;
          background: rgba(255,255,255,.06);
        }

        .avatar {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: #2563eb;
          font-weight: 950;
        }

        .participant strong {
          display: block;
          font-size: .85rem;
        }

        .participant span {
          display: block;
          color: #94a3b8;
          font-size: .72rem;
          margin-top: 2px;
        }

        .chat-area {
          min-height: 0;
          overflow: auto;
          padding: 16px;
          display: grid;
          gap: 10px;
          align-content: start;
        }

        .chat-message {
          padding: 10px;
          border-radius: 16px;
          background: rgba(255,255,255,.07);
        }

        .chat-message strong {
          display: block;
          font-size: .78rem;
          margin-bottom: 4px;
          color: #93c5fd;
        }

        .chat-message p {
          margin: 0;
          color: #e5e7eb;
          font-size: .86rem;
          line-height: 1.5;
        }

        .chat-form {
          display: flex;
          gap: 8px;
          padding: 14px;
          border-top: 1px solid rgba(148,163,184,.16);
        }

        .chat-form input {
          flex: 1;
          min-width: 0;
          border: 1px solid rgba(148,163,184,.22);
          background: #020617;
          color: #fff;
          border-radius: 16px;
          padding: 0 12px;
          outline: none;
          font-weight: 800;
        }

        .chat-form button {
          width: 46px;
          height: 46px;
          border: none;
          border-radius: 16px;
          background: #2563eb;
          color: white;
          display: grid;
          place-items: center;
        }

        .meeting-error {
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(239,68,68,.15);
          color: #fecaca;
          border: 1px solid rgba(248,113,113,.24);
          font-weight: 850;
        }

        @media (max-width: 900px) {
          .meeting-room-page {
            grid-template-columns: 1fr;
          }

          .meeting-side {
            min-height: auto;
            border-left: none;
            border-top: 1px solid rgba(148,163,184,.16);
          }

          .video-card {
            min-height: 190px;
          }

          .video-card video {
            min-height: 190px;
          }
        }
      `}</style>

      <main className="meeting-main">
        <header className="meeting-header">
          <div>
            <h1>Meeting Room</h1>
            <p style={{ margin: "4px 0 0", color: "#94a3b8", fontWeight: 800 }}>
              Room ID: {meetingId}
            </p>
          </div>

          <span className={`meeting-status ${connected ? "" : "off"}`}>
            {connected ? "Connected" : "Connecting"}
          </span>
        </header>

        {error ? <div className="meeting-error">{error}</div> : null}

        <section className="video-grid">
          <div className="video-card">
            <video ref={localVideoRef} autoPlay playsInline muted />
            <div className="video-name">
              You {sharing ? "• Sharing Screen" : ""}
            </div>
          </div>

          {remoteStreams.map((item) => {
            const participant = participants.find(
              (p) => p.socketId === item.socketId
            );

            return (
              <RemoteVideo
                key={item.socketId}
                stream={item.stream}
                name={participant?.name || "Participant"}
              />
            );
          })}
        </section>

        <footer className="controls">
          <button
            className={`control-btn ${micOn ? "active" : ""}`}
            onClick={toggleMic}
            title="Microphone"
            type="button"
          >
            {micOn ? <Mic /> : <MicOff />}
          </button>

          <button
            className={`control-btn ${cameraOn ? "active" : ""}`}
            onClick={toggleCamera}
            title="Camera"
            type="button"
          >
            {cameraOn ? <Camera /> : <CameraOff />}
          </button>

          <button
            className={`control-btn ${sharing ? "active" : ""}`}
            onClick={toggleScreenShare}
            title="Share Screen"
            type="button"
          >
            <MonitorUp />
          </button>

          <button
            className="control-btn danger"
            onClick={leaveMeeting}
            title="Leave Meeting"
            type="button"
          >
            <PhoneOff />
          </button>
        </footer>
      </main>

      <aside className="meeting-side">
        <div className="side-section">
          <div className="side-title">
            <Users size={18} />
            Participants ({participants.length})
          </div>

          <div className="participant-list">
            {participants.map((item) => (
              <div className="participant" key={item.socketId}>
                <div className="avatar">
                  {String(item.name || "U").slice(0, 1).toUpperCase()}
                </div>

                <div>
                  <strong>{item.name || "User"}</strong>
                  <span>{item.role || "Participant"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chat-area">
          <div className="side-title">
            <MessageSquareText size={18} />
            Live Chat
          </div>

          {messages.map((message) => (
            <div className="chat-message" key={message.id}>
              <strong>{message.sender}</strong>
              <p>{message.message}</p>
            </div>
          ))}
        </div>

        <form className="chat-form" onSubmit={sendMessage}>
          <input
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder="Write message..."
          />

          <button type="submit">
            <Send size={18} />
          </button>
        </form>
      </aside>
    </div>
  );
}

function RemoteVideo({ stream, name }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-card">
      <video ref={ref} autoPlay playsInline />
      <div className="video-name">{name}</div>
    </div>
  );
}
