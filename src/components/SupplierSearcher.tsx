import React, { useState } from "react";
import { db, OperationType, handleFirestoreError } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { Search, MapPin, Loader, Info, Copy, Check, FileText, Globe, Phone, Mail, AlertCircle, MessageCircle, ExternalLink, ShoppingBag, Tag, Star } from "lucide-react";

interface SupplierSearcherProps {
  userId: string;
  isBusiness: boolean;
  onUpgradePrompt: () => void;
}

// Simple and safe custom Markdown-to-HTML parser helper for styled results
function renderSimpleMarkdown(markdown: string) {
  if (!markdown) return null;
  const lines = markdown.split("\n");

  return lines.map((line, idx) => {
    // Headers
    if (line.startsWith("### ")) {
      return (
        <h4 key={idx} className="text-sm font-bold text-white mt-4 mb-2 font-display flex items-center gap-1">
          {line.replace("### ", "")}
        </h4>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h3 key={idx} className="text-md font-bold text-emerald-400 mt-6 mb-3 font-display border-b border-slate-700 pb-1">
          {line.replace("## ", "")}
        </h3>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <h2 key={idx} className="text-lg font-bold text-white mt-6 mb-4 font-display">
          {line.replace("# ", "")}
        </h2>
      );
    }

    // Bold text replacements
    let content: React.ReactNode = line;
    const boldRegex = /\*\*(.*?)\*\*/g;
    if (boldRegex.test(line)) {
      const parts = line.split(boldRegex);
      content = parts.map((part, pIdx) => (pIdx % 2 === 1 ? <strong key={pIdx} className="text-emerald-300 font-semibold">{part}</strong> : part));
    }

    // Lists
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const listContent = line.trim().replace(/^[-*]\s+/, "");
      // Re-apply bold styling inside list
      let itemContent: React.ReactNode = listContent;
      if (boldRegex.test(listContent)) {
        const parts = listContent.split(boldRegex);
        itemContent = parts.map((part, pIdx) => (pIdx % 2 === 1 ? <strong key={pIdx} className="text-emerald-300 font-semibold">{part}</strong> : part));
      }
      return (
        <ul key={idx} className="list-disc list-inside text-xs text-slate-300 ml-4 space-y-1 my-1">
          <li>{itemContent}</li>
        </ul>
      );
    }

    // Tables
    if (line.includes("|") && !line.includes("---")) {
      const cells = line.split("|").map(c => c.trim()).filter(Boolean);
      if (cells.length > 0) {
        return (
          <div key={idx} className="overflow-x-auto my-1">
            <table className="min-w-full divide-y divide-slate-700 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <tbody>
                <tr className="hover:bg-slate-800/30">
                  {cells.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2 text-xs text-slate-300 border-r border-slate-700/50 last:border-0 font-medium">
                      {cell}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        );
      }
    }

    // Blank line
    if (line.trim() === "") {
      return <div key={idx} className="h-2" />;
    }

    // Regular Paragraph
    return (
      <p key={idx} className="text-xs text-slate-300 leading-relaxed my-1.5">
        {content}
      </p>
    );
  });
}

interface DirectSupplier {
  id: string;
  name: string;
  category: string;
  location: string;
  specialty: string;
  whatsapp: string;
  website: string;
  moq: string;
  shippingAgent: string;
  rating: number;
}

