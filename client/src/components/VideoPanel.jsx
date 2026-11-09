// Job 2 (Audio/Video/Screen Share). A small peer-to-peer WebRTC call: every
// person in the call connects directly to every other person (a "mesh", fine
// for a handful of people). Our Socket.IO server only relays the setup
// messages (call:*, rtc:signal) — no third-party video service, no accounts.
// History: Daily.co (needed a card) -> Jitsi (anonymous rooms got cut off)
// -> this. See LOG.md.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { socket } from "../lib/socket";
import { getDevicePrefs, setDevicePref } from "../lib/devicePrefs";

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
  // Room settings drawer lets someone pick a non-default mic/camera; falls
  // back to the browser's own default (and to facingMode-only for camera)
  // whenever no preference is set or the preferred device is gone.
  const { micId, camId } = getDevicePrefs();
  const audioConstraint = micId ? { deviceId: { exact: micId } } : true;
  const videoConstraint = camId ? { deviceId: { exact: camId } } : { facingMode: "user" };

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
    const both = await tryGet({ audio: audioConstraint, video: videoConstraint });
    if (!both) {
      await tryGet({ audio: audioConstraint }, "mic");
      await tryGet({ video: videoConstraint }, "camera");
    }
  } else if (wantMic) {
    await tryGet({ audio: audioConstraint }, "mic");
  } else if (wantCam) {
    await tryGet({ video: videoConstraint }, "camera");
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

// Speaker choice is ours (the settings drawer only covers mic and camera), and
// only browsers that can route audio to a chosen output (setSinkId) get it.
const SPEAKER_KEY = "couchcrew:speakerDeviceId";
const CAN_PICK_SPEAKER = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

function loadSpeakerPref() {
  try {
    return localStorage.getItem(SPEAKER_KEY) || "";
  } catch {
    return "";
  }
}

let audioCtx;
function getAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

// How loud a stream is right now, as 0-5, for the little meter on each tile.
// Works on remote streams too, so you can see whose mic is making noise even
// after you've muted them on your end.
function useAudioLevel(stream, audioKey) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream || !stream.getAudioTracks().length) return undefined;
    const ctx = getAudioContext();
    if (!ctx) return undefined;
    const source = ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let last = 0;
    // setInterval, not requestAnimationFrame, so it keeps running in a
    // background tab.
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      const next = Math.min(5, Math.round(Math.sqrt(sum / data.length) * 20));
      if (next !== last) {
        last = next;
        setLevel(next);
      }
    }, 100);
    return () => {
      clearInterval(timer);
      source.disconnect();
      setLevel(0);
    };
  }, [stream, audioKey]);
  return level;
}

// `listen` is only set on other people's tiles: { muted, volume } is how *you*
// hear them, and never affects what anyone else hears.
function Tile({
  stream,
  name,
  muted = false,
  mirror = false,
  videoOn,
  screen = false,
  status,
  micOff,
  sinkId,
  listen,
  onListenChange,
  showMeter = false,
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
  }, [stream]);
  const listenMuted = !!listen?.muted;
  const listenVolume = listen ? listen.volume : 1;
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = muted || listenMuted;
    v.volume = listenVolume;
  }, [muted, listenMuted, listenVolume]);
  useEffect(() => {
    const v = ref.current;
    if (v && sinkId !== undefined && v.setSinkId) v.setSinkId(sinkId || "").catch(() => {});
  }, [sinkId, stream]);

  const audioKey = stream
    ? stream
        .getAudioTracks()
        .map((t) => t.id)
        .join(",")
    : "";
  const level = useAudioLevel(showMeter ? stream : null, audioKey);
  const showVideo = screen || videoOn;
  return (
    <div className={`video-tile${screen ? " screen" : ""}${level >= 2 ? " speaking" : ""}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        className={`${mirror ? "mirror" : ""}${showVideo ? "" : " hidden"}`}
      />
      {!showVideo && <div className="video-tile-initial">{(name || "?").charAt(0).toUpperCase()}</div>}
      {listen && (
        <div className="video-tile-listen">
          <button
            type="button"
            className="secondary"
            aria-label={`${listen.muted ? "Unmute" : "Mute"} ${name} for you`}
            title={listen.muted ? "Unmute for you" : "Mute for you"}
            onClick={() => onListenChange({ muted: !listen.muted })}
          >
            {listen.muted ? "🔇" : "🔊"}
          </button>
          {!listen.muted && (
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(listen.volume * 100)}
              aria-label={`${name} volume`}
              onChange={(e) => onListenChange({ volume: Number(e.target.value) / 100 })}
            />
          )}
        </div>
      )}
      {showMeter && !screen && (
        <span className="video-tile-meter" aria-hidden="true">
          <span style={{ width: `${level * 20}%` }} />
        </span>
      )}
      <span className="video-tile-name">
        {screen ? `${name}'s screen` : name}
        {micOff ? " 🔇" : ""}
        {listen?.muted ? " (muted by you)" : ""}
        {status ? ` · ${status}` : ""}
      </span>
    </div>
  );
}

