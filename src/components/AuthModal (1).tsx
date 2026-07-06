import React, { useState } from "react";
import { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "../firebase";
import { LogIn, Mail, Lock, User, AlertCircle, Sparkles, ShoppingCart, ExternalLink, Info } from "lucide-react";

interface AuthModalProps {
  onSuccess: (user: any) => void;
  onGuestAccess: () => void;
}

export default function AuthModal({ onSuccess, onGuestAccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showGoogleTroubleshooting, setShowGoogleTroubleshooting] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    setShowGoogleTroubleshooting(false);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onSuccess(result.user);
    } catch (err: any) {
      console.error("Google sign in error:", err);
      if (err?.code === "auth/popup-closed-by-user") {
        setError("La fenêtre de connexion Google a été fermée (ou bloquée) avant la fin de l'authentification.");
      } else if (err?.code === "auth/cancelled-popup-request") {
        setError("Une connexion Google est déjà en cours dans une autre fenêtre.");
      } else {
        setError("La connexion avec Google a échoué.");
      }
      setShowGoogleTroubleshooting(true);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!email || !password) {
      setError("Veuillez remplir tous les champs.");
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        if (!name) {
          setError("Veuillez entrer votre nom.");
          setLoading(false);
          return;
        }
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
        onSuccess(result.user);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        onSuccess(result.user);
      }
    } catch (err: any) {
      console.error("Email auth error:", err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("E-mail ou mot de passe incorrect.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Cet e-mail est déjà utilisé.");
      } else if (err.code === "auth/weak-password") {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
      } else {
        setError("Une erreur est survenue lors de l'authentification.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-500/15 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-purple-500/15 rounded-full blur-[100px]" />

      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 relative z-10" id="auth-container">
        {/* Logo and Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="relative w-16 h-16 flex items-center justify-center select-none mb-4 animate-pulse">
            <svg viewBox="0 0 24 24" className="w-16 h-16 text-transparent" style={{ filter: "drop-shadow(0 4px 10px rgba(34, 211, 238, 0.4))" }}>
              <defs>
                <linearGradient id="heartGradAuth" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>
              <path 
                fill="url(#heartGradAuth)"
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center -mt-1 z-10 text-slate-950">
              <ShoppingCart className="w-7 h-7 stroke-[2.5]" />
            </div>
          </div>
          <h1 className="text-3xl font-display font-black text-white tracking-tight flex items-center gap-1">
            <span>Tijara</span>
            <span className="text-cyan-400 font-extrabold text-3xl">.</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            La boîte à outils intelligente pour e-commerçants algériens.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-200 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Nom complet</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ex: Mohamed Amine"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Adresse e-mail</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                placeholder="Ex: amine@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99] text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? "Chargement..." : isSignUp ? "S'inscrire" : "Se connecter"}
          </button>
        </form>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <span className="bg-slate-950 px-3 text-slate-400 text-xs uppercase relative z-10 font-medium">Ou</span>
        </div>

        {/* Google Sign In button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-3 hover:border-white/20 text-sm cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.65 1.39 7.5l3.85 2.99c.92-2.76 3.5-4.45 6.76-4.45z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.44c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-1.99 3.73-4.92 3.73-8.61z"
            />
            <path
              fill="#FBBC05"
              d="M5.24 14.51c-.24-.72-.38-1.5-.38-2.31s.14-1.59.38-2.31L1.39 6.9c-.89 1.78-1.39 3.79-1.39 5.91s.5 4.13 1.39 5.91l3.85-2.99z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.03.69-2.35 1.1-3.96 1.1-3.26 0-5.84-1.69-6.76-4.45l-3.85 2.99C3.37 20.35 7.35 23 12 23z"
            />
          </svg>
          Continuer avec Google
        </button>

        {showGoogleTroubleshooting && (
          <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3 text-left">
            <div className="flex gap-2 items-start text-amber-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed font-semibold">
                Pourquoi la connexion Google échoue-t-elle ?
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              L'application s'exécute dans un cadre sécurisé (iframe) de Google AI Studio. Pour des raisons de sécurité, les navigateurs modernes (Chrome, Safari, Brave) bloquent l'échange de cookies tiers et la communication avec les popups dans cette prévisualisation par défaut.
            </p>
            <div className="text-[11px] text-amber-400 font-semibold leading-relaxed">
              Pour résoudre cela instantanément :
            </div>
            <ol className="list-decimal pl-4 text-[10.5px] text-slate-300 space-y-1.5 leading-relaxed">
              <li>
                Cliquez sur le bouton <strong className="text-white">"Open in a new tab"</strong> (ou l'icône de flèche de sortie) tout en haut de l'interface de Google AI Studio pour lancer l'application en dehors de l'iframe.
              </li>
              <li>
                Une fois ouverte dans son propre onglet, l'authentification Google s'effectuera parfaitement.
              </li>
              <li>
                <strong className="text-white">Alternative :</strong> Créez ou utilisez un compte classique en saisissant une <strong>adresse e-mail</strong> et un <strong>mot de passe</strong> ci-dessus, ou cliquez sur <strong>"Accéder sans compte (Mode Démo)"</strong> ci-dessous.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => window.open(window.location.href, "_blank")}
              className="w-full mt-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-medium py-1.5 px-3 rounded-lg text-[10px] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ouvrir l'application dans un nouvel onglet
            </button>
          </div>
        )}

        <div className="mt-6 text-center text-xs text-slate-400 space-y-3">
          <p>
            {isSignUp ? "Vous avez déjà un compte ?" : "Nouveau sur la plateforme ?"} &nbsp;
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-400 hover:underline font-medium focus:outline-none cursor-pointer"
            >
              {isSignUp ? "Se connecter" : "Créer un compte"}
            </button>
          </p>

          <p>
            <button
              onClick={onGuestAccess}
              className="text-blue-400/80 hover:text-blue-400 font-medium hover:underline focus:outline-none cursor-pointer"
            >
              Accéder sans compte (Mode Démo)
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