const CHINESE_SUPPLIERS: DirectSupplier[] = [
  {
    id: "sup-1",
    name: "Guangzhou Sourcing Express",
    category: "Mode & Vêtements",
    location: "Guangzhou, Chine",
    specialty: "Vêtements de sport, pulls, vestes, jeans, répliques de qualité supérieure, sacs et sneakers de sport.",
    whatsapp: "+8613427514844",
    website: "https://www.alibaba.com",
    moq: "30 pièces minimum",
    shippingAgent: "Double dédouanement avec livraison sécurisée via cargo direct vers l'Algérie.",
    rating: 5
  },
  {
    id: "sup-2",
    name: "Shenzhen SmartTech Wholesaler",
    category: "Électronique & Gadgets",
    location: "Shenzhen, Chine",
    specialty: "Montres intelligentes, écouteurs sans fil, chargeurs magnétiques, batteries externes, caméras connectées.",
    whatsapp: "+8618682135678",
    website: "https://www.alibaba.com",
    moq: "10 pièces minimum",
    shippingAgent: "Livraison Air Cargo rapide, transitaires agréés.",
    rating: 5
  },
  {
    id: "sup-3",
    name: "Yiwu Toy & Trend Co. Ltd.",
    category: "Gadgets & Jouets",
    location: "Yiwu, Chine",
    specialty: "Jouets éducatifs, puzzles 3D, veilleuses LED pour enfants, petits cadeaux, produits viraux TikTok.",
    whatsapp: "+8615958931122",
    website: "https://www.alibaba.com",
    moq: "200$ d'achat global",
    shippingAgent: "Service d'agent d'achat à Yiwu (Sourcing, inspection de qualité et groupage maritime).",
    rating: 4.8
  },
  {
    id: "sup-4",
    name: "Zhejiang BioCosmetics Factory",
    category: "Beauté & Cosmétiques",
    location: "Zhejiang, Chine",
    specialty: "Flacons vides de parfum, rouges à lèvres, fards à paupières, masques faciaux, accessoires de maquillage.",
    whatsapp: "+8613758293344",
    website: "https://www.alibaba.com",
    moq: "50 pièces minimum",
    shippingAgent: "Dédouanement spécial pour liquides, crèmes et poudres.",
    rating: 4.9
  },
  {
    id: "sup-5",
    name: "Ningbo Kitchenware & Home Decor",
    category: "Maison & Cuisine",
    location: "Ningbo, Chine",
    specialty: "Ustensiles de cuisine multifonctions, gourdes isothermes, boîtes hermétiques de rangement, déco moderne.",
    whatsapp: "+8615867822990",
    website: "https://www.alibaba.com",
    moq: "100 pièces minimum",
    shippingAgent: "Idéal pour groupage maritime LCL (Frais partagés).",
    rating: 4.7
  },
  {
    id: "sup-6",
    name: "Guangdong Bags & Travel Gear",
    category: "Mode & Vêtements",
    location: "Guangzhou, Chine",
    specialty: "Sacs de voyage, sacs à dos scolaires, pochettes tactiques, portefeuilles élégants, ceintures en cuir.",
    whatsapp: "+8613922485577",
    website: "https://www.alibaba.com",
    moq: "20 pièces",
    shippingAgent: "Dépôt direct gratuit chez votre transitaire à Guangzhou.",
    rating: 4.8
  },
  {
    id: "sup-7",
    name: "Foshan LED Lighting Solutions",
    category: "Maison & Cuisine",
    location: "Foshan, Chine",
    specialty: "Projecteurs solaires extérieurs LED, rubans LED connectés, lampes rechargeables de table, lustres déco.",
    whatsapp: "+8613535492211",
    website: "https://www.alibaba.com",
    moq: "30 pièces",
    shippingAgent: "Double dédouanement avec livraison à domicile sur 58 Wilayas.",
    rating: 5
  },
  {
    id: "sup-8",
    name: "Quanzhou Sportswear & Sneakers Factory",
    category: "Mode & Vêtements",
    location: "Quanzhou, Chine",
    specialty: "Survêtements d'entraînement, maillots de foot officiels génériques, baskets respirantes.",
    whatsapp: "+8615980556633",
    website: "https://www.alibaba.com",
    moq: "24 paires / pièces",
    shippingAgent: "Envoi rapide Express par Air ou Cargo maritime de confiance.",
    rating: 4.9
  }
];

