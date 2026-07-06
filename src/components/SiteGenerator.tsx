import React, { useState } from "react";
import { db, OperationType, handleFirestoreError } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { Sparkles, Image as ImageIcon, Code, Eye, Download, Copy, AlertCircle, RefreshCw, FileText, Globe } from "lucide-react";

interface SiteGeneratorProps {
  userId: string;
  isBusiness: boolean;
  onUpgradePrompt: () => void;
}

export default function SiteGenerator({ userId, isBusiness, onUpgradePrompt }: SiteGeneratorProps) {
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [features, setFeatures] = useState("");
  const [price, setPrice] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [tone, setTone] = useState("premium");
  
  // Image Generation
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImgUrl, setGeneratedImgUrl] = useState("");
  const [generatingImg, setGeneratingImg] = useState(false);

  // URL Sourcing Importer States
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  const handleImportProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl) {
      setImportError("Veuillez saisir une URL de produit.");
      return;
    }
    setImporting(true);
    setImportError("");
    try {
      const res = await fetch("/api/import-product-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl })
      });
      const data = await res.json();
      if (res.ok) {
        setProductName(data.productName || "");
        setPrice(data.price ? String(data.price) : "");
        setProductDesc(data.productDescription || "");
        setFeatures(data.features || "");
        if (data.imagePrompt) {
          setImagePrompt(data.imagePrompt);
        }
        // Let's clear the input and trigger visual confirmation
        setImportUrl("");
      } else {
        setImportError(data.error || "L'importation du produit a échoué.");
      }
    } catch (err: any) {
      console.error(err);
      setImportError("Erreur de connexion lors de l'importation de l'URL.");
    } finally {
      setImporting(false);
    }
  };

  // Site Generation
  const [loading, setLoading] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [error, setError] = useState("");

  const handleGenerateImage = async () => {
    if (!isBusiness) {
      onUpgradePrompt();
      return;
    }
    if (!imagePrompt) {
      setError("Veuillez saisir une description d'image.");
      return;
    }

    setGeneratingImg(true);
    setError("");
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt })
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedImgUrl(data.imageUrl);
      } else {
        setError(data.error || "La génération d'image a échoué.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de la connexion au serveur d'images.");
    } finally {
      setGeneratingImg(false);
    }
  };

  const handleGenerateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || !price) {
      setError("Le nom du produit et le prix sont requis.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Modify features description to include generated image if present
      let finalFeatures = features;
      if (generatedImgUrl) {
        finalFeatures = `Note for page template: Please use this exact product image URL inside the hero/product section: "${generatedImgUrl}".\n\n` + finalFeatures;
      }

      const res = await fetch("/api/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          productDescription: productDesc,
          features: finalFeatures,
          price: parseFloat(price),
          businessName,
          tone
        })
      });

      const data = await res.json();
      if (res.ok) {
        setGeneratedHtml(data.html);

        // Save to Firebase
        if (userId !== "guest_user") {
          try {
            await addDoc(collection(db, "users", userId, "productSites"), {
              siteId: `SITE-${Date.now()}`,
              userId,
              productName,
              productDescription: productDesc,
              features: finalFeatures,
              price: parseFloat(price),
              slug: productName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              imageUrl: generatedImgUrl || "",
              generatedHtml: data.html,
              createdAt: new Date().toISOString()
            });
          } catch (e) {
            handleFirestoreError(e, OperationType.CREATE, `users/${userId}/productSites`);
          }
        }
      } else {
        setError(data.error || "La génération de la landing page a échoué.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Erreur de connexion lors de la génération de la page.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedHtml);
    alert("Code copié dans le presse-papier !");
  };

  const handleDownload = () => {
    const blob = new Blob([generatedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${productName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-landing.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 font-sans relative z-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white font-display flex items-center gap-2">
            <Globe className="w-6 h-6 text-blue-400" />
            Générateur de Landing Pages IA
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Concevez une page web produit de qualité professionnelle optimisée pour les ventes en Algérie.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Editor Form */}
        <div className="lg:col-span-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
          
          {/* Direct Product Importer */}
          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <div>
                <h4 className="text-xs font-semibold text-white">Importation Directe depuis URL</h4>
                <p className="text-[10px] text-slate-400">Copiez-collez un lien de produit pour auto-remplir instantanément la fiche</p>
              </div>
            </div>

            {importError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-300 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            <form onSubmit={handleImportProduct} className="flex gap-2">
              <input
                type="url"
                placeholder="Lien Alibaba, AliExpress, Amazon..."
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs transition-all"
              />
              <button
                type="submit"
                disabled={importing}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 text-white font-semibold px-3.5 py-2 rounded-xl transition-all text-xs flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    En cours...
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3" />
                    Importer
                  </>
                )}
              </button>
            </form>
          </div>

          <form onSubmit={handleGenerateSite} className="space-y-4">
            <h3 className="text-md font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Caractéristiques du produit
            </h3>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nom du produit</label>
                <input
                  type="text"
                  placeholder="Ex: Écouteurs Pro 5"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Prix (DA)</label>
                <input
                  type="number"
                  placeholder="Ex: 4500"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nom de la boutique</label>
                <input
                  type="text"
                  placeholder="Ex: DZ Shop"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Ton d'écriture</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
                >
                  <option value="premium">Premium & Élégant</option>
                  <option value="persuasive">Persuasif & Direct</option>
                  <option value="funny">Amical & Amusant</option>
                  <option value="urgent">Urgence (Offre limitée)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Description courte du produit</label>
              <textarea
                rows={3}
                placeholder="Décrivez les avantages principaux du produit..."
                value={productDesc}
                onChange={(e) => setProductDesc(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Fonctionnalités clés (Une par ligne)</label>
              <textarea
                rows={3}
                placeholder="Ex: Autonomie de 24h&#10;Réduction de bruit active&#10;Livraison rapide sur 58 Wilayas"
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:scale-[1.01] flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Génération de la page en cours...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Générer le site web complet
                </>
              )}
            </button>
          </form>

          {/* Image generation section */}
          <div className="border-t border-white/10 pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-400" />
              Générateur d'images de produit
              {!isBusiness && (
                <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-normal uppercase">
                  Premium
                </span>
              )}
            </h3>
            
            <p className="text-slate-400 text-xs">
              Générez une superbe illustration ou photo de produit via IA pour l'intégrer automatiquement sur votre page.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Écouteurs sans fil noirs sur un socle en marbre..."
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                disabled={generatingImg}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
              />
              <button
                onClick={handleGenerateImage}
                disabled={generatingImg}
                className="bg-white/10 hover:bg-white/20 border border-white/10 text-white font-medium px-4 rounded-xl transition-all text-xs shrink-0 flex items-center gap-2 cursor-pointer"
              >
                {generatingImg ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Créer"}
              </button>
            </div>

            {generatedImgUrl && (
              <div className="relative rounded-xl overflow-hidden border border-white/10 bg-white/5 p-2">
                <img
                  src={generatedImgUrl}
                  alt="Aperçu de l'image générée"
                  className="rounded-lg max-h-48 w-full object-cover"
                />
                <span className="absolute bottom-4 left-4 bg-slate-950/80 text-white text-[10px] px-2 py-0.5 rounded border border-white/10">
                  Prête pour votre landing page !
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Preview & Code Panel */}
        <div className="lg:col-span-7 flex flex-col bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-xl min-h-[500px]">
          {generatedHtml ? (
            <>
              {/* Header with tabs and action buttons */}
              <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl w-fit border border-white/10">
                  <button
                    onClick={() => setActiveTab("preview")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === "preview" ? "bg-white/15 text-blue-400 shadow" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    Aperçu Direct
                  </button>
                  <button
                    onClick={() => setActiveTab("code")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === "code" ? "bg-white/15 text-blue-400 shadow" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Code className="w-4 h-4" />
                    Code Source
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center justify-center p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl transition-all text-xs gap-1.5 cursor-pointer"
                    title="Copier le code"
                  >
                    <Copy className="w-4 h-4" />
                    <span className="hidden sm:inline">Copier</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center justify-center p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-all text-xs gap-1.5 cursor-pointer shadow-lg shadow-blue-500/20"
                    title="Télécharger index.html"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger</span>
                  </button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 bg-slate-900 relative">
                {activeTab === "preview" ? (
                  <iframe
                    title="Live Preview"
                    srcDoc={generatedHtml}
                    className="w-full h-full min-h-[550px] border-none bg-white"
                    sandbox="allow-scripts"
                  />
                ) : (
                  <pre className="w-full h-full min-h-[550px] overflow-auto p-6 font-mono text-xs text-slate-300 bg-slate-950 whitespace-pre-wrap select-all">
                    {generatedHtml}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <Globe className="w-16 h-16 text-slate-700 mb-4" />
              <p className="font-semibold text-slate-400">Aucun site généré</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Remplissez les caractéristiques du produit à gauche et cliquez sur "Générer le site web complet" pour concevoir votre landing page instantanément.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
