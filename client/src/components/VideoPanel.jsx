// Job 2 (Audio/Video/Screen Share). A small peer-to-peer WebRTC call: every
// person in the call connects directly to every other person (a "mesh", fine
// for a handful of people). Our Socket.IO server only relays the setup
// messages (call:*, rtc:signal) — no third-party video service, no accounts.
// History: Daily.co (needed a card) -> Jitsi (anonymous rooms got cut off)
// -> this. See LOG.md.
import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";

// Browsers behind different networks usually need a TURN relay to reach each
// other. The server hands out short-lived relay credentials (GET /ice); if
// that fails we fall back to public STUN, which only works on friendly
// networks. VITE_ICE_SERVERS (a JSON array of RTCIceServer objects) overrides
// both, for testing.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const FALLBACK_ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

async function loadIceServers() {
  try {
    const override = JSON.parse(import.meta.env.VITE_ICE_SERVERS || "null");
    if (Array.isArray(override) && override.length) return override;
  } catch {
    // ignore a malformed override
  }
  try {
    const res = await fetch(`${SERVER_URL}/ice`, { signal: AbortSignal.timeout(5000) });
    const body = await res.json();
    if (Array.isArray(body.iceServers) && body.iceServers.length) return body.iceServers;
  } catch {
    // server unreachable or slow: use the fallback
  }
  return FALLBACK_ICE;
}

// Gets mic and/or camera, degrading gracefully: returns whatever tracks it
// could get plus a note for anything that was refused or missing.
async function getLocalTracks(wantMic, wantCam) {
  const tracks = [];
  const failed = [];
  async function tryGet(constraints, label) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      tracks.push(...stream.getTracks());
      return true;
    } catch {
      if (label) failed.push(label);
      return false;
    }
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { tracks, notes: ["This browser can't use a mic or camera here."] };
  }
  if (wantMic && wantCam) {
    const both = await tryGet({ audio: true, video: { facingMode: "user" } });
    if (!both) {
      await tryGet({ audio: true }, "mic");
      await tryGet({ video: { facingMode: "user" } }, "camera");
    }
  } else if (wantMic) {
    await tryGet({ audio: true }, "mic");
  } else if (wantCam) {
    await tryGet({ video: { facingMode: "user" } }, "camera");
  }
  return {
    tracks,
    notes: failed.length
      ? [`Couldn't use your ${failed.join(" or ")} (blocked or not found) — you can still watch and listen.`]
      : [],
  };
}

// Puts `track` on a connection: reuses a spare transceiver of the same kind
// (one that has had its track removed or is receive-only) so we don't pile up
// extra media sections, otherwise adds a new one. Changing a transceiver's
// direction triggers a renegotiation, which the perfect-negotiation code in
// the component handles.
function attachTrack(pc, track, stream) {
  const spare = pc
    .getTransceivers()
    .find(
      (t) =>
        t.receiver.track.kind === track.kind &&
        !t.sender.track &&
        t.currentDirection !== "stopped",
    );
  if (spare) {
    spare.sender.replaceTrack(track);
    spare.sender.setStreams?.(stream);
    spare.direction = "sendrecv";
    return spare.sender;
  }
  return pc.addTrack(track, stream);
}

function Tile({ stream, name, muted = false, mirror = false, videoOn, screen = false, status, micOff }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
  }, [stream]);
  const showVideo = screen || videoOn;
  return (
    <div className={`video-tile${screen ? " screen" : ""}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`${mirror ? "mirror" : ""}${showVideo ? "" : " hidden"}`}
      />
      {!showVideo && <div className="video-tile-initial">{(name || "?").charAt(0).toUpperCase()}</div>}
      <span className="video-tile-name">
        {screen ? `${name}'s screen` : name}
        {micOff ? " 🔇" : ""}
        {status ? ` · ${status}` : ""}
      </span>
    </div>
  );
}

