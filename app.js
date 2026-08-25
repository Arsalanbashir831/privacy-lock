/* Secretshare: encryption and decryption happen only in this browser. */
const $ = (id) => document.getElementById(id);
const MAX_FILE_SIZE = 150 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const randomCode = (length) => {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
};
const bytesToBase64 = (bytes) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const base64ToBytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const toFragment = (bytes) => bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const fromFragment = (value) => base64ToBytes(value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4));

async function encryptionKey(masterKey, passphrase, salt) {
  if (!passphrase) return crypto.subtle.importKey("raw", masterKey, "AES-GCM", false, ["encrypt", "decrypt"]);
  const passBytes = encoder.encode(passphrase);
  const material = new Uint8Array(masterKey.length + passBytes.length);
  material.set(masterKey);
  material.set(passBytes, masterKey.length);
  const source = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 250_000 }, source,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

function packPayload(meta, content) {
  const header = encoder.encode(JSON.stringify(meta));
  const payload = new Uint8Array(4 + header.length + content.length);
  new DataView(payload.buffer).setUint32(0, header.length);
  payload.set(header, 4);
  payload.set(content, 4 + header.length);
  return payload;
}
function unpackPayload(payload) {
  if (payload.length < 5) throw new Error("Invalid secret payload");
  const headerLength = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(0);
  if (headerLength < 2 || headerLength > payload.length - 4) throw new Error("Invalid secret payload");
  return {
    meta: JSON.parse(decoder.decode(payload.subarray(4, 4 + headerLength))),
    content: payload.subarray(4 + headerLength)
  };
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({ error: "Unexpected server response" }));
  if (!response.ok) throw Object.assign(new Error(data.error || "Request failed"), { status: response.status });
  return data;
}

async function uploadCiphertext(ciphertext, metadata) {
  const response = await fetch("/api/secrets/binary", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Secret-IV": bytesToBase64(metadata.iv),
      "X-Secret-Salt": bytesToBase64(metadata.salt),
      "X-Secret-Passphrase": metadata.requiresPassphrase ? "1" : "0",
      "X-Secret-Expires-At": String(metadata.expiresAt)
    },
    body: ciphertext
  });
  const data = await response.json().catch(() => ({ error: "Unexpected server response" }));
  if (!response.ok) throw new Error(data.error || "Upload failed");
  return data;
}

