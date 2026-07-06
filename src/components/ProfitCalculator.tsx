import React, { useState, useEffect, useMemo } from "react";
import { db, OperationType, handleFirestoreError } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { DollarSign, Percent, TrendingUp, ShieldAlert, Sparkles, Save, Info, ShoppingBag, CalendarRange } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/95 border border-white/10 backdrop-blur-md p-3.5 rounded-2xl shadow-2xl text-xs space-y-1">
        <p className="text-slate-400 font-bold mb-1.5">{payload[0].payload.day}</p>
        <div className="space-y-1 min-w-[140px]">
          <div className="flex justify-between items-center gap-4">
            <span className="text-cyan-400 font-medium">Revenus:</span>
            <span className="font-bold text-white">{payload[0].value?.toLocaleString()} DA</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-emerald-400 font-medium">Bénéfices:</span>
            <span className="font-bold text-white">{payload[1]?.value?.toLocaleString()} DA</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface ProfitCalculatorProps {
  userId: string;
}

export default function ProfitCalculator({ userId }: ProfitCalculatorProps) {
  const [productName, setProductName] = useState("");
  const [productCost, setProductCost] = useState(1500);
  const [sellingPrice, setSellingPrice] = useState(4500);
  const [deliveryFees, setDeliveryFees] = useState(600);
  const [deliverySuccessRate, setDeliverySuccessRate] = useState(65);
  const [marketingCostPerOrder, setMarketingCostPerOrder] = useState(500);
  const [returnFee, setReturnFee] = useState(250); // Algerian COD return shipping penalty
  const [ordersPerMonth, setOrdersPerMonth] = useState(300);

  // Calculated stats
  const [expectedProfit, setExpectedProfit] = useState(0);
  const [marginPercentage, setMarginPercentage] = useState(0);
  const [roiPercentage, setRoiPercentage] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // 1. Calculate Real shipping cost per delivered package (includes returns)
    const successRateDecimal = deliverySuccessRate / 100;
    const failureRateDecimal = 1 - successRateDecimal;

    // Out of N shipped packages:
    // N * successRateDecimal are delivered. Revenue = N * successRateDecimal * sellingPrice.
    // Product cost = N * successRateDecimal * productCost (returned items go back to inventory).
    // Shipping cost = N * deliveryFees (full shipping paid) + N * failureRateDecimal * returnFee (return penalty).
    // Marketing cost = N * marketingCostPerOrder.
    // Total Shipped Margin = Revenue - Product Cost - Shipping Cost - Marketing Cost.
    // Expected Profit per delivered order: Total Shipped Margin / (N * successRateDecimal).

    const totalRevenue = successRateDecimal * sellingPrice;
    const totalProductCost = successRateDecimal * productCost;
    const totalShippingCost = deliveryFees + (failureRateDecimal * returnFee);
    const totalMarketing = marketingCostPerOrder;

    const netProfitPerShipped = totalRevenue - totalProductCost - totalShippingCost - totalMarketing;
    const profitPerDelivered = successRateDecimal > 0 ? netProfitPerShipped / successRateDecimal : 0;

    setExpectedProfit(Math.round(profitPerDelivered));

    // Margin & ROI
    const margin = sellingPrice > 0 ? (profitPerDelivered / sellingPrice) * 100 : 0;
    setMarginPercentage(Math.round(margin));

    const totalCostPerDelivered = productCost + (totalShippingCost / successRateDecimal) + (totalMarketing / successRateDecimal);
    const roi = totalCostPerDelivered > 0 ? (profitPerDelivered / totalCostPerDelivered) * 100 : 0;
    setRoiPercentage(Math.round(roi));

    // Monthly Profit estimate based on total shipped orders
    const monthlyNet = netProfitPerShipped * ordersPerMonth;
    setMonthlyIncome(Math.round(monthlyNet));
  }, [productCost, sellingPrice, deliveryFees, deliverySuccessRate, marketingCostPerOrder, returnFee, ordersPerMonth]);

  // Generate 30-day projection data for Recharts
  const projectionData = useMemo(() => {
    const dailyShipped = ordersPerMonth / 30;
    const successRateDecimal = deliverySuccessRate / 100;
    const failureRateDecimal = 1 - successRateDecimal;

    const totalRevenuePerShipped = successRateDecimal * sellingPrice;
    const totalProductCost = successRateDecimal * productCost;
    const totalShippingCost = deliveryFees + (failureRateDecimal * returnFee);
    const totalMarketing = marketingCostPerOrder;

    const netProfitPerShipped = totalRevenuePerShipped - totalProductCost - totalShippingCost - totalMarketing;

    const data = [];
    for (let day = 1; day <= 30; day++) {
      const cumulativeShipped = dailyShipped * day;
      const cumulativeDelivered = cumulativeShipped * successRateDecimal;
      const cumulativeRevenue = cumulativeDelivered * sellingPrice;
      const cumulativeProfit = cumulativeShipped * netProfitPerShipped;

      data.push({
        dayIndex: day,
        day: `Jour ${day}`,
        "Revenus": Math.max(0, Math.round(cumulativeRevenue)),
        "Bénéfices": Math.round(cumulativeProfit),
      });
    }
    return data;
  }, [ordersPerMonth, deliverySuccessRate, sellingPrice, productCost, deliveryFees, returnFee, marketingCostPerOrder]);

  const handleSaveCalculation = async () => {
    if (!productName) {
      alert("Veuillez entrer un nom de produit pour sauvegarder.");
      return;
    }
    try {
      if (userId !== "guest_user") {
        try {
          await addDoc(collection(db, "users", userId, "profitCalculations"), {
            calcId: `CALC-${Date.now()}`,
            userId,
            productName,
            productCost,
            sellingPrice,
            deliveryFees,
            deliverySuccessRate,
            marketingCostPerOrder,
            expectedProfit,
            createdAt: new Date().toISOString()
          });
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, `users/${userId}/profitCalculations`);
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la sauvegarde.");
    }
  };

  return (
    <div className="space-y-8 font-sans relative z-10">
      <div>
        <h2 className="text-2xl font-bold text-white font-display flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-400" />
          Calculateur de Profit E-Commerce (Spécial Algérie COD)
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Analysez vos marges réelles en prenant en compte les taux de livraison et les retours colis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Controls */}
        <div className="lg:col-span-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
            <ShoppingBag className="w-5 h-5 text-blue-400" />
            Données de votre Campagne
          </h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Nom du produit</label>
            <input
              type="text"
              placeholder="Ex: Écouteurs Pro 5"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                Prix d'achat (Gros) DA
                <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" title="Le coût d'acquisition d'une seule unité de votre produit" />
              </label>
              <input
                type="number"
                value={productCost}
                onChange={(e) => setProductCost(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                Prix de vente (DA)
                <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" title="Le prix auquel vous vendez le produit au client final" />
              </label>
              <input
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                Frais d'expédition (DA)
                <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" title="Frais de livraison facturés par la compagnie (Yalidine, etc.)" />
              </label>
              <input
                type="number"
                value={deliveryFees}
                onChange={(e) => setDeliveryFees(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                Frais de retour (DA)
                <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" title="Le montant pénalité prélevé par le transporteur si le client refuse le colis (généralement entre 150 DA et 300 DA)" />
              </label>
              <input
                type="number"
                value={returnFee}
                onChange={(e) => setReturnFee(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                Taux de livraison (%)
                <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" title="Le pourcentage de colis expédiés qui sont réellement livrés et payés" />
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={deliverySuccessRate}
                  onChange={(e) => setDeliverySuccessRate(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pr-8 pl-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1 flex items-center gap-1">
                Coût Pub par colis (DA)
                <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" title="Le budget de marketing digital (Facebook, TikTok) dépensé pour obtenir un colis prêt à expédier" />
              </label>
              <input
                type="number"
                value={marketingCostPerOrder}
                onChange={(e) => setMarketingCostPerOrder(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Volume de commandes estimé (Par mois)</label>
            <input
              type="number"
              value={ordersPerMonth}
              onChange={(e) => setOrdersPerMonth(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm transition-all"
            />
          </div>

          <button
            onClick={handleSaveCalculation}
            className="w-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-white font-medium py-2.5 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-2 mt-4"
          >
            <Save className="w-4 h-4 text-blue-400" />
            {saved ? "Calcul Sauvegardé !" : "Sauvegarder ce calcul"}
          </button>
        </div>

        {/* Results display */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-3xl shadow">
              <span className="text-xs text-slate-400 block font-medium">Bénéfice Réel / Commande</span>
              <span className="text-3xl font-bold font-display text-blue-400 block mt-2">
                {expectedProfit.toLocaleString()} DA
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                Taux de retour et pub déduits
              </span>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-3xl shadow">
              <span className="text-xs text-slate-400 block font-medium">Marge Nette</span>
              <span className="text-3xl font-bold font-display text-blue-400 block mt-2">
                {marginPercentage}%
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                Rentabilité par rapport au prix de vente
              </span>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-3xl shadow">
              <span className="text-xs text-slate-400 block font-medium">Retour sur Investissement (ROI)</span>
              <span className="text-3xl font-bold font-display text-blue-400 block mt-2">
                {roiPercentage}%
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                Multiplicateur d'argent investi
              </span>
            </div>
          </div>

          {/* Monthly Forecast Panel */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp className="w-24 h-24 text-blue-400" />
            </div>

            <h3 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              Prévisions Mensuelles estimées
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              <div className="space-y-1">
                <span className="text-xs text-slate-400">Revenu mensuel potentiel</span>
                <span className="text-2xl font-bold text-white block">
                  {Math.round(ordersPerMonth * (deliverySuccessRate / 100) * sellingPrice).toLocaleString()} DA
                </span>
                <span className="text-[10px] text-slate-500">
                  Sur {(ordersPerMonth * (deliverySuccessRate / 100))} livraisons réussies
                </span>
              </div>

              <div className="space-y-1 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                <span className="text-xs text-slate-400">Bénéfice Net Mensuel Réel</span>
                <span className="text-3xl font-bold text-blue-400 block">
                  {monthlyIncome.toLocaleString()} DA
                </span>
                <span className="text-[10px] text-blue-400">
                  Votre bénéfice net réel dans la poche !
                </span>
              </div>
            </div>
          </div>

          {/* 30-Day Growth Projection Chart */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-md font-semibold text-white flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-cyan-400" />
                  Projection de Croissance (30 jours)
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Évolution cumulée des revenus et bénéfices réels
                </p>
              </div>
              
              <div className="flex items-center gap-4 text-[10px] font-semibold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-cyan-400" />
                  <span className="text-cyan-400">Revenus</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-400" />
                  <span className="text-emerald-400">Bénéfices</span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={projectionData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis 
                    dataKey="day" 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                    ticks={["Jour 1", "Jour 5", "Jour 10", "Jour 15", "Jour 20", "Jour 25", "Jour 30"]}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value >= 1000 ? (value / 1000).toLocaleString() + "k" : value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="Revenus" 
                    stroke="#22d3ee" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Bénéfices" 
                    stroke="#34d399" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorProfit)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="text-[11px] text-slate-500 text-center leading-relaxed italic border-t border-white/5 pt-3">
              Hypothèse : Progression linéaire basée sur un volume stable de {(ordersPerMonth / 30).toFixed(1)} commandes/jour avec {deliverySuccessRate}% de livraison réussie.
            </div>
          </div>

          {/* Warning and Guidance Card */}
          <div className={`p-5 rounded-3xl border text-sm flex gap-4 ${
            deliverySuccessRate < 55 
              ? "bg-red-500/5 border-red-500/20 text-red-200" 
              : "bg-blue-500/5 border-blue-500/10 text-blue-200"
          }`}>
            <ShieldAlert className={`w-6 h-6 shrink-0 mt-0.5 ${
              deliverySuccessRate < 55 ? "text-red-400" : "text-blue-400"
            }`} />
            <div>
              <h4 className="font-semibold text-white mb-1">
                {deliverySuccessRate < 55 
                  ? "Attention : Taux de livraison faible !" 
                  : "Structure financière saine"}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {deliverySuccessRate < 55 
                  ? "En Algérie, un taux de livraison inférieur à 55% augmente drastiquement vos coûts logistiques à cause des pénalités de retour colis (250 DA/colis retourné). Améliorez votre confirmation téléphonique ou changez de transporteur."
                  : "Votre taux de livraison de " + deliverySuccessRate + "% vous permet de sécuriser des marges stables. Continuez à optimiser vos coûts publicitaires (viser moins de 500 DA/colis) pour augmenter davantage votre ROI."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
