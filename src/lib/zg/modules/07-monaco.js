/* == monaco == */
const Monaco = {
  _p: null,
  load(){
    if (this._p) return this._p;
    this._p = new Promise(resolve => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return resolve(false);
      const done = v => { this.ready = v; resolve(v); };
      const to = setTimeout(() => done(false), 4500);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.js';
      s.onload = () => {
        try {
          window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
          window.require(['vs/editor/editor.main'], () => { clearTimeout(to); this.setupTheme(); done(true); });
        } catch(e){ clearTimeout(to); done(false); }
      };
      s.onerror = () => { clearTimeout(to); done(false); };
      document.head.appendChild(s);
    });
    return this._p;
  },
  setupTheme(){
    monaco.editor.defineTheme('zg-dark', {
      base: 'vs-dark', inherit: true,
      rules: [
        { token:'comment', foreground:'525d78', fontStyle:'italic' },
        { token:'string', foreground:'7fd6ae' },
        { token:'keyword', foreground:'8fa2ff' },
        { token:'number', foreground:'e8b57e' },
        { token:'type', foreground:'6fc3df' }
      ],
      colors: {
        'editor.background':'#00000000',
        'editor.lineHighlightBackground':'#ffffff08',
        'editorLineNumber.foreground':'#39435c',
        'editorGutter.background':'#00000000',
        'editorIndentGuide.background':'#ffffff12'
      }
    });
  }
};
/* editor pane manager: Monaco when available, highlighted fallback otherwise */
const Editor = {
  inst: null, mode: null, path: null,
  async open(host, { path, text, readOnly }){
    this.path = path; this.host = host;
    const ok = await Monaco.load();
    if (ok){
      host.innerHTML = '<div class="monaco-host"></div>';
      const lang = langByPath(path);
      if (!this.inst){
        this.inst = monaco.editor.create(host.querySelector('.monaco-host'), {
          value: text, language: lang, theme: 'zg-dark', readOnly,
          fontSize: 12.5, lineHeight: 20, minimap: { enabled: false },
          scrollBeyondLastLine: false, automaticLayout: true,
          padding: { top: 10, bottom: 10 }, renderLineHighlight: 'all',
          wordWrap: 'off', scrollbar: { verticalScrollbarSize: 9, horizontalScrollbarSize: 9 }
        });
        this.inst.onDidChangeModelContent(() => onEditorDirty && onEditorDirty(true));
      } else {
        const model = this.inst.getModel();
        monaco.editor.setModelLanguage(model, lang);
        this.inst.setValue(text);
        this.inst.updateOptions({ readOnly });
      }
      this.mode = 'monaco';
    } else {
      this.mode = 'fallback';
      this.fbText = text; this.fbReadOnly = readOnly;
      this.renderFallback();
    }
  },
  renderFallback(){
    const host = this.host;
    if (this.fbReadOnly){
      host.innerHTML = `<div class="ed-fallback"><pre>${hl(esc(this.fbText))}</pre></div>`;
    } else {
      host.innerHTML = `<textarea class="ed-fallback-ta" spellcheck="false" style="position:absolute;inset:0;width:100%;height:100%;background:transparent;border:none;outline:none;color:var(--text);font:12.5px/1.6 var(--mono);padding:12px 14px;resize:none;white-space:pre;overflow:auto">${esc(this.fbText)}</textarea>`;
      host.querySelector('textarea').addEventListener('input', () => onEditorDirty && onEditorDirty(true));
    }
  },
  getValue(){
    if (this.mode === 'monaco' && this.inst) return this.inst.getValue();
    const ta = this.host.querySelector('textarea');
    return ta ? ta.value : this.fbText;
  },
  setReadOnly(ro){
    if (this.mode === 'monaco' && this.inst) this.inst.updateOptions({ readOnly: ro });
    else { this.fbReadOnly = ro; this.renderFallback(); }
  },
  destroy(){ if (this.inst){ this.inst.dispose(); this.inst = null; } }
};
/* lightweight highlighter for fallback mode */
function hl(code){
  return code.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|&quot;[\s\S]*?&quot;|&#39;[\s\S]*?&#39;|`[^`]*`|\b\d+(?:\.\d+)?\b|\b(?:const|let|var|function|return|if|else|for|while|class|import|from|export|default|async|await|try|catch|throw|new|typeof|switch|case|break|continue|def|print|True|False|None|null|undefined|true|false|this|self|in|of|not|and|or|yield|static|public|private|void|int|float|str|bool|package|func|fn|use|mod|match)\b)/g,
  m => {
    if (m.startsWith('//')||m.startsWith('/*')||m.startsWith('#')) return `<span class="tok-c">${m}</span>`;
    if (m.startsWith('&quot;')||m.startsWith('&#39;')||m.startsWith('`')) return `<span class="tok-s">${m}</span>`;
    if (/^\d/.test(m)) return `<span class="tok-n">${m}</span>`;
    return `<span class="tok-k">${m}</span>`;
  });
}
