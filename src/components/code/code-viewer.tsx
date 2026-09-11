"use client";
import { useMemo, useState } from "react";
import { Check, Copy, WrapText } from "lucide-react";
import { languageFromPath, type LanguageInfo } from "@/lib/language";
import { tokenize, type HighlightMode, type TokenType } from "@/lib/syntax";

const tokenClass: Record<TokenType, string> = {
  plain: "", kw: "token-kw", str: "token-str", num: "token-num", com: "token-com",
  fn: "token-fn", typ: "token-typ", tag: "token-tag", attr: "token-attr", punc: "token-punc", op: "token-op"
};

export function useHighlightedLines(code: string, mode: HighlightMode, languageId?: string) {
  return useMemo(() => tokenize(code, mode, languageId), [code, mode, languageId]);
}

export function Tokens({ tokens }: { tokens: Array<{ text: string; type: TokenType }> }) {
  return <>{tokens.map((token, index) => tokenClass[token.type] ? <span className={tokenClass[token.type]} key={index}>{token.text}</span> : <span key={index}>{token.text}</span>)}</>;
}

export function CodeViewer({ code, path, language, maxHeight = 620, wrapDefault = false, showToolbar = true, startLine = 1 }: {
  code: string;
  path: string;
  language?: LanguageInfo | null;
  maxHeight?: number;
  wrapDefault?: boolean;
  showToolbar?: boolean;
  startLine?: number;
}) {
  const info = language ?? languageFromPath(path);
  const mode: HighlightMode = info?.syntax ?? "code";
  const lines = useHighlightedLines(code, mode, info?.id);
  const [wrap, setWrap] = useState(wrapDefault);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  }

  const displayLines = lines.length === 1 && lines[0]?.length === 0 ? [] : lines;
  return <div className={`code-viewer ${wrap ? "code-wrap" : ""}`}>
    {showToolbar ? <div className="code-header">
      <span className="code-meta">{displayLines.length} lines · {info?.name ?? "Plain text"}</span>
      <div className="row-actions" style={{ marginLeft: "auto" }}>
        <button type="button" className="button button-ghost button-sm" onClick={() => setWrap((value) => !value)} aria-pressed={wrap} title="Toggle line wrap"><WrapText/>{wrap ? "No wrap" : "Wrap"}</button>
        <button type="button" className="button button-ghost button-sm" onClick={copy}>{copied ? <Check/> : <Copy/>}{copied ? "Copied" : "Copy"}</button>
      </div>
    </div> : null}
    <div className="code-scroll" style={{ maxHeight }}>
      <pre className="code-pre">{displayLines.map((tokens, index) => (
        <div className="code-line" key={index}>
          <span className="code-line-num" aria-hidden="true">{index + startLine}</span>
          <span className="code-line-code"><Tokens tokens={tokens}/></span>
        </div>
      ))}</pre>
      {displayLines.length === 0 ? <div className="empty"><p>This file is empty.</p></div> : null}
    </div>
  </div>;
}
