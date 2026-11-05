import { useEffect, useState } from "react";
import { getDevicePrefs, setDevicePref } from "../lib/devicePrefs";

// Lets someone pick which mic/camera CouchCrew uses instead of always
// grabbing the browser's default — read by VideoPanel (Job 2) when it asks
// for media. Device labels are blank until a permission has been granted at
// least once in this browser; requesting a throwaway stream here (and
// stopping it immediately) is enough to unlock them for the dropdowns below.
export default function MediaDeviceSettings() {
  const [devices, setDevices] = useState([]);
  const [prefs, setPrefs] = useState(getDevicePrefs);
  const [needsPermission, setNeedsPermission] = useState(false);

  async function loadDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(list);
    setNeedsPermission(list.some((d) => d.kind.startsWith("audio") || d.kind.startsWith("video")) && list.every((d) => !d.label));
  }

  useEffect(() => {
    loadDevices();
  }, []);

  async function grantPermission() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      // Denied or no device — the dropdowns just stay unlabeled.
    }
    loadDevices();
  }

  function choose(kind, deviceId) {
    setDevicePref(kind, deviceId);
    setPrefs(getDevicePrefs());
  }

  const mics = devices.filter((d) => d.kind === "audioinput");
  const cams = devices.filter((d) => d.kind === "videoinput");

  return (
    <div className="device-settings">
      {needsPermission && (
        <button type="button" className="secondary" onClick={grantPermission}>
          Allow mic/camera access to name your devices
        </button>
      )}
      <label htmlFor="mic-select">Microphone</label>
      <select id="mic-select" value={prefs.micId} onChange={(e) => choose("mic", e.target.value)}>
        <option value="">System default</option>
        {mics.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || "Microphone"}
          </option>
        ))}
      </select>
      <label htmlFor="cam-select">Camera</label>
      <select id="cam-select" value={prefs.camId} onChange={(e) => choose("cam", e.target.value)}>
        <option value="">System default</option>
        {cams.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || "Camera"}
          </option>
        ))}
      </select>
      <p className="room-tag">Takes effect next time you join the call.</p>
    </div>
  );
}
