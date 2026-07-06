import React, { useState, useEffect } from "react";
import { db, OperationType, handleFirestoreError } from "../firebase";
import { collection, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, 
  Users, 
  TrendingUp, 
  Clock, 
  Check, 
  X, 
  Search, 
  Image as ImageIcon, 
  Calendar, 
  Mail, 
  CreditCard, 
  ArrowLeft,
  AlertCircle,
  Hash,
  Download,
  RotateCw,
  ZoomIn,
  ZoomOut,
  CheckSquare,
  Square,
  RefreshCw,
  ShieldAlert,
  Database,
  FileText,
  FileCheck,
  ChevronRight,
  UserCheck
} from "lucide-react";

interface AdminPanelProps {
  onBack: () => void;
}

interface PaymentRecord {
  paymentId: string;
  userId: string;
  userEmail: string;
  amount: number;
  senderRip: string;
  transactionReference: string;
  receiptImage: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  rejectionReason?: string;
  updatedAt?: string;
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  
  // Interactive receipt workspace state
  const [rotate, setRotate] = useState(0);
  const [scale, setScale] = useState(1);
  const [selectedReceiptLightbox, setSelectedReceiptLightbox] = useState<string | null>(null);

  // Secure Checklist state
  const [chkRip, setChkRip] = useState(false);
  const [chkRef, setChkRef] = useState(false);
  const [chkAmount, setChkAmount] = useState(false);

