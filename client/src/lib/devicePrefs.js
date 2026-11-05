// Preferred mic/camera device ids, set from the room settings drawer and
// read by VideoPanel when it asks for media. Stored locally (per browser,
// not per room) since it's a "this is my laptop's webcam" kind of setting.
const MIC_KEY = "couchcrew:micDeviceId";
const CAM_KEY = "couchcrew:camDeviceId";

export function getDevicePrefs() {
  try {
    return { micId: localStorage.getItem(MIC_KEY) || "", camId: localStorage.getItem(CAM_KEY) || "" };
  } catch {
    return { micId: "", camId: "" };
  }
}

export function setDevicePref(kind, deviceId) {
  const key = kind === "mic" ? MIC_KEY : CAM_KEY;
  try {
    if (deviceId) localStorage.setItem(key, deviceId);
    else localStorage.removeItem(key);
  } catch {
    // ignore — just a saved preference
  }
}
