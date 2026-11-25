// The AI instructions live in PROMPT.md (single source of truth).
window.AP_PROMPT = 'Loading instructions… open PROMPT.md in the repo if this stays empty.';
fetch('PROMPT.md', { cache: 'no-cache' }).then(r => r.ok ? r.text() : Promise.reject()).then(t => { window.AP_PROMPT = t; }).catch(() => { });