async function consumeBinarySecret(id, token) {
  const response = await fetch(`/api/secrets/${id}/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consumeToken: token })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Unexpected server response" }));
    throw new Error(data.error || "Could not retrieve the encrypted file");
  }
  return {
    version: 2,
    ciphertext: new Uint8Array(await response.arrayBuffer()),
    iv: response.headers.get("X-Secret-IV"),
    salt: response.headers.get("X-Secret-Salt"),
    requiresPassphrase: response.headers.get("X-Secret-Passphrase") === "1"
  };
}

$("serial").textContent = `${randomCode(4)}-${randomCode(4)}`;
const tabs = [{ tab: $("tab-text"), pane: $("pane-text") }, { tab: $("tab-file"), pane: $("pane-file") }];
let activeTab = "text";
tabs.forEach(({ tab }, index) => tab.addEventListener("click", () => {
  activeTab = index === 0 ? "text" : "file";
  tabs.forEach(({ tab: item, pane }, itemIndex) => {
    const active = index === itemIndex;
    item.classList.toggle("is-active", active);
    item.setAttribute("aria-selected", String(active));
    pane.classList.toggle("is-hidden", !active);
    pane.hidden = !active;
  });
}));

const secret = $("secret");
secret.addEventListener("input", () => { $("charcount").textContent = secret.value.length; });
const drop = $("drop");
const fileInput = $("file");
const dropMain = $("drop-main");
let selectedFile = null;
function showFile(file) {
  if (!file) return;
  selectedFile = file;
  const size = file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`;
  dropMain.textContent = `${file.name} — ${size}`;
}
["dragenter", "dragover"].forEach((event) => drop.addEventListener(event, (ev) => { ev.preventDefault(); drop.classList.add("is-over"); }));
["dragleave", "drop"].forEach((event) => drop.addEventListener(event, (ev) => { ev.preventDefault(); drop.classList.remove("is-over"); }));
drop.addEventListener("drop", (ev) => showFile(ev.dataTransfer?.files?.[0]));
fileInput.addEventListener("change", () => showFile(fileInput.files[0]));

const result = $("result");
const linkEl = $("link");
let shareUrl = "";
$("seal").addEventListener("click", async () => {
  const button = $("seal");
  const status = $("copystatus");
  const text = secret.value;
  const file = selectedFile;
  if ((activeTab === "text" && !text.trim()) || (activeTab === "file" && !file)) {
    result.hidden = false;
    status.textContent = activeTab === "text" ? "Add secret text first." : "Choose a file first.";
    return;
  }
  if (activeTab === "file" && file.size > MAX_FILE_SIZE) {
    result.hidden = false; status.textContent = "The maximum file size is 150 MB."; return;
  }
  button.disabled = true;
  button.textContent = "Encrypting…";
  status.textContent = "";
  try {
    const passphrase = $("passphrase").value;
    const masterKey = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await encryptionKey(masterKey, passphrase, salt);
    const meta = activeTab === "file" ? { type: "file", name: file.name, mime: file.type || "application/octet-stream" } : { type: "text" };
    const content = activeTab === "file" ? new Uint8Array(await file.arrayBuffer()) : encoder.encode(text);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, packPayload(meta, content)));
    const response = await uploadCiphertext(ciphertext, {
      iv, salt, requiresPassphrase: Boolean(passphrase),
      expiresAt: Date.now() + Number($("destroy").value) * 1000
    });
    shareUrl = `${location.origin}/s/${response.id}#${toFragment(masterKey)}`;
    const fragment = document.createElement("span");
    fragment.className = "frag";
    fragment.textContent = `#${toFragment(masterKey)}`;
    linkEl.replaceChildren(document.createTextNode(`${location.origin}/s/${response.id}`), fragment);
    $("stamp").classList.add("is-on");
    $("envelope").classList.add("is-sealed");
    result.hidden = false;
    status.textContent = "Encrypted link ready to share.";
    result.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    result.hidden = false;
    status.textContent = `Could not create the link: ${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = "Seal and create link";
  }
});

$("again").addEventListener("click", () => {
  $("envelope").classList.remove("is-sealed");
  $("stamp").classList.remove("is-on");
  result.hidden = true;
  shareUrl = "";
  linkEl.replaceChildren();
  $("copystatus").textContent = "";
  secret.value = "";
  $("charcount").textContent = "0";
  fileInput.value = "";
  selectedFile = null;
  dropMain.textContent = "Drop a file here, or choose one";
  $("passphrase").value = "";
  $("destroy").selectedIndex = 0;
  activeTab = "text";
  tabs.forEach(({ tab, pane }, index) => {
    const active = index === 0;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    pane.classList.toggle("is-hidden", !active);
    pane.hidden = !active;
  });
  $("serial").textContent = `${randomCode(4)}-${randomCode(4)}`;
  secret.focus();
});
$("copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(shareUrl); $("copystatus").textContent = "Encrypted link copied."; }
  catch {
    const range = document.createRange(); range.selectNodeContents(linkEl);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    $("copystatus").textContent = "Link selected — press Ctrl/Cmd + C.";
  }
});

const states = { closed: $("rec-closed"), open: $("rec-open"), gone: $("rec-gone") };
function showState(name) {
  Object.entries(states).forEach(([key, element]) => {
    const active = key === name;
    element.classList.toggle("is-hidden", !active);
    element.hidden = !active;
  });
}
const recipientMatch = location.pathname.match(/^\/s\/([A-Za-z0-9_-]{20,32})$/);
let claimedSecret = null;
let consumeToken = "";
let secretVersion = 1;
const recipientPassphrase = $("recipient-passphrase");
const recipientPassphraseInput = $("recipient-passphrase-input");
if (recipientMatch) {
  document.body.classList.add("recipient-mode");
  $("recipient-title").textContent = "A secret is waiting for you";
  $("recipient-subtitle").textContent = "It will be permanently deleted when you open it.";
  api(`/api/secrets/${recipientMatch[1]}`).then((info) => {
    consumeToken = info.consumeToken;
    secretVersion = info.version || 1;
    $("rec-line").textContent = `Someone sent you an encrypted secret. It expires ${new Date(info.expiresAt).toLocaleString()}.`;
    recipientPassphrase.hidden = !info.requiresPassphrase;
    recipientPassphraseInput.disabled = !info.requiresPassphrase;
    if (info.requiresPassphrase) recipientPassphraseInput.focus();
  }).catch((error) => { $("gone-message").textContent = error.message; showState("gone"); });
}

$("reveal").addEventListener("click", async () => {
  if (!recipientMatch) {
    document.querySelector("#compose").scrollIntoView({ behavior: "smooth" });
    return;
  }
  const button = $("reveal");
  const passphrase = recipientPassphraseInput.disabled ? "" : recipientPassphraseInput.value;
  if (!recipientPassphrase.hidden && !passphrase) {
    $("recipient-status").textContent = "Enter the passphrase before opening."; return;
  }
  button.disabled = true;
  button.textContent = "Opening…";
  try {
    const fragment = location.hash.slice(1);
    if (!fragment) throw new Error("The decryption key is missing from this link");
    claimedSecret ||= secretVersion === 2
      ? await consumeBinarySecret(recipientMatch[1], consumeToken)
      : await api(`/api/secrets/${recipientMatch[1]}/consume`, {
          method: "POST", body: JSON.stringify({ consumeToken })
        });
    const key = await encryptionKey(fromFragment(fragment), passphrase, base64ToBytes(claimedSecret.salt));
    const plaintext = new Uint8Array(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(claimedSecret.iv) }, key,
      claimedSecret.version === 2 ? claimedSecret.ciphertext : base64ToBytes(claimedSecret.ciphertext)
    ));
    const { meta, content } = unpackPayload(plaintext);
    history.replaceState(null, "", location.pathname);
    if (meta.type === "file") {
      const url = URL.createObjectURL(new Blob([content], { type: meta.mime || "application/octet-stream" }));
      $("rec-secret").hidden = true;
      $("download-secret").hidden = false;
      $("download-secret").href = url;
      $("download-secret").download = String(meta.name || "secret-file").replace(/[\\/\0]/g, "_");
      $("download-secret").textContent = `Download ${meta.name || "encrypted file"}`;
    } else {
      $("rec-secret").hidden = false;
      $("rec-secret").textContent = decoder.decode(content);
    }
    showState("open");
  } catch (error) {
    if (error.name === "OperationError" && claimedSecret) {
      $("recipient-status").textContent = "Decryption failed. Check the passphrase and try again without refreshing this page.";
      recipientPassphraseInput.focus();
    } else {
      $("gone-message").textContent = error.message;
      showState("gone");
    }
  } finally {
    button.disabled = false;
    button.textContent = "Open and destroy";
  }
});
