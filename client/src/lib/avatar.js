// Profile picture storage + processing. Avatars are kept as small JPEG data
// URLs (resized client-side) rather than uploaded anywhere - no server
// storage or accounts needed, consistent with the rest of the app, and it
// keeps the string small enough to broadcast over the socket on every
// presence update (see MAX_AVATAR_LENGTH in server/index.js).
const KEY = "couchcrew:avatar";
const SIZE = 128;

export function getSavedAvatar() {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function saveAvatar(dataUrl) {
  try {
    if (dataUrl) localStorage.setItem(KEY, dataUrl);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable (private browsing, etc.) — the picture
    // still works for the current session, it just won't be remembered.
  }
}

// Takes a File from <input type="file"> (gallery or camera capture) and
// returns a square, downscaled JPEG data URL - a raw phone photo can be
// several megabytes, far too big to store or send around as-is.
export function processAvatarFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("That doesn't look like an image."));
      return;
    }
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      img.onerror = () => reject(new Error("Couldn't read that image."));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          SIZE,
          SIZE
        );
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