export default function VideoPanel({ roomId }) {
  const [status, setStatus] = useState("idle"); // idle | joining | joined
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [startMic, setStartMic] = useState(true);
  const [startCam, setStartCam] = useState(true);
  const [local, setLocal] = useState({ stream: null, mic: false, cam: false, screen: null });
  const [peerList, setPeerList] = useState([]);

  // All the live call machinery lives in refs so socket and WebRTC callbacks
  // always see current state; React state above is just what gets rendered.
  const callRef = useRef(null);
  const onSignalRef = useRef(null); // socket.off needs the exact function registered
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      endCall(false);
    };
  }, [roomId]);

  function publish() {
    const call = callRef.current;
    if (!call || !mountedRef.current) return;
    setPeerList(
      Array.from(call.peers.values()).map((p) => {
        const streams = Array.from(p.streams.values());
        return {
          id: p.id,
          name: p.name,
          screen: streams.find((s) => s.id === p.screenId) || null,
          cam: streams.find((s) => s.id !== p.screenId) || null,
          camOn: p.remoteState.video,
          micOn: p.remoteState.audio,
          connState: p.pc.connectionState,
        };
      }),
    );
  }

  function publishLocal() {
    const call = callRef.current;
    if (!call || !mountedRef.current) return;
    const audio = call.localStream.getAudioTracks()[0];
    setLocal({
      stream: call.localStream,
      mic: !!audio && audio.enabled,
      cam: call.localStream.getVideoTracks().length > 0,
      screen: call.screenStream,
    });
  }

  function signal(to, data) {
    socket.emit("rtc:signal", { roomId, to, data });
  }

  function sendState(peer) {
    const call = callRef.current;
    if (!call) return;
    const audio = call.localStream.getAudioTracks()[0];
    signal(peer.id, {
      state: { audio: !!audio && audio.enabled, video: call.localStream.getVideoTracks().length > 0 },
      screen: call.screenStream ? call.screenStream.id : null,
    });
  }

  function broadcastState() {
    callRef.current?.peers.forEach(sendState);
  }

  function closePeer(id) {
    const call = callRef.current;
    const peer = call?.peers.get(id);
    if (!peer) return;
    peer.pc.onnegotiationneeded = null;
    peer.pc.close();
    call.peers.delete(id);
  }

  function createPeer(id, name) {
    const call = callRef.current;
    closePeer(id);
    const pc = new RTCPeerConnection({ iceServers: call.iceServers });
    const peer = {
      id,
      name,
      pc,
      // Perfect negotiation: if both sides send an offer at once, the "polite"
      // one backs down. Any fixed rule that picks opposite sides works.
      polite: socket.id > id,
      makingOffer: false,
      ignoreOffer: false,
      attached: false,
      streams: new Map(),
      screenId: null,
      screenSenders: [],
      remoteState: { audio: true, video: true },
      queue: Promise.resolve(),
    };
    call.peers.set(id, peer);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) signal(id, { candidate });
    };
    pc.ontrack = ({ streams: [stream] }) => {
      if (!stream) return;
      peer.streams.set(stream.id, stream);
      stream.onremovetrack = () => {
        if (stream.getTracks().length === 0) peer.streams.delete(stream.id);
        publish();
      };
      publish();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") sendState(peer);
      if (pc.connectionState === "failed") pc.restartIce();
      publish();
    };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        signal(id, { description: pc.localDescription });
      } catch (err) {
        console.error("offer failed", err);
      } finally {
        peer.makingOffer = false;
      }
    };
    return peer;
  }

  function attachScreen(peer) {
    const call = callRef.current;
    if (!call.screenStream || peer.screenSenders.length) return;
    peer.screenSenders = call.screenStream.getTracks().map((t) => peer.pc.addTrack(t, call.screenStream));
  }

  // The person joining starts every connection: one audio and one video
  // section each, sending our track when we have it and receive-only otherwise
  // (so people with no camera or mic can still watch and listen).
  function addInitialMedia(peer) {
    const call = callRef.current;
    // Our media is already on this connection, so don't re-attach it when the
    // other side later sends an offer (that would add tracks twice and throw).
    peer.attached = true;
    for (const kind of ["audio", "video"]) {
      const track = call.localStream.getTracks().find((t) => t.kind === kind);
      if (track) {
        peer.pc.addTransceiver(track, { direction: "sendrecv", streams: [call.localStream] });
      } else {
        peer.pc.addTransceiver(kind, { direction: "recvonly" });
      }
    }
    attachScreen(peer);
  }

  // The people already in the call answer: line our own tracks up with the
  // media sections the joiner offered.
  function attachLocalMedia(peer) {
    const call = callRef.current;
    call.localStream.getTracks().forEach((t) => attachTrack(peer.pc, t, call.localStream));
    attachScreen(peer);
  }

  async function handleSignal(from, data) {
    const peer = callRef.current?.peers.get(from);
    if (!peer) return;
    const { pc } = peer;
    if (data.description) {
      const offerCollision =
        data.description.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
      peer.ignoreOffer = !peer.polite && offerCollision;
      if (peer.ignoreOffer) return;
      await pc.setRemoteDescription(data.description);
      if (data.description.type === "offer") {
        if (!peer.attached) {
          peer.attached = true;
          attachLocalMedia(peer);
        }
        await pc.setLocalDescription();
        signal(from, { description: pc.localDescription });
        sendState(peer);
      }
    } else if (data.candidate) {
      try {
        await pc.addIceCandidate(data.candidate);
      } catch (err) {
        if (!peer.ignoreOffer) console.warn("ICE candidate failed", err);
      }
    }
    if (data.state) peer.remoteState = data.state;
    if ("screen" in data) peer.screenId = data.screen;
    if (data.state || "screen" in data) publish();
  }

  function onSignal({ from, data }) {
    const peer = callRef.current?.peers.get(from);
    if (!peer) return;
    // One message at a time per person, so offers and answers can't interleave.
    peer.queue = peer.queue.then(() => handleSignal(from, data)).catch((e) => console.error(e));
  }

  function endCall(updateUi = true) {
    const call = callRef.current;
    if (!call) return;
    callRef.current = null;
    socket.emit("call:leave", { roomId });
    socket.off("call:peers", call.handlers.peers);
    socket.off("call:peer-joined", call.handlers.joined);
    socket.off("call:peer-left", call.handlers.left);
    socket.off("rtc:signal", onSignalRef.current);
    socket.off("disconnect", call.handlers.disconnect);
    call.peers.forEach((p) => {
      p.pc.onnegotiationneeded = null;
      p.pc.close();
    });
    call.localStream.getTracks().forEach((t) => t.stop());
    call.screenStream?.getTracks().forEach((t) => t.stop());
    if (updateUi && mountedRef.current) {
      setStatus("idle");
      setPeerList([]);
      setLocal({ stream: null, mic: false, cam: false, screen: null });
    }
  }

  async function joinCall() {
    setError("");
    setNotice("");
    if (!socket.connected) {
      setError("Not connected to the room yet — wait a moment and try again.");
      return;
    }
    setStatus("joining");
    const [iceServers, { tracks, notes }] = await Promise.all([
      loadIceServers(),
      getLocalTracks(startMic, startCam),
    ]);
    if (!mountedRef.current) {
      tracks.forEach((t) => t.stop());
      return;
    }
    if (notes.length) setNotice(notes[0]);

    const call = {
      iceServers,
      localStream: new MediaStream(tracks),
      screenStream: null,
      peers: new Map(),
      handlers: {},
    };
    callRef.current = call;

    call.handlers.peers = ({ peers }) => {
      peers.forEach(({ id, name }) => addInitialMedia(createPeer(id, name)));
      publish();
    };
    call.handlers.joined = ({ id, name }) => {
      createPeer(id, name);
      publish();
    };
    call.handlers.left = ({ id }) => {
      closePeer(id);
      publish();
    };
    call.handlers.disconnect = () => {
      endCall();
      setError("Lost connection to the room, so the call ended. Press Join call to rejoin.");
    };
    onSignalRef.current = onSignal;

    socket.on("call:peers", call.handlers.peers);
    socket.on("call:peer-joined", call.handlers.joined);
    socket.on("call:peer-left", call.handlers.left);
    socket.on("rtc:signal", onSignalRef.current);
    socket.on("disconnect", call.handlers.disconnect);

    socket.emit("call:join", { roomId });
    setStatus("joined");
    publishLocal();
  }

  async function addTracksFromDevice(wantMic, wantCam) {
    const call = callRef.current;
    const { tracks, notes } = await getLocalTracks(wantMic, wantCam);
    if (!callRef.current) {
      tracks.forEach((t) => t.stop());
      return;
    }
    if (notes.length) setNotice(notes[0]);
    tracks.forEach((t) => {
      call.localStream.addTrack(t);
      call.peers.forEach((p) => attachTrack(p.pc, t, call.localStream));
    });
  }

  async function toggleMic() {
    const call = callRef.current;
    if (!call) return;
    const audio = call.localStream.getAudioTracks()[0];
    if (audio) audio.enabled = !audio.enabled;
    else await addTracksFromDevice(true, false);
    publishLocal();
    broadcastState();
  }

  // Turning the camera off stops it (so the camera light goes out) instead of
  // just sending black; turning it on asks for the camera again.
  async function toggleCam() {
    const call = callRef.current;
    if (!call) return;
    const video = call.localStream.getVideoTracks()[0];
    if (video) {
      video.stop();
      call.localStream.removeTrack(video);
      call.peers.forEach((p) => {
        p.pc
          .getSenders()
          .find((s) => s.track === video)
          ?.replaceTrack(null);
      });
    } else {
      await addTracksFromDevice(false, true);
    }
    publishLocal();
    broadcastState();
  }

  function stopScreen() {
    const call = callRef.current;
    if (!call?.screenStream) return;
    call.screenStream.getTracks().forEach((t) => t.stop());
    call.peers.forEach((p) => {
      p.screenSenders.forEach((s) => {
        try {
          p.pc.removeTrack(s);
        } catch {
          // connection already closed
        }
      });
      p.screenSenders = [];
    });
    call.screenStream = null;
    publishLocal();
    broadcastState();
  }

  async function toggleScreen() {
    const call = callRef.current;
    if (!call) return;
    if (call.screenStream) return stopScreen();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      call.screenStream = stream;
      stream.getVideoTracks()[0].onended = stopScreen;
      call.peers.forEach(attachScreen);
      publishLocal();
      broadcastState();
    } catch {
      // The person closed the picker, or the browser can't share a screen.
    }
  }

  const myName = localStorage.getItem("couchcrew:name") || "You";
  const canShareScreen = !!navigator.mediaDevices?.getDisplayMedia;
  const failed = peerList.some((p) => p.connState === "failed");
  const someoneSharing = !!local.screen || peerList.some((p) => p.screen);

  return (
    <div className="video-panel">
      <h2>Video &amp; Screen Share</h2>
      {status !== "joined" ? (
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
            {status === "joining" ? "Joining…" : "Join call"}
          </button>
          {error && <p className="video-error">{error}</p>}
        </div>
      ) : (
        <>
          {notice && <p className="video-notice">{notice}</p>}
          {failed && (
            <p className="video-notice">
              Can&apos;t connect directly to someone — one of your networks may block calls like this.
            </p>
          )}
          <div className={`video-grid${someoneSharing ? " has-screen" : ""}`}>
            {local.screen && <Tile stream={local.screen} name={myName} muted videoOn screen />}
            {peerList
              .filter((p) => p.screen)
              .map((p) => (
                <Tile key={`${p.id}-screen`} stream={p.screen} name={p.name} videoOn screen />
              ))}
            <Tile stream={local.stream} name={`${myName} (you)`} muted mirror videoOn={local.cam} micOff={!local.mic} />
            {peerList.map((p) => (
              <Tile
                key={p.id}
                stream={p.cam}
                name={p.name}
                videoOn={p.camOn && !!p.cam?.getVideoTracks().length}
                micOff={!p.micOn}
                status={
                  p.connState === "connected" ? "" : p.connState === "failed" ? "can't connect" : "connecting…"
                }
              />
            ))}
          </div>
          <p className="video-diag-count">In the call: {peerList.length + 1}</p>
          <div className="video-controls">
            <button type="button" className={local.mic ? "" : "off"} onClick={toggleMic}>
              {local.mic ? "Mute" : "Unmute"}
            </button>
            <button type="button" className={local.cam ? "" : "off"} onClick={toggleCam}>
              {local.cam ? "Camera off" : "Camera on"}
            </button>
            {canShareScreen && (
              <button type="button" className={local.screen ? "active" : ""} onClick={toggleScreen}>
                {local.screen ? "Stop sharing" : "Share screen"}
              </button>
            )}
            <button type="button" className="secondary leave" onClick={() => endCall()}>
              Leave call
            </button>
          </div>
        </>
      )}
    </div>
  );
}
