import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";

const SUGGESTIONS = ["Best time for Manali?", "Solo trip tips", "Cheap stay ideas"];

export default function ChatBot({ tripContext }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", text: "Namaste! 👋 Main Wanderly hoon. Travel ke baare mein kuch bhi poochho." },
  ]);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    const history = [...messages, { role: "user", text: q }];
    setMessages([...history, { role: "bot", text: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(1), tripContext }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const part of parts) {
          const line = part.replace(/^data: /, "");
          if (line === "[DONE]") continue;
          try {
            answer += JSON.parse(line).text;
            setMessages((m) => [...m.slice(0, -1), { role: "bot", text: answer }]);
          } catch {}
        }
      }
    } catch {
      setMessages((m) => [...m.slice(0, -1), { role: "bot", text: "Server se connect nahi ho paya 😕" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="chat">
          <div className="chat-head">
            <div><b>Wanderly AI</b><small>Tumhara travel buddy</small></div>
            <button onClick={() => setOpen(false)}><X size={20} /></button>
          </div>
          <div className="msgs">
            {messages.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.text || "..."}</div>)}
            <div ref={endRef} />
          </div>
          {messages.length < 3 && (
            <div className="suggest">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
            </div>
          )}
          <div className="chat-input">
            <input value={input} placeholder="Kuch poochho..." onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()} />
            <button onClick={() => send()}><Send size={18} /></button>
          </div>
        </div>
      )}
      <button className="chat-fab" onClick={() => setOpen(!open)} aria-label="Open chat">
        <MessageCircle />
      </button>
    </>
  );
}