export default function SupplierSearcher({ userId, isBusiness, onUpgradePrompt }: SupplierSearcherProps) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("Algérie, Hamiz, El Eulma");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // Premium Custom WhatsApp Directory States
  const [searchTab, setSearchTab] = useState<"ai-search" | "direct-suppliers">("ai-search");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBusiness) {
      onUpgradePrompt();
      return;
    }
    if (!query) {
      setError("Veuillez saisir un produit ou domaine.");
      return;
    }

    setLoading(true);
    setError("");
    setResults("");
    try {
      const res = await fetch("/api/supplier-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, region })
      });
      const data = await res.json();
      if (res.ok) {
        setResults(data.results);

        // Save search history
        if (userId !== "guest_user") {
          try {
            await addDoc(collection(db, "users", userId, "supplierSearches"), {
              searchId: `SRCH-${Date.now()}`,
              userId,
              query,
              results: data.results,
              createdAt: new Date().toISOString()
            });
          } catch (e) {
            handleFirestoreError(e, OperationType.CREATE, `users/${userId}/supplierSearches`);
          }
        }
      } else {
        setError(data.error || "La recherche de fournisseurs a échoué.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Erreur de connexion lors de la recherche des grossistes.");
    } finally {
      setLoading(false);
    }
  };

  const copyResults = () => {
    navigator.clipboard.writeText(results);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredSuppliers = CHINESE_SUPPLIERS.filter(supplier => {
    const matchesCategory = selectedCategory === "Tous" || supplier.category === selectedCategory;
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          supplier.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          supplier.location.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8 font-sans relative z-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white font-display flex items-center gap-2">
            <Search className="w-6 h-6 text-blue-400" />
            Centre de Sourcing & Grossistes
            {!isBusiness && (
              <span className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-normal uppercase">
                Premium
              </span>
            )}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Recherchez en direct sur le web avec l'IA ou contactez nos grossistes d'importation certifiés sur WhatsApp.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 pb-px">
        <button
          onClick={() => setSearchTab("ai-search")}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            searchTab === "ai-search"
              ? "text-blue-400 border-blue-500 font-bold"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <Search className="w-4 h-4 text-blue-400" />
          Recherche IA (Google Grounding)
        </button>
        <button
          onClick={() => setSearchTab("direct-suppliers")}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            searchTab === "direct-suppliers"
              ? "text-emerald-400 border-emerald-500 font-bold"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <MessageCircle className="w-4 h-4 text-emerald-400 animate-pulse" />
          Grossistes Directs Chine (WhatsApp)
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium tracking-wide">
            TOP
          </span>
        </button>
      </div>

      {searchTab === "ai-search" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls block */}
          <div className="lg:col-span-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl h-fit">
            <form onSubmit={handleSearch} className="space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                Critères de Sourcing
              </h3>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">Quel produit cherchez-vous ?</label>
                <input
                  type="text"
                  placeholder="Ex: Vêtements bébés gros, Cosmétiques bio"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Région / Origine privilégiée</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
                >
                  <option value="Algérie, Hamiz, El Eulma">Algérie (Hamiz, Belfort, El Eulma, local)</option>
                  <option value="Chine, Alibaba, 1688">Chine (Importation, Alibaba, 1688)</option>
                  <option value="Turquie, Istanbul (Laleli, Merter)">Turquie (Istanbul, Laleli, Merter)</option>
                  <option value="Mixte (Local et Importation)">Sourcing Global (Algérie + Chine + Turquie)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:scale-[1.01] flex items-center justify-center gap-2 text-sm mt-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Sourcing en cours...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Lancer la recherche profonde
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 bg-white/5 p-4 rounded-2xl border border-white/5 text-xs text-slate-400 space-y-2">
              <div className="flex gap-2 items-start">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p>
                  Cette fonctionnalité utilise le **Google Search Grounding** pour analyser le web en temps réel et extraire des contacts de grossistes algériens et internationaux récents.
                </p>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-xl min-h-[400px] flex flex-col">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <Loader className="w-12 h-12 text-blue-400 animate-spin mb-4" />
                <h4 className="font-semibold text-white animate-pulse">Analyse des bases de données de fournisseurs...</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Nous interrogeons les annuaires de gros de Hamiz, El Eulma et les circuits d'importation de Chine et Turquie en temps réel.
                </p>
              </div>
            ) : results ? (
              <>
                {/* Results Action Header */}
                <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    Rapport de Sourcing Suggéré
                  </span>
                  <button
                    onClick={copyResults}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 text-xs text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-blue-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copié !" : "Copier le rapport"}
                  </button>
                </div>

                {/* Main styled markdown display */}
                <div className="flex-1 p-6 md:p-8 overflow-y-auto space-y-2 bg-black/20">
                  {renderSimpleMarkdown(results)}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                <Globe className="w-16 h-16 text-slate-700 mb-4" />
                <p className="font-semibold text-slate-400">Aucun rapport disponible</p>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Lancer une recherche de grossistes à gauche pour obtenir un rapport détaillé avec les contacts de fournisseurs en direct.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Brand New Premium WhatsApp Chinese Directory Tab */
        <div className="space-y-6">
          {/* Search and Category Filters */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white/5 p-4 rounded-2xl border border-white/10">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher par nom ou spécialité..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs transition-all"
              />
            </div>

            {/* Categories */}
            <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
              {["Tous", "Électronique & Gadgets", "Mode & Vêtements", "Beauté & Cosmétiques", "Maison & Cuisine", "Gadgets & Jouets"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-white/5 text-slate-400 border border-transparent hover:text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Supplier Grid Display */}
          {filteredSuppliers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-emerald-500/30 transition-all flex flex-col justify-between group shadow-lg"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {supplier.name}
                      </h4>
                      <div className="flex items-center text-amber-400 text-xs gap-0.5 font-bold">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{supplier.rating.toFixed(1)}</span>
                      </div>
                    </div>

                    {/* Meta info row */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/10 flex items-center gap-1 font-medium">
                        <Tag className="w-3 h-3" />
                        {supplier.category}
                      </span>
                      <span className="text-[10px] bg-slate-500/10 text-slate-300 px-2 py-0.5 rounded-full border border-slate-500/10 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {supplier.location}
                      </span>
                    </div>

                    {/* Specialties description */}
                    <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
                      {supplier.specialty}
                    </p>

                    {/* Divider */}
                    <div className="border-t border-white/5 my-2 pt-2 space-y-1.5">
                      {/* MOQ */}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <ShoppingBag className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span>MOQ : <strong className="text-slate-200">{supplier.moq}</strong></span>
                      </div>
                      {/* Shipping Agent */}
                      <div className="flex items-start gap-2 text-[10px] text-slate-400">
                        <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">Transit : <strong className="text-slate-200">{supplier.shippingAgent}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-2 border-t border-white/5">
                    <a
                      href={`https://wa.me/${supplier.whatsapp.replace(/\+/g, "").replace(/\s/g, "")}?text=Bonjour%20je%20viens%20de%20la%20plateforme%20E-Com%20Companion%20Alg%C3%A9rie,%20je%20suis%20e-commer%C3%A7ant%20et%20je%20souhaite%20travailler%20avec%20vous.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-[11px] transition-all cursor-pointer shadow-md shadow-emerald-600/10"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp Direct
                    </a>
                    <a
                      href={supplier.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-lg text-[11px] transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Visiter Site
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-slate-500 max-w-lg mx-auto">
              <Search className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-400">Aucun grossiste trouvé</p>
              <p className="text-xs text-slate-500 mt-1">
                Aucun fournisseur ne correspond à vos critères actuels de recherche. Essayez d'autres mots-clés ou modifiez les filtres de catégories.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
