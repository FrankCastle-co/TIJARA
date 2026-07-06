import React, { useState } from "react";
import { db, OperationType, handleFirestoreError } from "../firebase";
import { collection, addDoc, doc, updateDoc, setDoc } from "firebase/firestore";
import { CreditCard, Check, AlertCircle, Copy, CheckCircle2, ShieldCheck, UploadCloud, Info } from "lucide-react";

interface BaridiMobUpgradeProps {
  userId: string;
  userEmail: string;
  onUpgradeSuccess: () => void;
  onCancel: () => void;
  onRequireAuth?: () => void;
}

export default function BaridiMobUpgrade({ userId, userEmail, onUpgradeSuccess, onCancel, onRequireAuth }: BaridiMobUpgradeProps) {
  const [senderRip, setSenderRip] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  
  // Image Upload base64 state
  const [receiptBase64, setReceiptBase64] = useState<string>("");
  const [receiptFileName, setReceiptFileName] = useState<string>("");
  
  // Confirmation states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [attestChecked, setAttestChecked] = useState(false);

  const RECEIVER_RIP = "00799999002883366819";
  const RECEIVER_NAME = "E-COM COMPANION SPA";
  const AMOUNT = 4500;

  const copyRip = () => {
    navigator.clipboard.writeText(RECEIVER_RIP);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!senderRip || senderRip.length < 10) {
      setError("Veuillez entrer un RIP valide (20 chiffres).");
      return;
    }

    if (!transactionRef || transactionRef.length < 5) {
      setError("Veuillez entrer un numéro de transaction valide.");
      return;
    }

    if (!receiptBase64) {
      setError("Le reçu ou la capture d'écran du transfert BaridiMob est obligatoire.");
      return;
    }

    setShowConfirmModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError("");
    if (file) {
      if (file.size > 800000) { // Limit size to ~800KB for Firestore stability
        setError("L'image est trop volumineuse. Veuillez choisir un reçu compressé de moins de 800 Ko.");
        return;
      }
      setReceiptFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaymentSubmit = async () => {
    if (userId === "guest_user" || !userId) {
      setError("Vous devez créer un compte pour finaliser cet achat.");
      return;
    }

    if (!attestChecked) {
      setError("Veuillez cocher la case d'attestation pour confirmer.");
      return;
    }

    setSubmitting(true);
    setError("");
    setShowConfirmModal(false);

    try {
      // 1. Log payment in database
      if (userId !== "guest_user") {
        const paymentId = `PAY-${Date.now()}`;
        const paymentPayload = {
          paymentId,
          userId,
          userEmail: userEmail || "ecom-partenaire@ecom-companion.com",
          amount: AMOUNT,
          senderRip,
          transactionReference: transactionRef,
          receiptImage: receiptBase64 || null,
          status: "pending",
          createdAt: new Date().toISOString()
        };

        try {
          // Write to user subcollection
          await setDoc(doc(db, "users", userId, "baridiMobPayments", paymentId), paymentPayload);
          // Write to globalPayments collection for administration
          await setDoc(doc(db, "globalPayments", paymentId), paymentPayload);
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, `users/${userId}/baridiMobPayments`);
        }
      }

      setSuccess(true);
      // Wait a bit, then trigger callback to close or refresh
      setTimeout(() => {
        onUpgradeSuccess();
      }, 5000);
    } catch (err: any) {
      console.error("Payment submission error:", err);
      setError("Une erreur est survenue lors de l'enregistrement du paiement.");
    } finally {
      setSubmitting(false);
    }
  };

  // If guest mode / not authenticated, render strict auth gate inside the modal
  if (userId === "guest_user" || !userId) {
    return (
      <div className="bg-[#1e293b] border border-white/10 rounded-3xl p-6 md:p-8 max-w-md mx-auto shadow-2xl relative overflow-hidden font-sans z-10 text-center space-y-6">
        <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
          <ShieldCheck className="w-8 h-8 text-blue-400" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white font-display">Connexion Obligatoire</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Pour souscrire à l'offre <strong>Business (4,500 DA / à vie)</strong> et valider votre transaction, vous devez posséder un compte utilisateur.
          </p>
          <p className="text-slate-500 text-xs leading-relaxed">
            Le mode invité/démo ne permet pas l'enregistrement sécurisé et la validation de vos reçus BaridiMob.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={onRequireAuth}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-lg shadow-blue-500/15 cursor-pointer"
          >
            Créer un compte ou se connecter
          </button>
          <button
            onClick={onCancel}
            className="w-full bg-white/5 hover:bg-white/10 text-slate-300 py-2.5 rounded-xl text-xs transition-all cursor-pointer"
          >
            Continuer la visite d'essai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 md:p-8 max-w-2xl mx-auto shadow-2xl relative overflow-hidden font-sans z-10">
      <div className="absolute top-0 right-0 p-4">
        <span className="bg-blue-500/10 text-blue-400 text-xs px-2.5 py-1 rounded-full border border-blue-500/20 font-semibold tracking-wider uppercase">
          Offre Business
        </span>
      </div>

      {success ? (
        <div className="text-center py-12 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20 mb-6 text-blue-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-bold text-white font-display">Reçu envoyé pour validation !</h3>
          <p className="text-slate-400 mt-2 max-w-md">
            Votre transaction de <strong className="text-emerald-400">4,500 DA</strong> a bien été enregistrée sous le numéro <strong className="text-white font-mono">#{transactionRef}</strong>.
          </p>
          <p className="text-slate-500 mt-4 text-xs max-w-sm leading-relaxed">
            L'administrateur va valider votre reçu BaridiMob sous peu pour activer définitivement votre espace Tijara Business. Vous pouvez fermer cette fenêtre.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white font-display flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-blue-400" />
              S'abonner à l'Offre Business
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Activez toutes les fonctionnalités professionnelles pour seulement <span className="text-blue-400 font-semibold">4,500 DA / à vie</span>.
            </p>
          </div>

          {/* Benefits List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 bg-white/5 p-4 rounded-2xl border border-white/5">
            {[
              "Génération de Landing Pages illimitées",
              "Générateur d'images produits via IA",
              "Calculateur de profit avancé & analytiques",
              "Recherche de fournisseurs approfondie (Algérie/Turquie/Chine)",
              "Chat Business avec Coach E-com IA illimité",
              "Support prioritaire & scalabilité rapide"
            ].map((benefit, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Payment instructions */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Instructions BaridiMob</h4>
              
              <div className="p-4 bg-white/5 rounded-2xl space-y-3 text-sm border border-white/5">
                <div>
                  <span className="text-xs text-slate-400 block">RIP Destinataire</span>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="font-mono text-xs text-white tracking-wider select-all">{RECEIVER_RIP}</span>
                    <button
                      onClick={copyRip}
                      className="p-1 hover:bg-white/15 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
                      title="Copier le RIP"
                    >
                      {copied ? <Check className="w-4 h-4 text-blue-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">Nom du compte</span>
                  <span className="text-white font-medium block mt-0.5">{RECEIVER_NAME}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block">Montant requis</span>
                  <span className="text-blue-400 font-bold block text-lg mt-0.5">{AMOUNT} DA</span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-400 bg-blue-500/5 border border-blue-500/10 p-3 rounded-2xl">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p>
                  Transférez le montant via l'application BaridiMob, puis saisissez les informations de transaction ci-contre pour l'activation instantanée.
                </p>
              </div>
            </div>

            {/* Validation Form */}
            <form onSubmit={handleOpenConfirmation} className="space-y-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Formulaire de Validation</h4>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">Votre RIP de compte BaridiMob</label>
                <input
                  type="text"
                  maxLength={20}
                  placeholder="00799999..."
                  value={senderRip}
                  onChange={(e) => setSenderRip(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Numéro ou Référence de Transaction</label>
                <input
                  type="text"
                  placeholder="Ex: 8472912"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Reçu ou capture d'écran <span className="text-red-400 font-bold">(Obligatoire)</span></label>
                <div className="relative border border-dashed border-white/15 rounded-xl p-4 text-center hover:bg-white/5 cursor-pointer transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    required
                  />
                  <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                  <span className="text-xs text-slate-300 block font-semibold">
                    {receiptFileName ? receiptFileName : "Choisir une capture / reçu"}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {receiptBase64 ? "✓ Image prête à l'envoi" : "Fichier PNG ou JPG (Max 800 Ko)"}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium py-2.5 px-4 rounded-xl transition-all text-xs cursor-pointer"
                >
                  Plus tard
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  Valider l'achat
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Confirmation Modal Overlay */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e293b] border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-amber-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Confirmer votre achat</h3>
              <p className="text-slate-400 text-xs mt-1">
                Veuillez confirmer que vous avez effectué le transfert avant de valider votre abonnement.
              </p>
            </div>

            <div className="bg-black/30 rounded-2xl p-4 text-xs space-y-2.5 border border-white/5 font-sans">
              <div className="flex justify-between">
                <span className="text-slate-400">Bénéficiaire :</span>
                <span className="text-white font-medium">{RECEIVER_NAME}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Montant transféré :</span>
                <span className="text-emerald-400 font-bold">{AMOUNT} DA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Votre RIP de départ :</span>
                <span className="text-white font-mono">{senderRip}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Référence de transaction :</span>
                <span className="text-white font-mono">{transactionRef}</span>
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3.5 bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/10 transition-all">
              <input
                type="checkbox"
                checked={attestChecked}
                onChange={(e) => setAttestChecked(e.target.checked)}
                className="mt-0.5 rounded border-white/10 text-blue-600 focus:ring-blue-500 h-4 w-4 bg-black/40"
              />
              <span className="text-[11px] text-slate-300 leading-snug">
                Je confirme sous ma responsabilité avoir transféré exactement <strong>4,500 DA</strong> vers le RIP indiqué et atteste de la véracité de cette capture/référence.
              </span>
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={handlePaymentSubmit}
                disabled={!attestChecked || submitting}
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-500/10 cursor-pointer"
              >
                {submitting ? "Validation..." : "Oui, je confirme"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
