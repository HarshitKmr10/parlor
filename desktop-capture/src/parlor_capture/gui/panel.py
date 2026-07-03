"""The one-file HTML control panel (no external assets — CSP-safe, offline)."""

from __future__ import annotations

#: Header the client JS echoes back on state-changing requests so the server
#: can confirm the request came from the page it just served (see gui/server.py).
CSRF_TOKEN_HEADER = "X-Verdant-Capture-Token"

#: Placeholder swapped for the real per-launch token by ``render_panel``.
#: Using a plain ``str.replace`` (not ``str.format``) keeps every literal
#: ``{``/``}`` in the CSS and JS below untouched.
_TOKEN_PLACEHOLDER = "__VERDANT_CAPTURE_TOKEN__"

_PANEL_HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="verdant-capture-token" content="__VERDANT_CAPTURE_TOKEN__" />
<title>Verdant Capture</title>
<style>
  :root { --sage:#5c6b4a; --ink:#2a2e22; --bg:#fcfbf7; --line:#e6e1d4; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, sans-serif; background:var(--bg); color:var(--ink); }
  .wrap { max-width: 560px; margin: 0 auto; padding: 32px 20px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p.sub { color:#6b6f5e; margin:0 0 24px; }
  label { display:block; font-size:13px; color:#6b6f5e; margin:14px 0 4px; }
  input, select { width:100%; padding:9px 11px; border:1px solid var(--line); border-radius:8px; font-size:14px; background:#fff; }
  .row { display:flex; gap:12px; } .row > * { flex:1; }
  .check { display:flex; align-items:center; gap:8px; margin-top:14px; font-size:14px; }
  .check input { width:auto; }
  button { margin-top:22px; width:100%; padding:11px; border:0; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer; }
  #start { background:var(--sage); color:#fcfbf7; } #stop { background:#b4402f; color:#fff; }
  button:disabled { opacity:.5; cursor:not-allowed; }
  .status { margin-top:18px; padding:12px; border:1px solid var(--line); border-radius:8px; font-size:14px; background:#fff; }
  .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:7px; background:#bbb; }
  .dot.on { background:#3a7d44; }
  code { font-size:12px; color:#6b6f5e; word-break:break-all; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Verdant Capture</h1>
  <p class="sub">Record this device's meeting audio and stream it to Verdant — no bot in the room.</p>

  <label for="title">Meeting title</label>
  <input id="title" placeholder="Weekly sync" />

  <label for="meetingUrl">Meeting URL (optional)</label>
  <input id="meetingUrl" placeholder="https://meet.google.com/…" />

  <label for="device">Audio input</label>
  <select id="device"><option value="default">Default device</option></select>

  <div class="row">
    <div>
      <label for="stt">Transcription</label>
      <select id="stt">
        <option value="mock">Mock</option>
        <option value="faster-whisper">Local Whisper</option>
        <option value="remote">Remote</option>
      </select>
    </div>
    <div>
      <label for="chunkSeconds">Chunk (s)</label>
      <input id="chunkSeconds" type="number" value="5" min="1" />
    </div>
  </div>

  <div class="check"><input id="mockAudio" type="checkbox" /> <label for="mockAudio" style="margin:0">Use synthetic audio (no mic)</label></div>
  <div class="check"><input id="local" type="checkbox" /> <label for="local" style="margin:0">Offline (don't send to backend)</label></div>

  <button id="start">Start capture</button>
  <button id="stop" disabled>Stop capture</button>

  <div class="status"><span class="dot" id="dot"></span><span id="statusText">Idle</span><div><code id="args"></code></div></div>
</div>
<script>
  const $ = (id) => document.getElementById(id);
  async function loadDevices() {
    try {
      const r = await fetch('/api/devices'); const d = await r.json();
      for (const dev of d.devices || []) {
        const o = document.createElement('option'); o.value = dev.index; o.textContent = dev.name; $('device').appendChild(o);
      }
    } catch {}
  }
  function render(s) {
    const on = !!s.running;
    $('dot').className = 'dot' + (on ? ' on' : '');
    $('statusText').textContent = on ? ('Capturing (pid ' + s.pid + ')') : 'Idle';
    $('args').textContent = (s.args || []).join(' ');
    $('start').disabled = on; $('stop').disabled = !on;
  }
  async function refresh() { try { render(await (await fetch('/api/status')).json()); } catch {} }
  const CSRF_TOKEN_HEADER = 'X-Verdant-Capture-Token';
  const CSRF_TOKEN = document.querySelector('meta[name="verdant-capture-token"]').content;
  const authHeaders = () => ({ [CSRF_TOKEN_HEADER]: CSRF_TOKEN });
  $('start').onclick = async () => {
    const form = {
      title: $('title').value, meetingUrl: $('meetingUrl').value, device: $('device').value,
      stt: $('stt').value, chunkSeconds: $('chunkSeconds').value,
      mockAudio: $('mockAudio').checked, local: $('local').checked,
    };
    const r = await fetch('/api/start', { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify(form) });
    if (r.ok) render(await r.json()); else alert((await r.json()).error || 'Failed to start');
  };
  $('stop').onclick = async () => { render(await (await fetch('/api/stop', {method:'POST', headers: authHeaders()})).json()); };
  loadDevices(); refresh(); setInterval(refresh, 3000);
</script>
</body>
</html>"""


def render_panel(token: str) -> str:
    """Render the control panel HTML with a per-launch CSRF token embedded.

    The token is echoed by the client JS as the ``CSRF_TOKEN_HEADER`` header
    on ``/api/start`` and ``/api/stop`` so the server can reject requests
    that didn't come from a page it just served (see gui/server.py).
    """
    return _PANEL_HTML_TEMPLATE.replace(_TOKEN_PLACEHOLDER, token)
