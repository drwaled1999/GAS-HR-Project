import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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
  const possibleKeys = [
    "hr_portal_auth",
    "employee_portal_auth",
    "auth",
    "user_auth",
    "portal_auth",
    "token",
    "authToken",
    "hr_portal_token",
  ];

  for (const key of possibleKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    if (key === "token" || key === "authToken" || key === "hr_portal_token") {
      return String(raw).replace("Bearer ", "").trim();
    }

    try {
      const parsed = JSON.parse(raw);

      if (typeof parsed === "string" && parsed.trim()) {
        return parsed.replace("Bearer ", "").trim();
      }

      if (parsed?.token) return String(parsed.token).replace("Bearer ", "").trim();
      if (parsed?.accessToken) return String(parsed.accessToken).replace("Bearer ", "").trim();
      if (parsed?.authToken) return String(parsed.authToken).replace("Bearer ", "").trim();
      if (parsed?.jwt) return String(parsed.jwt).replace("Bearer ", "").trim();
    } catch {
      if (raw.trim()) return String(raw).replace("Bearer ", "").trim();
    }
  }

  return "";
}

function getSocketUrl() {
  return "https://gas-hr-project.onrender.com";
}

function getExitPath() {
  try {
    const userData = JSON.parse(localStorage.getItem("hr_portal_user") || "{}");
    const role = String(userData?.role || userData?.roleName || "").toLowerCase();
    return role === "employee" ? "/meetings" : "/admin/meetings";
  } catch {
    return "/admin/meetings";
  }
}

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function MeetingRoomPage() {
  const { meetingId } = useParams();

  const localVideoRef = useRef(null);
  const peersRef = useRef({});
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const exitingRef = useRef(false);

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

  function cleanupMeeting() {
    Object.values(peersRef.current || {}).forEach((pc) => {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.close();
      } catch {}
    });

    peersRef.current = {};

    try {
      localStreamRef.current?.getTracks()?.forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
    } catch {}

    try {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.io.opts.reconnection = false;
        socketRef.current.disconnect();
        socketRef.current.close?.();
      }
    } catch {}

    socketRef.current = null;
    localStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }

  function leaveMeeting() {
    exitingRef.current = true;
    cleanupMeeting();

    setConnected(false);
    setParticipants([]);
    setRemoteStreams([]);
    setMessages([]);
    setSharing(false);
    setError("");

    window.location.replace(getExitPath());
  }

  async function getLocalMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    if (exitingRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return stream;
    }

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
      if (exitingRef.current) return;

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
      if (exitingRef.current) return;

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
    if (exitingRef.current) return;

    const pc = createPeerConnection(targetSocketId);
    const offer = await pc.createOffer();

    await pc.setLocalDescription(offer);

    socketRef.current?.emit("meeting:signal", {
      to: targetSocketId,
      signal: offer,
    });
  }

  async function handleSignal({ from, signal }) {
    if (exitingRef.current) return;

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
      } catch {}
    }
  }

  async function replaceVideoTrack(newTrack) {
    Object.values(peersRef.current || {}).forEach((pc) => {
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
          if (exitingRef.current) return;

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
      if (!exitingRef.current) {
        setError(err.message || "Screen sharing failed");
      }
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

  useEffect(() => {
    let mounted = true;
    exitingRef.current = false;

    async function start() {
      if (exitingRef.current) return;

      try {
        const token = getToken();

        if (!token) {
          setError("Missing login token. Please login again.");
          return;
        }

        await getLocalMedia();

        if (!mounted || exitingRef.current) return;

        const socket = io(socketUrl, {
          transports: ["websocket"],
          forceNew: true,
          reconnection: false,
          auth: { token },
        });

        socketRef.current = socket;

        socket.on("connect", () => {
          if (exitingRef.current) return;

          setConnected(true);
          setError("");
          socket.emit("meeting:join", { meetingId });
        });

        socket.on("connect_error", (err) => {
          if (exitingRef.current) return;

          setConnected(false);
          setError(err.message || "Failed to connect meeting room");
        });

        socket.on("disconnect", () => {
          if (exitingRef.current) return;
          setConnected(false);
        });

        socket.on("meeting:error", (payload) => {
          if (exitingRef.current) return;
          setError(payload?.message || "Meeting room error");
        });

        socket.on(
          "meeting:joined",
          async ({ participants: currentParticipants, socketId }) => {
            if (exitingRef.current) return;

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
          if (exitingRef.current) return;

          setParticipants((prev) => {
            const exists = prev.some(
              (item) => item.socketId === participant.socketId
            );

            return exists ? prev : [...prev, participant];
          });
        });

        socket.on("meeting:user-left", ({ socketId }) => {
          if (exitingRef.current) return;

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
          if (exitingRef.current) return;
          setMessages((prev) => [...prev, message]);
        });

        socket.on("meeting:media-state", ({ socketId, micOn, cameraOn }) => {
          if (exitingRef.current) return;

          setParticipants((prev) =>
            prev.map((item) =>
              item.socketId === socketId
                ? { ...item, micOn, cameraOn }
                : item
            )
          );
        });
      } catch (err) {
        if (!exitingRef.current) {
          setError(err.message || "Could not start meeting room");
        }
      }
    }

    start();

    return () => {
      mounted = false;
      exitingRef.current = true;
      cleanupMeeting();
    };
  }, [meetingId, socketUrl]);

  return (
    <div className="meeting-room-page">
      <style>{`
        .bottom-nav,
        .employee-bottom-nav,
        .mobile-bottom-nav,
        .employee-mobile-bottom-nav,
        .app-bottom-nav {
          display: none !important;
        }

        .meeting-room-page {
          width: 100%;
          min-height: calc(100dvh - 0px);
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          background: #020617;
          color: #fff;
          overflow: hidden;
          border-radius: 0;
        }

        .meeting-main {
          min-width: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          padding: 18px;
          gap: 14px;
          overflow: hidden;
        }

        .meeting-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
        }

        .meeting-header h1 {
          margin: 0;
          font-size: 1.25rem;
          line-height: 1.2;
        }

        .meeting-header p {
          word-break: break-word;
        }

        .meeting-status {
          flex-shrink: 0;
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
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 14px;
          align-content: start;
          overflow: auto;
          padding-bottom: 8px;
          scrollbar-width: thin;
        }

        .video-card {
          position: relative;
          min-height: 260px;
          aspect-ratio: 16 / 10;
          border-radius: 24px;
          overflow: hidden;
          background: #020617;
          border: 1px solid rgba(148,163,184,.22);
          box-shadow: 0 24px 60px rgba(0,0,0,.28);
        }

        .video-card video {
          width: 100%;
          height: 100%;
          min-height: 100%;
          object-fit: cover;
          background: #020617;
        }

        .video-name {
          position: absolute;
          left: 12px;
          bottom: 12px;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(15,23,42,.82);
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
          box-shadow: 0 18px 40px rgba(0,0,0,.25);
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
          touch-action: manipulation;
        }

        .control-btn.active {
          background: #2563eb;
        }

        .control-btn.danger {
          background: #dc2626;
        }

        .meeting-side {
          min-width: 0;
          border-left: 1px solid rgba(148,163,184,.16);
          background: #0f172a;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          min-height: 100%;
          overflow: hidden;
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
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: #2563eb;
          font-weight: 950;
          flex-shrink: 0;
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
          word-break: break-word;
        }

        .chat-form {
          display: flex;
          gap: 8px;
          padding: 14px;
          border-top: 1px solid rgba(148,163,184,.16);
          background: rgba(15,23,42,.98);
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
          height: 46px;
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
          flex-shrink: 0;
        }

        .meeting-error {
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(239,68,68,.15);
          color: #fecaca;
          border: 1px solid rgba(248,113,113,.24);
          font-weight: 850;
        }

        @media (max-width: 1100px) {
          .meeting-room-page {
            grid-template-columns: 1fr;
            overflow: auto;
          }

          .meeting-main {
            overflow: visible;
          }

          .meeting-side {
            border-left: none;
            border-top: 1px solid rgba(148,163,184,.16);
            min-height: auto;
            overflow: visible;
          }

          .chat-area {
            max-height: 320px;
          }
        }

        @media (max-width: 760px) {
          .meeting-room-page {
            min-height: 100dvh;
            display: block;
            padding: 0;
            overflow-x: hidden;
            padding-bottom: env(safe-area-inset-bottom);
          }

          .meeting-main {
            display: grid;
            grid-template-rows: auto auto auto;
            padding: 14px;
            gap: 12px;
            min-height: auto;
          }

          .meeting-header {
            align-items: flex-start;
          }

          .meeting-header h1 {
            font-size: 1.2rem;
          }

          .meeting-header p {
            font-size: .78rem;
            max-width: 230px;
          }

          .meeting-status {
            font-size: .72rem;
            padding: 7px 10px;
          }

          .meeting-error {
            font-size: .82rem;
            padding: 11px 12px;
          }

          .video-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            overflow: visible;
            padding: 0;
          }

          .video-card {
            width: 100%;
            min-height: 320px;
            aspect-ratio: 9 / 14;
            border-radius: 24px;
          }

          .video-card video {
            min-height: 320px;
            object-fit: cover;
          }

          .video-name {
            left: 10px;
            bottom: 10px;
            font-size: .75rem;
          }

          .controls {
            position: sticky;
            bottom: 10px;
            z-index: 50;
            margin-top: 6px;
            padding: 10px;
            border-radius: 22px;
            justify-content: center;
            background: rgba(15,23,42,.94);
            backdrop-filter: blur(16px);
          }

          .control-btn {
            min-width: 56px;
            height: 56px;
            border-radius: 18px;
          }

          .meeting-side {
            display: block;
            background: #0f172a;
            border-top: 1px solid rgba(148,163,184,.16);
          }

          .side-section {
            padding: 16px 14px;
          }

          .participant-list {
            gap: 10px;
          }

          .participant {
            border-radius: 18px;
            padding: 12px;
          }

          .chat-area {
            max-height: 360px;
            padding: 16px 14px;
          }

          .chat-form {
            position: sticky;
            bottom: 0;
            z-index: 40;
            padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
          }
        }

        @media (max-width: 430px) {
          .meeting-main {
            padding: 12px;
          }

          .video-card {
            min-height: 300px;
            border-radius: 22px;
          }

          .video-card video {
            min-height: 300px;
          }

          .controls {
            gap: 8px;
          }

          .control-btn {
            min-width: 52px;
            height: 52px;
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
