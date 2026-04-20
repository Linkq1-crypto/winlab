import { useState, useRef, useEffect } from "react";

const S = {
  overlay: {
    position:"absolute", inset:0, zIndex:100,
    display:"flex", flexDirection:"column",
    fontFamily:"'JetBrains Mono','Fira Code',monospace", fontSize:12,
    background:"#0a0c0f",
  },
  bar: {
    background:"#1a2030", color:"#c8d8c8",
    padding:"3px 12px", fontSize:11, whiteSpace:"pre",
    borderBottom:"1px solid #1c2030",
  },
  textarea: {
    flex:1, background:"#0a0c0f", color:"#c8d8c8",
    border:"none", outline:"none", resize:"none",
    padding:"8px 12px", fontFamily:"inherit", fontSize:12,
    lineHeight:1.55, caretColor:"#4caf84",
  },
  statusBar: {
    background:"#1a2030", color:"#8ab0a8",
    padding:"3px 12px", fontSize:11, borderTop:"1px solid #1c2030",
  },
  vimCmdLine: {
    background:"#0a0c0f", color:"#c8d8c8",
    padding:"2px 12px", fontSize:12, fontFamily:"inherit",
    borderTop:"1px solid #1c2030",
  },
  vimCmdInput: {
    background:"none", border:"none", outline:"none",
    color:"#c8d8c8", fontFamily:"inherit", fontSize:12,
    width:"calc(100% - 20px)", caretColor:"#4caf84",
  },
};

export default function TerminalEditor({ editor, onSave, onDiscard }) {
  const [content, setContent] = useState(editor.content);
  const [modified, setModified]  = useState(false);
  const [vimMode, setVimMode]    = useState("insert"); // "insert" | "command"
  const [vimCmd,  setVimCmd]     = useState("");
  const [savedMsg, setSavedMsg]  = useState("");
  const textRef   = useRef();
  const vimCmdRef = useRef();

  useEffect(() => { textRef.current?.focus(); }, []);

  const filename = editor.path.split("/").pop();
  const lines    = content.split("\n").length;
  const bytes    = new Blob([content]).size;

  // ── Nano ────────────────────────────────────────────────────────────────────
  function handleNanoKey(e) {
    if (e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case "x":
          e.preventDefault();
          onSave(content, editor.path);
          return;
        case "o":
          e.preventDefault();
          onSave(content, editor.path);
          setSavedMsg(`File Name to Write: ${editor.path}`);
          return;
        case "g":
          e.preventDefault();
          setSavedMsg("^X=Exit  ^O=Write  ^K=Cut  ^U=Paste  ^W=Search");
          setTimeout(() => setSavedMsg(""), 2000);
          return;
        case "k":
          e.preventDefault();
          return;
        case "c":
          e.preventDefault();
          setSavedMsg("");
          return;
        default: break;
      }
    }
  }

  // ── Vim ─────────────────────────────────────────────────────────────────────
  function handleVimTextKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      setVimMode("command");
      setVimCmd(":");
      setTimeout(() => vimCmdRef.current?.focus(), 0);
    }
  }

  function handleVimCmdChange(e) { setVimCmd(e.target.value); }

  function handleVimCmdKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const c = vimCmd.trim();
      if (c === ":wq" || c === ":x" || c === ":w") { onSave(content, editor.path); return; }
      if (c === ":q!" || c === ":q")                { onDiscard(); return; }
      if (c === ":set nu" || c === ":set number")   { setSavedMsg("line numbers on"); }
      setVimCmd(":");
    }
    if (e.key === "Escape") {
      setVimCmd("");
      setVimMode("insert");
      setTimeout(() => textRef.current?.focus(), 0);
    }
  }

  const isNano = editor.mode === "nano";

  return (
    <div style={S.overlay}>
      {/* ── header bar ── */}
      <div style={S.bar}>
        {isNano
          ? `  GNU nano 5.6.1  ${" ".repeat(Math.max(0, 20 - filename.length))}${editor.path}${modified ? " *" : ""}`
          : `"${editor.path}"  ${lines}L, ${bytes}B`
        }
      </div>

      {/* ── content ── */}
      <textarea
        ref={textRef}
        value={content}
        onChange={e => { setContent(e.target.value); setModified(true); setSavedMsg(""); }}
        onKeyDown={isNano ? handleNanoKey : handleVimTextKey}
        style={{ ...S.textarea, display: vimMode === "command" ? "block" : "block" }}
        spellCheck={false}
        autoComplete="off"
        readOnly={vimMode === "command"}
      />

      {/* ── vim ~ lines (cosmetic) ── */}
      {!isNano && vimMode === "insert" && (
        <div style={{ background:"#0a0c0f", color:"#334", fontSize:12, padding:"0 12px", fontFamily:"inherit" }}>
          ~
        </div>
      )}

      {/* ── vim command line / nano status ── */}
      {isNano ? (
        <>
          <div style={{ ...S.statusBar, color: savedMsg ? "#4caf84" : "#8ab0a8" }}>
            {savedMsg || `[ Read ${lines} lines ]`}
          </div>
          <div style={S.statusBar}>
            <span style={{ marginRight:16 }}>^G Help</span>
            <span style={{ marginRight:16 }}>^X Exit</span>
            <span style={{ marginRight:16 }}>^O Write Out</span>
            <span style={{ marginRight:16 }}>^K Cut</span>
            <span>^W Search</span>
          </div>
        </>
      ) : (
        <div style={S.vimCmdLine}>
          {vimMode === "command" ? (
            <input
              ref={vimCmdRef}
              value={vimCmd}
              onChange={handleVimCmdChange}
              onKeyDown={handleVimCmdKey}
              style={S.vimCmdInput}
              autoComplete="off"
              spellCheck={false}
            />
          ) : (
            <span style={{ color:"#6b7280" }}>
              {savedMsg || `-- INSERT -- | ESC → command mode | :wq save  :q! discard`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