// Mic / camera / speaker pickers for use during a call. Mic and camera switch
// live; the speaker applies to everyone's audio on this device.
function DevicePanel({ micId, camId, speakerId, onPick }) {
  const [devices, setDevices] = useState([]);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (alive) setDevices(list);
      } catch {
        // leave the lists empty
      }
    }
    load();
    navigator.mediaDevices?.addEventListener?.("devicechange", load);
    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener?.("devicechange", load);
    };
  }, []);

  function select(label, kind, pickKind, value, fallback) {
    const list = devices.filter((d) => d.kind === kind);
    return (
      <>
        <label htmlFor={`call-${pickKind}`}>{label}</label>
        <select id={`call-${pickKind}`} value={value} onChange={(e) => onPick(pickKind, e.target.value)}>
          <option value="">System default</option>
          {list.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || fallback}
            </option>
          ))}
        </select>
      </>
    );
  }

  return (
    <div className="device-settings call-devices">
      {select("Microphone", "audioinput", "mic", micId, "Microphone")}
      {select("Camera", "videoinput", "cam", camId, "Camera")}
      {CAN_PICK_SPEAKER && select("Speaker", "audiooutput", "speaker", speakerId, "Speaker")}
    </div>
  );
}

// forwardRef so WatchPlayer's "Screen Share" option (see RoomView.jsx) can
// trigger a share directly - including joining the call silently first,
// with no mic/cam, if nobody's pressed "Join call" yet. Screen sharing
// shouldn't require turning your own camera/mic on first.
const VideoPanel = forwardRef(function VideoPanel({ roomId }, ref) {
  const [status, setStatus] = useState("idle"); // idle | joining | joined
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [startMic, setStartMic] = useState(true);
  const [startCam, setStartCam] = useState(true);
  const [local, setLocal] = useState({ stream: null, mic: false, cam: false, screen: null, micId: "", camId: "" });
  const [peerList, setPeerList] = useState([]);
  const [showDevices, setShowDevices] = useState(false);
  const [speakerId, setSpeakerId] = useState(loadSpeakerPref);
  // How I hear each other person (mute / volume), by their socket id.
  const [listenPrefs, setListenPrefs] = useState({});

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

  // Exposed to WatchPlayer (via RoomView) so "Screen Share" works as a
  // standalone option there, not just a button buried inside an already-
  // joined call.
  useImperativeHandle(ref, () => ({
    shareScreen: async () => {
      if (!callRef.current) await joinCall(false, false);
      await toggleScreen();
    },
  }));

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
    const video = call.localStream.getVideoTracks()[0];
    setLocal({
      stream: call.localStream,
      mic: !!audio && audio.enabled,
      cam: !!video,
      screen: call.screenStream,
      micId: audio?.getSettings().deviceId || "",
      camId: video?.getSettings().deviceId || "",
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
      setListenPrefs({});
      setShowDevices(false);
      setLocal({ stream: null, mic: false, cam: false, screen: null, micId: "", camId: "" });
    }
  }

  async function joinCall(wantMic = startMic, wantCam = startCam) {
    setError("");
    setNotice("");
    if (!socket.connected) {
      setError("Not connected to the room yet — wait a moment and try again.");
      return;
    }
    setStatus("joining");
    const [iceServers, { tracks, notes }] = await Promise.all([
      loadIceServers(),
      getLocalTracks(wantMic, wantCam),
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

  // Switch mic or camera without leaving the call: swap the live track on every
  // connection (no renegotiation needed). If that device isn't on right now the
  // choice is just saved for the next time it is.
  async function pickDevice(kind, deviceId) {
    if (kind === "speaker") {
      setSpeakerId(deviceId);
      try {
        localStorage.setItem(SPEAKER_KEY, deviceId);
      } catch {
        // just a saved preference
      }
      return;
    }
    setDevicePref(kind, deviceId);
    const call = callRef.current;
    if (!call) return;
    const trackKind = kind === "mic" ? "audio" : "video";
    const old = call.localStream.getTracks().find((t) => t.kind === trackKind);
    if (!old) return;
    try {
      const constraint = deviceId
        ? { deviceId: { exact: deviceId } }
        : kind === "mic"
          ? true
          : { facingMode: "user" };
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "mic" ? { audio: constraint } : { video: constraint },
      );
      const fresh = stream.getTracks()[0];
      if (!callRef.current) {
        fresh.stop();
        return;
      }
      fresh.enabled = old.enabled;
      call.peers.forEach((p) => {
        p.pc
          .getSenders()
          .find((s) => s.track === old)
          ?.replaceTrack(fresh);
      });
      call.localStream.removeTrack(old);
      old.stop();
      call.localStream.addTrack(fresh);
      publishLocal();
    } catch {
      setNotice(`Couldn't switch your ${kind === "mic" ? "microphone" : "camera"}.`);
    }
  }

  function listenFor(id) {
    return { muted: false, volume: 1, ...listenPrefs[id] };
  }

  function changeListen(id, patch) {
    setListenPrefs((prev) => ({ ...prev, [id]: { muted: false, volume: 1, ...prev[id], ...patch } }));
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
                <Tile
                  key={`${p.id}-screen`}
                  stream={p.screen}
                  name={p.name}
                  videoOn
                  screen
                  sinkId={speakerId}
                  listen={listenFor(p.id)}
                  onListenChange={(patch) => changeListen(p.id, patch)}
                />
              ))}
            <Tile
              stream={local.stream}
              name={`${myName} (you)`}
              muted
              mirror
              videoOn={local.cam}
              micOff={!local.mic}
              showMeter
            />
            {peerList.map((p) => (
              <Tile
                key={p.id}
                stream={p.cam}
                name={p.name}
                videoOn={p.camOn && !!p.cam?.getVideoTracks().length}
                micOff={!p.micOn}
                showMeter
                sinkId={speakerId}
                listen={listenFor(p.id)}
                onListenChange={(patch) => changeListen(p.id, patch)}
                status={
                  p.connState === "connected" ? "" : p.connState === "failed" ? "can't connect" : "connecting…"
                }
              />
            ))}
          </div>
          <p className="video-diag-count">In the call: {peerList.length + 1}</p>
          {showDevices && (
            <DevicePanel micId={local.micId} camId={local.camId} speakerId={speakerId} onPick={pickDevice} />
          )}
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
            <button type="button" className="secondary" onClick={() => setShowDevices((v) => !v)}>
              Devices
            </button>
            <button type="button" className="secondary leave" onClick={() => endCall()}>
              Leave call
            </button>
          </div>
        </>
      )}
    </div>
  );
});

export default VideoPanel;
