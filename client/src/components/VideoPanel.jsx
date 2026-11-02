// Job 2 (Audio/Video/Screen Share). Embeds Jitsi Meet's free public server
// (meet.jit.si) via its IFrame API — no account, API key, or payment method
// needed, ever. Previously used Daily.co, switched to avoid any card/billing
// requirement for the team (see LOG.md).
import { useEffect, useRef, useState } from "react";

const JITSI_DOMAIN = "meet.jit.si";
const JITSI_SCRIPT_URL = `https://${JITSI_DOMAIN}/external_api.js`;

let scriptPromise;
function loadJitsiApi() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) return resolve(window.JitsiMeetExternalAPI);
    const script = document.createElement("script");
    script.src = JITSI_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.JitsiMeetExternalAPI);
    script.onerror = () => reject(new Error("Could not load the video call script."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function VideoPanel({ roomId }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | joining | joined
  const [error, setError] = useState("");
  // Diagnostics: what Jitsi reports, so "can't see/hear each other" can be
  // traced to different rooms, muted/blocked devices, or a dropped call.
  const [diag, setDiag] = useState({ count: 0, events: [] });

  // Leaving the room (or switching rooms) should also leave the call.
  useEffect(() => {
    return () => {
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, [roomId]);

  async function joinCall() {
    setError("");
    setStatus("joining");
    try {
      const JitsiMeetExternalAPI = await loadJitsiApi();
      const displayName = localStorage.getItem("couchcrew:name") || "Guest";
      const api = new JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName: `couchcrew-${roomId}`,
        parentNode: containerRef.current,
        width: "100%",
        height: "100%",
        userInfo: { displayName },
        configOverwrite: { prejoinPageEnabled: false, disableDeepLinking: true },
      });
      apiRef.current = api;

      const log = (text) =>
        setDiag((d) => ({
          ...d,
          events: [...d.events, `${new Date().toLocaleTimeString()} ${text}`].slice(-8),
        }));
      const refreshCount = () =>
        api
          .getNumberOfParticipants()
          .then((count) => setDiag((d) => ({ ...d, count })))
          .catch(() => {});
      api.addEventListener("videoConferenceJoined", (e) => {
        log(`joined ${e.roomName}`);
        refreshCount();
      });
      api.addEventListener("participantJoined", (e) => {
        log(`${e.displayName || "someone"} joined`);
        refreshCount();
      });
      api.addEventListener("participantLeft", () => {
        log("someone left");
        refreshCount();
      });
      api.addEventListener("audioMuteStatusChanged", (e) =>
        log(`my mic ${e.muted ? "muted" : "on"}`),
      );
      api.addEventListener("videoMuteStatusChanged", (e) =>
        log(`my camera ${e.muted ? "off" : "on"}`),
      );
      api.addEventListener("errorOccurred", (e) =>
        log(`error: ${e.error?.name || e.error?.message || "unknown"}`),
      );
      api.addEventListener("videoConferenceLeft", () => {
        api.dispose();
        apiRef.current = null;
        setDiag({ count: 0, events: [] });
        setStatus("idle");
      });
      setDiag({ count: 0, events: [] });
      setStatus("joined");
    } catch (err) {
      setError(err.message || "Could not join the call");
      setStatus("idle");
    }
  }

  function leaveCall() {
    apiRef.current?.dispose();
    apiRef.current = null;
    setDiag({ count: 0, events: [] });
    setStatus("idle");
  }

  return (
    <div className="video-panel">
      <h2>Video &amp; Screen Share</h2>
      {status !== "joined" && (
        <div className="video-join">
          <p>Join the call to talk, show your camera, or share your screen.</p>
          <button type="button" onClick={joinCall} disabled={status === "joining"}>
            {status === "joining" ? "Connecting…" : "Join call"}
          </button>
          {error && <p className="video-error">{error}</p>}
        </div>
      )}
      <div
        ref={containerRef}
        className="jitsi-container"
        hidden={status !== "joined"}
      />
      {status === "joined" && (
        <>
          <p className="video-diag-count">
            In the call: {diag.count} · call room: couchcrew-{roomId}
          </p>
          <details className="video-diag">
            <summary>Call diagnostics</summary>
            <ul>
              {diag.events.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </details>
          <button type="button" className="secondary leave" onClick={leaveCall}>
            Leave call
          </button>
        </>
      )}
    </div>
  );
}
