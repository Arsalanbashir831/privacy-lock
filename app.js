/* Privacy Lock — front-end behaviour.
   No crypto here: this is the interface layer. In production the note is
   encrypted in the browser and only the ciphertext is POSTed; the key is
   appended to the URL fragment and never sent. */

const $ = (id) => document.getElementById(id);

/* ── serial number on the draft ─────────────────────────── */
const rand = (n) => Array.from({ length: n }, () =>
  "0123456789ABCDEFGHJKMNPQRSTVWXYZ"[Math.floor(Math.random() * 32)]).join("");

$("serial").textContent = `${rand(4)}-${rand(4)}`;

/* ── tabs ───────────────────────────────────────────────── */
const tabs = [
  { tab: $("tab-text"), pane: $("pane-text") },
  { tab: $("tab-file"), pane: $("pane-file") },
];

tabs.forEach(({ tab }, i) => {
  tab.addEventListener("click", () => {
    tabs.forEach(({ tab: t, pane: p }, j) => {
      const on = i === j;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
      p.classList.toggle("is-hidden", !on);
      p.hidden = !on;
    });
  });
});

/* ── character count ────────────────────────────────────── */
const secret = $("secret");
secret.addEventListener("input", () => {
  $("charcount").textContent = secret.value.length;
});

/* ── drop zone ──────────────────────────────────────────── */
const drop = $("drop");
const fileInput = $("file");
const dropMain = $("drop-main");

const showFile = (file) => {
  if (!file) return;
  const kb = file.size < 1024 * 1024
    ? `${Math.max(1, Math.round(file.size / 1024))} KB`
    : `${(file.size / 1024 / 1024).toFixed(1)} MB`;
  dropMain.textContent = `${file.name} — ${kb}`;
};

["dragenter", "dragover"].forEach((e) =>
  drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add("is-over"); }));

["dragleave", "drop"].forEach((e) =>
  drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove("is-over"); }));

drop.addEventListener("drop", (ev) => showFile(ev.dataTransfer?.files?.[0]));
fileInput.addEventListener("change", () => showFile(fileInput.files[0]));

/* ── seal ───────────────────────────────────────────────── */
const envelope = $("envelope");
const result = $("result");
const linkEl = $("link");
let sealedSecret = "";

$("seal").addEventListener("click", () => {
  const file = fileInput.files[0];
  const text = secret.value.trim();

  if (!text && !file) {
    secret.focus();
    $("copystatus").textContent = "Add a secret or a file first.";
    result.hidden = false;
    return;
  }

  sealedSecret = text || `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB) — download ready`;

  const id = rand(6).toLowerCase();
  const key = rand(30);
  linkEl.innerHTML =
    `https://privacylock.io/note/${id}<span class="frag">#${key}</span>`;

  $("stamp").classList.add("is-on");
  envelope.classList.add("is-sealed");
  result.hidden = false;
  $("copystatus").textContent = "";
  result.scrollIntoView({ behavior: "smooth", block: "center" });
});

$("again").addEventListener("click", () => {
  envelope.classList.remove("is-sealed");
  $("stamp").classList.remove("is-on");
  result.hidden = true;
  secret.value = "";
  $("charcount").textContent = "0";
  fileInput.value = "";
  dropMain.textContent = "Drop a file here, or choose one";
  $("serial").textContent = `${rand(4)}-${rand(4)}`;
  secret.focus();
});

/* ── copy ───────────────────────────────────────────────── */
$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(linkEl.textContent);
    $("copystatus").textContent = "Copied — including the key after the #";
  } catch {
    const r = document.createRange();
    r.selectNodeContents(linkEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    $("copystatus").textContent = "Link selected — press Ctrl/Cmd + C";
  }
});

/* ── recipient preview ──────────────────────────────────── */
const states = { closed: $("rec-closed"), open: $("rec-open"), gone: $("rec-gone") };

const showState = (name) => {
  Object.entries(states).forEach(([key, el]) => {
    const on = key === name;
    el.classList.toggle("is-hidden", !on);
    el.hidden = !on;
    if (on) {
      el.classList.remove("is-entering");
      void el.offsetWidth;
      el.classList.add("is-entering");
    }
  });
};

$("reveal").addEventListener("click", () => {
  $("rec-secret").textContent =
    sealedSecret || 'DATABASE_URL="postgres://admin:super_secret_pass_2026@db.internal:5432/prod"';
  showState("open");
  setTimeout(() => showState("gone"), 6000);
});

[$("rewind"), $("rewind2")].forEach((b) =>
  b.addEventListener("click", () => showState("closed")));
