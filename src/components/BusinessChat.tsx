import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Bot, User, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { ChatMessage } from "../types";

interface BusinessChatProps {
  userId: string;
}

const INITIAL_COACH_MESSAGE: ChatMessage = {
  id: "initial-msg",
  role: "assistant",
  content: "Salam ! Je suis votre coach E-Com IA personnel. Comment puis-je vous aider aujourd'hui à maximiser vos ventes, optimiser vos marges ou gérer la logistique de votre e-commerce en Algérie ?",
  createdAt: new Date().toISOString()
};

const SUGGESTIONS = [
  "Comment négocier avec les grossistes au Hamiz ?",
  "Quelle est la meilleure stratégie de livraison entre Yalidine et ZR Express ?",
  "Comment réduire les coûts de publicité (CPA) sur Facebook en Algérie ?",
  "Quel est le prix moyen d'achat en gros des accessoires téléphones ?"
];

export default function BusinessChat({ userId }: BusinessChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_COACH_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: textToSend,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      // Formulate complete chat history for backend call
      const conversationHistory = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch("/api/chat-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversationHistory })
      });

      const data = await res.json();
      if (res.ok) {
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: "assistant",
          content: data.response,
          createdAt: new Date().toISOString()
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setError(data.error || "Une erreur est survenue lors de la conversation.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Erreur de connexion avec le coach IA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-xl font-sans relative z-10">
      {/* Coach Header */}
      <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">E-Com Coach IA</h3>
            <p className="text-[10px] text-blue-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              Conseiller E-commerce Algérie Actif
            </p>
          </div>
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/10">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 max-w-[80%] ${m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
          >
            <div className={`p-2.5 rounded-xl text-slate-300 text-xs flex items-center justify-center shrink-0 h-9 w-9 ${
              m.role === "user" ? "bg-blue-500 text-white" : "bg-white/5 border border-white/10 text-blue-400"
            }`}>
              {m.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
              m.role === "user" 
                ? "bg-blue-500/10 border border-blue-500/20 text-white rounded-tr-none" 
                : "bg-white/5 border border-white/5 text-slate-200 rounded-tl-none"
            }`}>
              {m.content.split("\n").map((para, i) => (
                <p key={i} className="mb-1 last:mb-0">
                  {para}
                </p>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 max-w-[80%] mr-auto items-center">
            <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl text-blue-400">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-2 text-xs text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              Rédaction des conseils e-com en cours...
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-300 text-xs w-fit mx-auto">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Suggestion box */}
      {messages.length === 1 && (
        <div className="px-6 py-3 bg-white/5 border-t border-white/10">
          <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-2">Suggestions rapides :</span>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(s)}
                className="text-[11px] bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition-all text-left cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(input);
        }}
        className="p-4 bg-white/5 border-t border-white/10 flex gap-2 items-center"
      >
        <input
          type="text"
          placeholder="Posez votre question sur le sourcing, la pub, Yalidine..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs transition-all"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 text-white p-3 rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