  // Rejection modal state
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReasonOption, setRejectionReasonOption] = useState("Reçu ou capture d'écran illisible ou tronqué.");
  const [customRejectionReason, setCustomRejectionReason] = useState("");

  // System States
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [syncSecondsAgo, setSyncSecondsAgo] = useState(0);

  // Real-time synchronization counter
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.round((new Date().getTime() - lastSync.getTime()) / 1000);
      setSyncSecondsAgo(elapsed);
    }, 2000);
    return () => clearInterval(interval);
  }, [lastSync]);

  // Listen to globalPayments collection in real-time
  useEffect(() => {
    const paymentsRef = collection(db, "globalPayments");
    const unsubscribe = onSnapshot(paymentsRef, (snapshot) => {
      const docsList: PaymentRecord[] = [];
      snapshot.forEach((doc) => {
        docsList.push(doc.data() as PaymentRecord);
      });
      // Sort by creation date descending
      docsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setPayments(docsList);
      setLastSync(new Date());
      setSyncSecondsAgo(0);
      setLoading(false);
      
      // Auto-update selected payment if it's currently open to sync changes
      if (selectedPayment) {
        const updated = docsList.find(p => p.paymentId === selectedPayment.paymentId);
        if (updated) {
          setSelectedPayment(updated);
        }
      }
    }, (error) => {
      console.error("Error fetching global payments:", error);
      handleFirestoreError(error, OperationType.GET, "globalPayments");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedPayment]);

  const triggerToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => {
      setToastMsg(null);
    }, 4500);
  };

  const handleDecision = async (payment: PaymentRecord, decision: "approved" | "rejected", finalReason?: string) => {
    setActionLoadingId(payment.paymentId);

    try {
      // 1. Update global payment record
      const globalPaymentRef = doc(db, "globalPayments", payment.paymentId);
      await updateDoc(globalPaymentRef, {
        status: decision,
        updatedAt: new Date().toISOString(),
        ...(decision === "rejected" ? { rejectionReason: finalReason || "" } : { rejectionReason: null })
      });

      // 2. Update user-specific subcollection payment record
      const userPaymentRef = doc(db, "users", payment.userId, "baridiMobPayments", payment.paymentId);
      await updateDoc(userPaymentRef, {
        status: decision,
        updatedAt: new Date().toISOString(),
        ...(decision === "rejected" ? { rejectionReason: finalReason || "" } : { rejectionReason: null })
      });

      // 3. Update user-specific subscriptionStatus in user profile
      const userRef = doc(db, "users", payment.userId);
      const targetStatus = decision === "approved" ? "business" : "free";
      await updateDoc(userRef, {
        subscriptionStatus: targetStatus
      });

      triggerToast(
        decision === "approved" 
          ? `L'accès Business de ${payment.userEmail} a été validé et activé !` 
          : `Le dossier de ${payment.userEmail} a été rejeté.`,
        decision === "approved" ? "success" : "info"
      );

      // Reset workspace verification tools
      setChkRip(false);
      setChkRef(false);
      setChkAmount(false);
      setRotate(0);
      setScale(1);

    } catch (err: any) {
      console.error("Decision update failed:", err);
      triggerToast("Erreur lors de la mise à jour Firestore. Droits insuffisants.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectSubmit = () => {
    if (!selectedPayment) return;
    const finalReason = rejectionReasonOption === "Autre" ? customRejectionReason : rejectionReasonOption;
    if (!finalReason.trim()) {
      triggerToast("Veuillez saisir un motif de rejet.", "error");
      return;
    }
    setShowRejectionModal(false);
    handleDecision(selectedPayment, "rejected", finalReason);
  };

  const selectRecord = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    // Reset workspace checks
    setChkRip(false);
    setChkRef(false);
    setChkAmount(false);
    setRotate(0);
    setScale(1);
  };

  // Stats calculations
  const totalEarned = payments
    .filter(p => p.status === "approved")
    .reduce((sum, p) => sum + (p.amount || 4500), 0);

  const pendingCount = payments.filter(p => p.status === "pending").length;
  const approvedCount = payments.filter(p => p.status === "approved").length;
  const rejectedCount = payments.filter(p => p.status === "rejected").length;

  const filteredPayments = payments.filter(p => {
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesSearch = 
      p.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.senderRip?.includes(searchTerm) ||
      p.transactionReference?.includes(searchTerm) ||
      p.paymentId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in font-sans relative z-10 pb-20">
      
      {/* Toast Alert System overlay */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4"
          >
            <div className={`p-4 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm backdrop-blur-xl ${
              toastMsg.type === "success" 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : toastMsg.type === "error"
                  ? "bg-red-500/10 border-red-500/20 text-red-300"
                  : "bg-blue-500/10 border-blue-500/20 text-blue-300"
            }`}>
              {toastMsg.type === "success" && <Check className="w-5 h-5 text-emerald-400 shrink-0" />}
              {toastMsg.type === "error" && <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />}
              {toastMsg.type === "info" && <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />}
              <span className="font-semibold">{toastMsg.text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-3xl border border-white/10 backdrop-blur-md">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl cursor-pointer border border-white/5 self-start sm:self-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au Workspace
        </button>

        <div className="flex items-center gap-4">
          {/* Real time synchronisation monitor */}
          <div className="flex items-center gap-2 bg-black/40 border border-white/5 px-3 py-1.5 rounded-xl text-[11px] text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium">
              Firestore Sync : {syncSecondsAgo === 0 ? "à l'instant" : `il y a ${syncSecondsAgo}s`}
            </span>
          </div>

          <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-1.5 rounded-full font-bold uppercase tracking-widest flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin Dashboard
          </span>
        </div>
      </div>

      {/* Headline banner */}
      <div>
        <h2 className="text-3xl font-black text-white tracking-tight font-display flex items-center gap-3">
          <Database className="w-8 h-8 text-blue-400" />
          Tijara Central Admin
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-xl">
          Espace de vérification sécurisée en temps réel pour l'activation manuelle de l'offre Business à vie (4,500 DA) de la plateforme Tijara.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Chiffre CCP</span>
            <span className="text-xl font-black text-emerald-400 block">{(totalEarned).toLocaleString()} DA</span>
            <span className="text-[9px] text-slate-400 block">{approvedCount} comptes actifs</span>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">En attente</span>
            <span className="text-xl font-black text-amber-400 block">{pendingCount} reçu{pendingCount > 1 ? "s" : ""}</span>
            <span className="text-[9px] text-slate-400 block">Requiert un examen CCP</span>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Soumissions Rejetées</span>
            <span className="text-xl font-black text-red-400 block">{rejectedCount} dossier{rejectedCount > 1 ? "s" : ""}</span>
            <span className="text-[9px] text-slate-400 block">Demandes non conformes</span>
          </div>
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Soumissions totales</span>
            <span className="text-xl font-black text-blue-400 block">{payments.length} reçus</span>
            <span className="text-[9px] text-slate-400 block">Historique global Firestore</span>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Records Master List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/40 p-4 rounded-3xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Liste des transactions</h3>
              <span className="text-[10px] text-slate-500 font-mono">({filteredPayments.length} affichés)</span>
            </div>

            {/* Filter and Search */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Rechercher email, RIP, référence..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs transition-all font-sans"
                />
              </div>

              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: "all", label: "Tous" },
                  { id: "pending", label: "À Valider" },
                  { id: "approved", label: "Confirmés" },
                  { id: "rejected", label: "Rejetés" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center ${
                      statusFilter === tab.id
                        ? "bg-blue-500 text-white shadow-md shadow-blue-500/10"
                        : "bg-white/5 text-slate-400 border border-transparent hover:text-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List display */}
          <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
            {loading ? (
              <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-12 text-center text-slate-500">
                <Clock className="w-6 h-6 mx-auto animate-spin mb-2 text-blue-400" />
                <span className="text-xs">Synchronisation avec Firestore...</span>
              </div>
            ) : filteredPayments.length > 0 ? (
              filteredPayments.map((payment) => {
                const isSelected = selectedPayment?.paymentId === payment.paymentId;
                return (
                  <div
                    key={payment.paymentId}
                    onClick={() => selectRecord(payment)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer text-left relative overflow-hidden group ${
                      isSelected 
                        ? "bg-blue-500/10 border-blue-500/40 shadow-lg shadow-blue-500/5" 
                        : "bg-slate-900/40 border-white/5 hover:border-white/15"
                    }`}
                  >
                    {/* Selected Left indicator bar */}
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <span className="text-white text-xs font-bold block truncate max-w-[210px] sm:max-w-none">
                          {payment.userEmail}
                        </span>
                        
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                          <span>Ref:</span>
                          <span className="text-slate-300 font-semibold">{payment.transactionReference}</span>
                        </div>
                      </div>

                      {/* Status pill badge */}
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                        payment.status === "pending"
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : payment.status === "approved"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-red-500/10 border-red-500/20 text-red-400"
                      }`}>
                        {payment.status === "pending" ? "À valider" : payment.status === "approved" ? "Validé" : "Rejeté"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2.5 mt-2.5 border-t border-white/5">
                      <span>{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Inconnue"}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-slate-300">{payment.amount || 4500} DA</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-slate-900/25 border border-white/5 rounded-2xl p-10 text-center text-slate-500">
                <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <h4 className="font-bold text-xs text-slate-400">Aucun reçu trouvé</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Aucun dossier ne correspond à votre filtre actuel.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Detailed Verification Workspace */}
        <div className="lg:col-span-7">
          {selectedPayment ? (
            <motion.div 
              key={selectedPayment.paymentId}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-slate-900/40 border border-white/10 rounded-3xl p-6 space-y-6 relative"
            >
              
              {/* Workspace Header Info */}
              <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Workspace de vérification</span>
                  </div>
                  <h3 className="text-lg font-bold text-white font-display">
                    Dossier {selectedPayment.paymentId}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-slate-400 text-xs">
                    <span className="flex items-center gap-1 font-semibold text-slate-300">
                      <Mail className="w-3.5 h-3.5 text-blue-400" />
                      {selectedPayment.userEmail}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`inline-block text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                    selectedPayment.status === "pending"
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      : selectedPayment.status === "approved"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}>
                    {selectedPayment.status === "pending" ? "Examen Requis" : selectedPayment.status === "approved" ? "Approuvé" : "Rejeté"}
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-1 font-mono">UID: {selectedPayment.userId}</span>
                </div>
              </div>

              {/* Transaction details card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/40 p-4 rounded-2xl border border-white/5 text-xs font-sans">
                <div className="space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase block">Numéro de Transaction</span>
                  <span className="text-white font-mono font-bold flex items-center gap-1.5 select-all">
                    <Hash className="w-3.5 h-3.5 text-blue-400" />
                    {selectedPayment.transactionReference}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase block">RIP de l'expéditeur</span>
                  <span className="text-white font-mono block select-all font-semibold text-[13px] tracking-wide">
                    {selectedPayment.senderRip || "N/A"}
                  </span>
                </div>

                <div className="space-y-1 pt-2 border-t border-white/5 sm:border-transparent">
                  <span className="text-slate-500 text-[10px] uppercase block">Montant du virement</span>
                  <span className="text-emerald-400 text-base font-black flex items-center gap-1">
                    <CreditCard className="w-4 h-4 text-emerald-500" />
                    {selectedPayment.amount || 4500} DA
                  </span>
                </div>

                <div className="space-y-1 pt-2 border-t border-white/5">
                  <span className="text-slate-500 text-[10px] uppercase block">Date de soumission</span>
                  <span className="text-slate-300 font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {selectedPayment.createdAt ? new Date(selectedPayment.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }) : "Inconnue"}
                  </span>
                </div>
              </div>

              {/* Interactive Proof inspection workspace */}
              {selectedPayment.receiptImage ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                      Visualisation de la preuve d'achat
                    </span>

                    {/* Rotate and zoom controls */}
                    <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-0.5">
                      <button
                        onClick={() => setRotate((prev) => (prev + 90) % 360)}
                        className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-all cursor-pointer"
                        title="Faire pivoter de 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setScale((prev) => Math.min(prev + 0.25, 3.5))}
                        className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-all cursor-pointer"
                        title="Zoom +"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setScale((prev) => Math.max(prev - 0.25, 0.75))}
                        className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-all cursor-pointer"
                        title="Zoom -"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setRotate(0); setScale(1); }}
                        className="p-1 bg-white/5 hover:bg-white/10 rounded px-2 text-[9px] font-bold text-slate-300 transition-all cursor-pointer"
                        title="Réinitialiser"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Image container box */}
                  <div className="relative rounded-2xl border border-white/10 overflow-hidden bg-black/80 h-72 flex items-center justify-center">
                    <div 
                      className="w-full h-full p-2 flex items-center justify-center transition-transform duration-200"
                      style={{ transform: `rotate(${rotate}deg) scale(${scale})` }}
                    >
                      <img 
                        src={selectedPayment.receiptImage} 
                        alt="Reçu officiel BaridiMob" 
                        className="object-contain max-h-full max-w-full select-none"
                      />
                    </div>

                    {/* Watermark badge / overlay hint */}
                    <button
                      onClick={() => setSelectedReceiptLightbox(selectedPayment.receiptImage)}
                      className="absolute bottom-3 right-3 bg-black/75 hover:bg-black/90 border border-white/15 rounded-xl px-3 py-1.5 text-[10px] font-semibold text-white transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Search className="w-3 h-3 text-blue-400" />
                      Agrandir Plein Écran
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-slate-900/50 border border-dashed border-white/10 rounded-2xl text-center space-y-2 text-xs flex flex-col items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-slate-600" />
                  <span className="font-bold text-slate-400">Aucun reçu d'écran joint</span>
                  <span className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                    Cet utilisateur a soumis sans téléverser d'image. Veuillez procéder à la vérification par le numéro de transaction CCP direct.
                  </span>
                </div>
              )}

              {/* Secure Verification Flow Checklist */}
              {selectedPayment.status === "pending" ? (
                <div className="bg-blue-950/20 border border-blue-500/20 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <FileCheck className="w-4 h-4" />
                    <span className="text-[11px] font-extrabold uppercase tracking-widest">Protocole de Sécurité Obligatoire</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Pour parer les fraudes, vous devez impérativement valider les points suivants pour débloquer le bouton de validation de l'espace Tijara :
                  </p>

                  <div className="space-y-2.5 pt-1">
                    <button
                      onClick={() => setChkRip(!chkRip)}
                      className="flex items-center gap-3 text-left w-full text-xs text-slate-300 hover:text-white transition-all cursor-pointer select-none"
                    >
                      {chkRip ? (
                        <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span>Le RIP d'expédition renseigné correspond au reçu CCP (<strong className="font-mono text-[10px]">{selectedPayment.senderRip || "N/A"}</strong>)</span>
                    </button>

                    <button
                      onClick={() => setChkRef(!chkRef)}
                      className="flex items-center gap-3 text-left w-full text-xs text-slate-300 hover:text-white transition-all cursor-pointer select-none"
                    >
                      {chkRef ? (
                        <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span>Le numéro de transaction de transfert d'argent (<strong className="font-mono text-[10px]">{selectedPayment.transactionReference}</strong>) est authentique</span>
                    </button>

                    <button
                      onClick={() => setChkAmount(!chkAmount)}
                      className="flex items-center gap-3 text-left w-full text-xs text-slate-300 hover:text-white transition-all cursor-pointer select-none"
                    >
                      {chkAmount ? (
                        <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span>Le montant de 4 500 DA a bien été validé sur votre compte personnel</span>
                    </button>
                  </div>
                </div>
              ) : selectedPayment.status === "rejected" ? (
                <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-4 text-xs space-y-1">
                  <span className="text-red-400 font-bold block uppercase tracking-wide">Dossier Rejeté</span>
                  <p className="text-slate-400">
                    Motif : <strong className="text-red-300">{selectedPayment.rejectionReason || "Aucun motif spécifié."}</strong>
                  </p>
                  <p className="text-[10px] text-slate-500 pt-1">
                    Mis à jour le : {selectedPayment.updatedAt ? new Date(selectedPayment.updatedAt).toLocaleDateString() : "Récemment"}
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-4 text-xs space-y-1.5 flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-emerald-400 font-extrabold block uppercase tracking-wide">Abonnement Business Actif</span>
                    <p className="text-slate-400 text-[11px]">
                      Cet utilisateur possède un accès complet à vie aux outils Tijara (Landing pages, Chat IA, Sourcing).
                    </p>
                  </div>
                </div>
              )}

              {/* Execution Actions controls */}
              {selectedPayment.status === "pending" && (
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                  <button
                    disabled={actionLoadingId !== null}
                    onClick={() => {
                      setRejectionReasonOption("Reçu ou capture d'écran illisible ou tronqué.");
                      setCustomRejectionReason("");
                      setShowRejectionModal(true);
                    }}
                    className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55"
                  >
                    <X className="w-4 h-4" />
                    Rejeter la demande
                  </button>

                  <button
                    disabled={actionLoadingId !== null || !(chkRip && chkRef && chkAmount)}
                    onClick={() => handleDecision(selectedPayment, "approved")}
                    className={`font-bold py-3 rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-35 ${
                      (chkRip && chkRef && chkAmount) 
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/15"
                        : "bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed"
                    }`}
                  >
                    {actionLoadingId === selectedPayment.paymentId ? (
                      <Clock className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Confirmer l'achat
                  </button>
                </div>
              )}

            </motion.div>
          ) : (
            <div className="bg-slate-900/20 border border-white/5 rounded-3xl p-16 text-center space-y-4 max-w-lg mx-auto flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-blue-500/5 text-blue-400/40 rounded-full flex items-center justify-center border border-blue-500/10">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-300 font-display">Aucun dossier actif</h4>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                  Sélectionnez l'une des soumissions dans la colonne de gauche pour accéder à la procédure de contrôle, inspecter le reçu CCP et activer l'abonnement.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* REJECTION REASON DIALOG MODAL */}
      {showRejectionModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e293b] border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 font-sans animate-fade-in">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white font-display">Motif du rejet du reçu</h3>
                <p className="text-slate-400 text-[11px]">
                  Sélectionnez la raison du rejet. Elle sera notifiée en temps réel à l'utilisateur :
                </p>
              </div>
              <button 
                onClick={() => setShowRejectionModal(false)}
                className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 pt-2">
              {[
                "Reçu ou capture d'écran illisible ou tronqué.",
                "Numéro de référence erroné ou introuvable dans nos relevés CCP.",
                "Montant du transfert incorrect (4 500 DA exigés).",
                "Le reçu a déjà été utilisé pour un autre compte.",
                "Mauvais RIP expéditeur renseigné.",
                "Autre"
              ].map((reasonOption, idx) => (
                <label 
                  key={idx}
                  className="flex items-start gap-2.5 text-xs text-slate-300 hover:text-white cursor-pointer select-none"
                >
                  <input
                    type="radio"
                    name="rejectionReason"
                    value={reasonOption}
                    checked={rejectionReasonOption === reasonOption}
                    onChange={(e) => setRejectionReasonOption(e.target.value)}
                    className="mt-0.5 text-blue-500 focus:ring-0 focus:ring-offset-0 shrink-0"
                  />
                  <span>{reasonOption}</span>
                </label>
              ))}

              {rejectionReasonOption === "Autre" && (
                <div className="pt-1">
                  <textarea
                    placeholder="Saisissez un motif de rejet clair et bienveillant..."
                    value={customRejectionReason}
                    onChange={(e) => setCustomRejectionReason(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-600 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 h-20 resize-none font-sans"
                    maxLength={150}
                    required
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowRejectionModal(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-red-500/15"
              >
                Confirmer le Rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX FOR FULLSCREEN WORKSPACE RECEIPTS */}
      {selectedReceiptLightbox && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 z-50 animate-fade-in">
          <div className="absolute top-4 right-4 flex gap-2">
            <a 
              href={selectedReceiptLightbox} 
              download="recu_trans_ccp.png"
              className="p-3 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all"
              title="Télécharger l'image"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={() => setSelectedReceiptLightbox(null)}
              className="p-3 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="max-w-4xl max-h-[80vh] w-full h-full flex items-center justify-center p-2">
            <img 
              src={selectedReceiptLightbox} 
              alt="Agrandissement Reçu" 
              className="object-contain max-w-full max-h-full rounded-2xl shadow-2xl border border-white/10" 
            />
          </div>
          <span className="text-xs text-slate-400 mt-4 font-mono">Dossier de preuve officiel BaridiMob</span>
        </div>
      )}

    </div>
  );
}
