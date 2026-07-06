import React, { useState, useEffect } from "react";
import { auth, db, OperationType, handleFirestoreError } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { 
  Sparkles, 
  Globe, 
  TrendingUp, 
  Search, 
  MessageSquare, 
  LogOut, 
  User, 
  ShieldCheck, 
  Star, 
  ChevronRight, 
  TrendingDown, 
  Info,
  Clock,
  Menu,
  X,
  ShieldAlert,
  ShoppingCart
} from "lucide-react";

import AuthModal from "./components/AuthModal";
import BaridiMobUpgrade from "./components/BaridiMobUpgrade";
import SiteGenerator from "./components/SiteGenerator";
import ProfitCalculator from "./components/ProfitCalculator";
import SupplierSearcher from "./components/SupplierSearcher";
import BusinessChat from "./components/BusinessChat";
import AdminPanel from "./components/AdminPanel";
import { UserProfile } from "./types";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestMode, setGuestMode] = useState(false);
  
  // Navigation & Sub-views
  const [activeTab, setActiveTab] = useState<"dashboard" | "site" | "profit" | "supplier" | "chat" | "admin">("dashboard");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Admin access variables
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [hasPendingUpgrade, setHasPendingUpgrade] = useState(false);
  const [rejectedPayment, setRejectedPayment] = useState<{ paymentId: string; rejectionReason?: string; senderRip?: string } | null>(null);

  // Quick stats summaries
  const [timeStr, setTimeStr] = useState("");

  // Update current time indicator in local Algeria timezone
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen for Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setGuestMode(false);
        
        try {
          // Fetch or create profile in Firestore
          const docRef = doc(db, "users", firebaseUser.uid);
          let docSnap;
          try {
            docSnap = await getDoc(docRef);
          } catch (e) {
            handleFirestoreError(e, OperationType.GET, `users/${firebaseUser.uid}`);
          }
          
          if (docSnap && docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              userId: firebaseUser.uid,
              email: firebaseUser.email || "",
              subscriptionStatus: "free",
              companyName: firebaseUser.displayName || "Ma Boutique",
              createdAt: new Date().toISOString()
            };
            try {
              await setDoc(docRef, newProfile);
            } catch (e) {
              handleFirestoreError(e, OperationType.CREATE, `users/${firebaseUser.uid}`);
            }
            setProfile(newProfile);
          }
        } catch (err) {
          console.error("Erreur de profil Firestore:", err);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen for real-time user profile updates (important for admin validation updates)
  useEffect(() => {
    if (!user || guestMode) return;

    const docRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setProfile(snapshot.data() as UserProfile);
      }
    }, (err) => {
      console.error("Error listening to user profile:", err);
    });

    return () => unsubscribe();
  }, [user, guestMode]);

  // Listen for real-time user pending and rejected payments
  useEffect(() => {
    if (!user || guestMode) {
      setHasPendingUpgrade(false);
      setRejectedPayment(null);
      return;
    }

    const paymentsRef = collection(db, "users", user.uid, "baridiMobPayments");
    const unsubscribe = onSnapshot(paymentsRef, (snapshot) => {
      let pending = false;
      let rejected: { paymentId: string; rejectionReason?: string; senderRip?: string } | null = null;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === "pending") {
          pending = true;
        } else if (data.status === "rejected") {
          rejected = {
            paymentId: data.paymentId,
            rejectionReason: data.rejectionReason,
            senderRip: data.senderRip
          };
        }
      });
      
      setHasPendingUpgrade(pending);
      setRejectedPayment(rejected);
    }, (err) => {
      console.error("Error listening to user payments:", err);
    });

    return () => unsubscribe();
  }, [user, guestMode]);

  const handleLogout = async () => {
    if (guestMode) {
      setGuestMode(false);
    } else {
      await signOut(auth);
    }
    setActiveTab("dashboard");
  };

  const handleUpgradeSuccess = () => {
    if (profile) {
      setProfile({
        ...profile,
        subscriptionStatus: "business"
      });
    } else if (guestMode) {
      // Simulate guest upgrade
      setProfile({
        userId: "guest_user",
        email: "demo@ecom-companion.com",
        subscriptionStatus: "business",
        companyName: "Boutique Démo"
      });
    }
    setShowUpgradeModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Sparkles className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
        <p className="text-slate-400 font-medium text-sm">Chargement de votre espace de travail...</p>
      </div>
    );
  }

  // If not authenticated and not in guest mode, show auth gate
  if (!user && !guestMode) {
    return (
      <AuthModal
        onSuccess={(firebaseUser) => {
          setUser(firebaseUser);
        }}
        onGuestAccess={() => {
          setGuestMode(true);
          setProfile({
            userId: "guest_user",
            email: "invit@ecom-companion.com",
            subscriptionStatus: "free",
            companyName: "Boutique Démo"
          });
        }}
      />
    );
  }

  const isBusiness = profile?.subscriptionStatus === "business";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex relative overflow-hidden">
      
      {/* Background glow effects */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[120px]"></div>
      </div>
      
      {/* Sidebar for desktop navigation */}
      <aside className="hidden lg:flex flex-col w-64 bg-white/5 backdrop-blur-xl border-r border-white/10 shrink-0 z-10">
        {/* Brand logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div 
              onDoubleClick={() => {
                setAdminPasswordInput("");
                setAdminError("");
                setShowAdminPasswordModal(true);
              }}
              className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/30 text-white shrink-0 cursor-pointer select-none relative group"
              title="Double-cliquez pour l'administration"
            >
              <div className="relative w-6 h-6 flex items-center justify-center select-none">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-transparent fill-white">
                  <path 
                    fill="#ffffff"
                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center -mt-0.5 text-blue-600">
                  <ShoppingCart className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              </div>
            </div>
            <div>
              <h1 className="font-display font-black text-lg text-white tracking-tight">Tijara<span className="text-cyan-400 font-extrabold text-xl">.</span></h1>
              <span 
                onClick={() => {
                  setAdminPasswordInput("");
                  setAdminError("");
                  setShowAdminPasswordModal(true);
                }}
                className="text-[10px] text-blue-400 font-semibold font-mono tracking-wider cursor-pointer select-none"
              >
                WORKSPACE V1.0
              </span>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {[
            { id: "dashboard", label: "Tableau de Bord", icon: TrendingUp },
            { id: "site", label: "Landing Pages IA", icon: Globe },
            { id: "profit", label: "Calculateur Profit", icon: TrendingUp },
            { id: "supplier", label: "Grossistes & Sourcing", icon: Search, premium: true },
            { id: "chat", label: "E-Com Coach Chat", icon: MessageSquare }
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.premium && !isBusiness) {
                    setShowUpgradeModal(true);
                  } else {
                    setActiveTab(item.id as any);
                  }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group text-left ${
                  active 
                    ? "bg-white/10 text-blue-400 font-medium border border-white/10 shadow-lg shadow-blue-500/5" 
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                  <span className="text-xs">{item.label}</span>
                </div>
                {item.premium && !isBusiness && (
                  <span className="text-[9px] bg-blue-500/10 text-blue-400 font-bold px-1.5 py-0.5 rounded border border-blue-500/20 uppercase">
                    PRO
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Profile / bottom bar */}
        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/5 rounded-lg text-slate-300">
                <User className="w-4 h-4 text-blue-400" />
              </div>
              <div className="overflow-hidden">
                <span className="block text-[11px] font-semibold text-white truncate max-w-[120px]">
                  {guestMode ? "Visiteur Démo" : (user?.displayName || user?.email || "E-Commerçant")}
                </span>
                <span className={`text-[9px] font-bold uppercase ${isBusiness ? "text-blue-400" : "text-slate-500"}`}>
                  {isBusiness ? "Business Plan" : "Plan Gratuit"}
                </span>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-red-400 transition-all"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {!isBusiness && (
            <div className="mt-auto p-4 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-2xl">
              <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-widest font-semibold">Offre Actuelle</p>
              <p className="text-sm font-bold">Plan Gratuit</p>
              <p className="text-lg font-black text-blue-400 mt-1">4500 DA</p>
              <button 
                onClick={() => setShowUpgradeModal(true)}
                className="w-full mt-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-blue-500/20"
              >
                Devenir PRO
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main workspace viewport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen z-10 relative">
        
        {/* Top Header */}
        <header className="h-16 border-b border-white/10 bg-white/5 backdrop-blur-md px-6 flex items-center justify-between z-40 relative">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <span className="text-xs font-mono text-slate-500 font-medium hidden sm:inline">
              Algeria Time: <span className="text-slate-300 font-semibold">{timeStr}</span>
            </span>
          </div>

          {/* Centered Brand Title & Logo (Tijara) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 z-10 pointer-events-none md:pointer-events-auto">
            <h1 className="font-display font-black text-lg sm:text-2xl text-white tracking-tight flex items-center gap-1 drop-shadow-[0_2px_8px_rgba(34,211,238,0.2)]">
              <span>Tijara</span>
              <span className="text-cyan-400 font-black text-xl sm:text-2xl">.</span>
            </h1>
            
            {/* Heart gradient icon from reference logo */}
            <div className="relative w-7 h-7 flex items-center justify-center select-none scale-90 sm:scale-100">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-transparent" style={{ filter: "drop-shadow(0 3px 6px rgba(34, 211, 238, 0.35))" }}>
                <defs>
                  <linearGradient id="heartGradHeader" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
                <path 
                  fill="url(#heartGradHeader)"
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center -mt-0.5 z-10 text-slate-950">
                <ShoppingCart className="w-3 h-3 stroke-[2.5]" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isBusiness ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                Business Activé
              </span>
            ) : (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-slate-950 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 text-[9px] sm:text-[10px]"
              >
                <Star className="w-3 h-3 fill-current" />
                Devenir PRO - 4500 DA
              </button>
            )}

            <span className="text-xs font-mono text-blue-400 bg-blue-500/5 px-2.5 py-1 rounded-md border border-blue-500/10 hidden sm:inline-block">
              Live Preview
            </span>
          </div>
        </header>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-950/90 backdrop-blur-md border-b border-white/10 p-4 space-y-1 z-30">
            {[
              { id: "dashboard", label: "Tableau de Bord", icon: TrendingUp },
              { id: "site", label: "Landing Pages IA", icon: Globe },
              { id: "profit", label: "Calculateur Profit", icon: TrendingUp },
              { id: "supplier", label: "Grossistes & Sourcing", icon: Search, premium: true },
              { id: "chat", label: "E-Com Coach Chat", icon: MessageSquare }
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (item.premium && !isBusiness) {
                      setShowUpgradeModal(true);
                    } else {
                      setActiveTab(item.id as any);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                    active 
                      ? "bg-white/10 text-blue-400 font-semibold border border-white/10" 
                      : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-blue-400" />
                    <span className="text-xs">{item.label}</span>
                  </div>
                  {item.premium && !isBusiness && (
                    <span className="text-[9px] bg-blue-500/10 text-blue-400 font-bold px-1.5 py-0.5 rounded border border-blue-500/20">
                      PRO
                    </span>
                  )}
                </button>
              );
            })}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between px-4">
              <span className="text-xs text-slate-400">
                {guestMode ? "Mode Démo" : (user?.displayName || "Mon Compte")}
              </span>
              <button onClick={handleLogout} className="text-xs text-red-400 hover:underline flex items-center gap-1">
                <LogOut className="w-3.5 h-3.5" /> Se déconnecter
              </button>
            </div>
          </div>
        )}

        {/* Workspace Body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto w-full z-10">
          {showUpgradeModal ? (
            <BaridiMobUpgrade
              userId={profile?.userId || "guest_user"}
              userEmail={profile?.email || "demo@ecom-companion.com"}
              onUpgradeSuccess={handleUpgradeSuccess}
              onCancel={() => setShowUpgradeModal(false)}
              onRequireAuth={() => {
                setGuestMode(false);
                setProfile(null);
                setShowUpgradeModal(false);
              }}
            />
          ) : (
            <>
              {activeTab === "dashboard" && (
                <div className="space-y-8 animate-fade-in">
                  {/* Pending Purchase Notice Banner */}
                  {hasPendingUpgrade && (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                          <Clock className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">Reçu de paiement en cours d'examen</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Votre reçu BaridiMob de 4,500 DA a été transmis. L'administrateur va vérifier la transaction manuellement sous peu pour activer votre espace Business.
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold shrink-0 self-start sm:self-auto">
                        En attente de validation
                      </span>
                    </div>
                  )}

                  {/* Rejected Purchase Notice Banner */}
                  {rejectedPayment && !isBusiness && (
                    <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center justify-center shrink-0">
                          <ShieldAlert className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">Reçu de paiement BaridiMob rejeté</h4>
                          <p className="text-[11px] text-red-300 font-semibold mt-0.5">
                            Motif du rejet : {rejectedPayment.rejectionReason || "Reçu non conforme ou référence incorrecte."}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Votre soumission précédente (RIP: {rejectedPayment.senderRip || "N/A"}) n'a pas pu être validée. Veuillez renvoyer un reçu valide pour activer votre espace Business.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowUpgradeModal(true)}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shrink-0 self-start sm:self-auto shadow-lg shadow-red-500/15 cursor-pointer"
                      >
                        Soumettre un nouveau reçu
                      </button>
                    </div>
                  )}

                  {/* Hero welcome row */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                      <Sparkles className="w-48 h-48 text-blue-400" />
                    </div>

                    <div className="space-y-2 relative z-10">
                      <h2 className="text-2xl md:text-3xl font-bold text-white font-display tracking-tight">
                        Salam, {guestMode ? "Cher E-Commerçant !" : (user?.displayName || "Partenaire !")}
                      </h2>
                      <p className="text-slate-400 text-xs md:text-sm max-w-xl">
                        Bienvenue sur Tijara, votre copilote automatisé pour exceller dans la vente en ligne en Algérie. Générez des landing pages, optimisez vos profits et trouvez vos fournisseurs en un clin d'œil.
                      </p>
                    </div>

                    {!isBusiness && (
                      <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-white/10 p-5 rounded-2xl md:max-w-xs relative z-10 shrink-0">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">
                          Offre Spéciale Business
                        </span>
                        <h4 className="text-lg font-bold text-white">4,500 DA / à vie</h4>
                        <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed">
                          Débloquez la recherche profonde de grossistes par IA et le générateur d'images de produits via BaridiMob.
                        </p>
                        <button
                          onClick={() => setShowUpgradeModal(true)}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-blue-500/20"
                        >
                          Débloquer l'Offre
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick features Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      {
                        title: "Créer un site produit",
                        desc: "Générez un site d'une page haute-conversion avec formulaire de commande COD.",
                        action: () => setActiveTab("site"),
                        icon: Globe,
                        color: "text-blue-400 bg-blue-500/10 border-blue-500/20"
                      },
                      {
                        title: "Calculateur de Marges",
                        desc: "Calculez le bénéfice exact d'une campagne en incluant les frais de livraison.",
                        action: () => setActiveTab("profit"),
                        icon: TrendingUp,
                        color: "text-purple-400 bg-purple-500/10 border-purple-500/20"
                      },
                      {
                        title: "Sourcing Grossistes",
                        desc: "Recherchez des fournisseurs en Algérie ou à l'étranger avec leurs adresses réelles.",
                        action: () => isBusiness ? setActiveTab("supplier") : setShowUpgradeModal(true),
                        icon: Search,
                        premium: true,
                        color: "text-amber-400 bg-amber-500/10 border-amber-500/20"
                      },
                      {
                        title: "Coach IA E-Commerce",
                        desc: "Posez vos questions à notre coach IA expert du marché e-com algérien.",
                        action: () => setActiveTab("chat"),
                        icon: MessageSquare,
                        color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
                      }
                    ].map((feat, idx) => (
                      <div
                        key={idx}
                        onClick={feat.action}
                        className="bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/20 hover:bg-white/10 p-6 rounded-3xl shadow-md cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col justify-between"
                      >
                        <div className="space-y-4">
                          <div className={`p-3 rounded-xl border w-fit ${feat.color}`}>
                            <feat.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                              {feat.title}
                              {feat.premium && !isBusiness && (
                                <span className="text-[9px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold">
                                  PRO
                                </span>
                              )}
                            </h3>
                            <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                              {feat.desc}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 pt-2 border-t border-white/10 flex items-center text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
                          Ouvrir l'outil <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Market Tips Row */}
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-400" />
                      Conseils du marché de vente en Algérie (Sourcing & Logistique)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-xs space-y-1">
                        <span className="font-semibold text-blue-400 block">Sourcing physique local</span>
                        <p className="text-slate-400 leading-relaxed">
                          Le marché du **Hamiz** (Alger) reste le hub national pour l'électroménager et le bazar. Pour les vêtements et textiles, privilégiez **El Eulma** (Sétif) ou **Aïn M'lila**. Belfort est idéal pour la téléphonie et les gadgets.
                        </p>
                      </div>

                      <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-xs space-y-1">
                        <span className="font-semibold text-blue-400 block">Optimisation de la livraison</span>
                        <p className="text-slate-400 leading-relaxed">
                          Pour assurer un taux de livraison supérieur à 65%, appelez systématiquement les clients dans les 3 heures suivant leur commande. Utilisez des scripts persuasifs et envoyez un SMS de rappel le matin du passage du livreur.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "site" && (
                <SiteGenerator
                  userId={profile?.userId || "guest_user"}
                  isBusiness={isBusiness}
                  onUpgradePrompt={() => setShowUpgradeModal(true)}
                />
              )}

              {activeTab === "profit" && (
                <ProfitCalculator
                  userId={profile?.userId || "guest_user"}
                />
              )}

              {activeTab === "supplier" && (
                <SupplierSearcher
                  userId={profile?.userId || "guest_user"}
                  isBusiness={isBusiness}
                  onUpgradePrompt={() => setShowUpgradeModal(true)}
                />
              )}

              {activeTab === "chat" && (
                <BusinessChat
                  userId={profile?.userId || "guest_user"}
                />
              )}

              {activeTab === "admin" && (
                <AdminPanel
                  onBack={() => setActiveTab("dashboard")}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Admin Password Modal Overlay */}
      {showAdminPasswordModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (adminPasswordInput === "rassim@2007") {
                setShowAdminPasswordModal(false);
                setActiveTab("admin");
              } else {
                setAdminError("Mot de passe administrateur incorrect.");
              }
            }}
            className="bg-[#1e293b] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 font-sans"
          >
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mt-2 font-display">Zone d'Administration</h3>
              <p className="text-slate-400 text-xs">
                Saisissez le mot de passe confidentiel pour valider les reçus de transferts manuels BaridiMob.
              </p>
            </div>

            {adminError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs text-center">
                {adminError}
              </div>
            )}

            <div>
              <input
                type="password"
                placeholder="Mot de passe admin..."
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-xs text-center font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
                required
              />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowAdminPasswordModal(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-blue-500/15"
              >
                Confirmer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
