// Job 2 (Audio/Video/Screen Share). Mic/camera/screen share go straight to
// Daily.co; our server only provisions a Daily room per CouchCrew room
// (POST /daily/room) so the API key never reaches the browser.
import { useCallback, useEffect, useRef, useState } from "react";
import Daily from "@daily-co/daily-js";
import {
  DailyAudio,
  DailyProvider,
  DailyVideo,
  useAudioTrack,
  useDaily,
  useDailyEvent,
  useLocalSessionId,
  useParticipantIds,
  useParticipantProperty,
  useScreenShare,
  useVideoTrack,
} from "@daily-co/daily-react";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

async function fetchDailyRoomUrl(roomId) {
  const res = await fetch(`${SERVER_URL}/daily/room`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Could not start video");
  return body.url;
}

function Tile({ sessionId, screen = false }) {
  const name = useParticipantProperty(sessionId, "user_name");
  const isLocal = useParticipantProperty(sessionId, "local");
  const video = useVideoTrack(sessionId);
  const audio = useAudioTrack(sessionId);
  const label = name || "Guest";
  const showVideo = screen || !video.isOff;

  return (
    <div className={`video-tile${screen ? " screen" : ""}`}>
      {showVideo ? (
        <DailyVideo
          sessionId={sessionId}
          type={screen ? "screenVideo" : "video"}
          automirror={!screen}
          fit={screen ? "contain" : "cover"}
        />
      ) : (
        <div className="video-tile-initial">{label.charAt(0).toUpperCase()}</div>
      )}
      <span className="video-tile-name">
        {screen ? `${label}'s screen` : isLocal ? `${label} (you)` : label}
        {!screen && audio.isOff && " 🔇"}
      </span>
    </div>
  );
}

function ScreenTile({ sessionId }) {
  return <Tile sessionId={sessionId} screen />;
}

function CallView({ onLeft }) {
  const daily = useDaily();
  const localId = useLocalSessionId();
  const participantIds = useParticipantIds();
  const micOff = useAudioTrack(localId).isOff;
  const camOff = useVideoTrack(localId).isOff;
  const { screens, isSharingScreen, startScreenShare, stopScreenShare } = useScreenShare();
  const [notice, setNotice] = useState("");
  const canShareScreen = Daily.supportedBrowser().supportsScreenShare;

  useDailyEvent(
    "camera-error",
    useCallback((ev) => {
      const type = ev?.error?.type;
      if (type === "cam-in-use" || type === "mic-in-use") {
        setNotice("Camera or mic is in use by another app.");
      } else if (type === "not-found") {
        setNotice("No camera or mic found — you can still watch and listen.");
      } else {
        setNotice("Camera or mic is blocked — you can still watch and listen.");
      }
    }, []),
  );
  useDailyEvent("left-meeting", onLeft);

  return (
    <>
      {notice && <p className="video-notice">{notice}</p>}
      <div className={`video-grid${screens.length ? " has-screen" : ""}`}>
        {screens.map((s) => (
          <ScreenTile key={s.screenId} sessionId={s.session_id} />
        ))}
        {participantIds.map((id) => (
          <Tile key={id} sessionId={id} />
        ))}
      </div>
      <DailyAudio />
      <div className="video-controls">
        <button
          type="button"
          className={micOff ? "off" : ""}
          onClick={() => daily.setLocalAudio(micOff)}
        >
          {micOff ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          className={camOff ? "off" : ""}
          onClick={() => daily.setLocalVideo(camOff)}
        >
          {camOff ? "Camera on" : "Camera off"}
        </button>
        {canShareScreen && (
          <button
            type="button"
            className={isSharingScreen ? "active" : ""}
            onClick={isSharingScreen ? stopScreenShare : startScreenShare}
          >
            {isSharingScreen ? "Stop sharing" : "Share screen"}
          </button>
        )}
        <button type="button" className="secondary leave" onClick={() => daily.leave()}>
          Leave call
        </button>
      </div>
    </>
  );
}

export default function VideoPanel({ roomId }) {
  const [callObject, setCallObject] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | joining | joined
  const [error, setError] = useState("");
  const [startMic, setStartMic] = useState(true);
  const [startCam, setStartCam] = useState(true);
  const callRef = useRef(null);

  const teardown = useCallback(() => {
    const call = callRef.current;
    callRef.current = null;
    setCallObject(null);
    setStatus("idle");
    call?.destroy().catch(() => {});
  }, []);

  // Leaving the room (or switching rooms) should also leave the call.
  useEffect(() => () => callRef.current?.destroy().catch(() => {}), [roomId]);

  async function joinCall() {
    setError("");
    setStatus("joining");
    let call;
    try {
      const url = await fetchDailyRoomUrl(roomId);
      call = Daily.createCallObject({ subscribeToTracksAutomatically: true });
      callRef.current = call;
      setCallObject(call);
      await call.join({
        url,
        userName: localStorage.getItem("couchcrew:name") || "Guest",
        startAudioOff: !startMic,
        startVideoOff: !startCam,
      });
      setStatus("joined");
    } catch (err) {
      setError(err.message || "Could not join the call");
      if (call) {
        callRef.current = null;
        call.destroy().catch(() => {});
      }
      setCallObject(null);
      setStatus("idle");
    }
  }

  return (
    <div className="video-panel">
      <h2>Video &amp; Screen Share</h2>
      {callObject && (
        <DailyProvider callObject={callObject}>
          {status === "joined" && <CallView onLeft={teardown} />}
        </DailyProvider>
      )}
      {status !== "joined" && (
        <div className="video-join">
          <p>Join the call to talk, show your camera, or share your screen.</p>
          <label>
            <input
              type="checkbox"
              checked={startMic}
              onChange={(e) => setStartMic(e.target.checked)}
              disabled={status === "joining"}
            />
            Mic on
          </label>
          <label>
            <input
              type="checkbox"
              checked={startCam}
              onChange={(e) => setStartCam(e.target.checked)}
              disabled={status === "joining"}
            />
            Camera on
          </label>
          <button type="button" onClick={joinCall} disabled={status === "joining"}>
            {status === "joining" ? "Connecting… (may take a minute if the server is asleep)" : "Join call"}
          </button>
          {error && <p className="video-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
