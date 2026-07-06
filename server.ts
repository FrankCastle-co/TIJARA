import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limit for base64 image uploads or large HTML pages
app.use(express.json({ limit: "20mb" }));

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err);
  }
} else {
  console.warn("GEMINI_API_KEY is not configured or is placeholder. AI capabilities will be simulated.");
}

// Helper to get active AI client
function getAI(): GoogleGenAI {
  if (!ai) {
    throw new Error("Gemini API key is not configured. Please set your GEMINI_API_KEY in the Secrets panel.");
  }
  return ai;
}

// --- API ENDPOINTS ---

// 1. Landing Page Generator
app.post("/api/generate-page", async (req, res) => {
  try {
    const { productName, productDescription, features, price, businessName, tone } = req.body;
    
    if (!productName || !price) {
      return res.status(400).json({ error: "Product name and price are required." });
    }

    const client = getAI();
    const prompt = `
      You are an elite conversion rate optimization (CRO) landing page designer and copywriter.
      Generate a single-file, highly-styled, modern, mobile-responsive Shopify-style landing page for this product:
      - Product Name: ${productName}
      - Price: ${price} DA
      - Description: ${productDescription || "Not provided"}
      - Key Features: ${features || "Not provided"}
      - Business/Store Name: ${businessName || "Mon E-Commerce"}
      - Tone: ${tone || "Professional and persuasive"}

      The page MUST be entirely self-contained (HTML + CSS + JS).
      Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
      Use Lucide Icons (or standard FontAwesome via CDN or modern SVG icons) to make it visually spectacular.
      Include the following sections:
      1. Elegant Header with Store Name, CTA buttons, and a banner alert (e.g., "Livraison gratuite sur 58 Wilayas!" or similar).
      2. High-converting Hero section with product title, persuasive subtitle, badge, price, CTA buttons, delivery badges, and a space/container for a beautiful product image.
      3. Product features section using grid layouts, icons, and scannable benefits.
      4. Interactive Profit/Calculateur simulation or Pricing packages.
      5. Customer reviews/testimonials with avatars, stars, and verified buyer tags.
      6. "Order Now" persistent checkout form optimized for Cash on Delivery (COD) in Algeria (fields: Name, Phone, Wilaya, Address) with nice interactive inputs.
      7. Modern footer.

      Aesthetics & Design Guidelines:
      - Use a stunning professional color scheme (e.g. elegant slate, rich indigo, deep emerald, or amber accents).
      - Make sure the font is modern (e.g. Inter or Outfit via Google Fonts).
      - The design must have generous padding, beautiful rounded-xl margins, and smooth transition animations on buttons (hover:scale-105 transition-all).
      - Add simple interactive client-side JavaScript for the Wilaya selector and instant price calculation (e.g. if shipping is 600 DA, total price updates automatically in the checkout section).
      - Translate all visitor-facing text to French or Arabic (Algerian dialect/Standard Arabic suitable for Algerian e-commerce), since the product is sold in Algeria. Keep the main structure in French as it's the standard for Algerian e-commerce landing pages.

      IMPORTANT: Return ONLY the raw HTML code inside your response. Do not wrap the code in markdown code blocks like \`\`\`html ... \`\`\`. Your response must start with <!DOCTYPE html> and end with </html>.
    `;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    let html = response.text || "";
    // Clean markdown code block if model ignored the rule
    html = html.replace(/^```html\s*/i, "").replace(/```\s*$/i, "").trim();

    res.json({ html });
  } catch (error: any) {
    console.error("Error generating landing page:", error);
    const isQuota = error.message?.toLowerCase().includes("quota") || 
                    error.message?.includes("429") || 
                    error.message?.includes("RESOURCE_EXHAUSTED");
    if (isQuota) {
      return res.status(429).json({ 
        error: "Le quota de requêtes de l'IA pour la génération de page est temporairement saturé. Veuillez patienter une minute puis réessayer, ou configurez votre clé API Gemini personnelle dans le panneau de Secrets." 
      });
    }
    res.status(500).json({ error: error.message || "An error occurred during page generation." });
  }
});

// 2. Deep Supplier Search with Google Search Grounding
app.post("/api/supplier-search", async (req, res) => {
  try {
    const { query, region } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: "Search query is required." });
    }

    const client = getAI();
    const prompt = `
      Vous êtes un analyste de chaîne d'approvisionnement expert.
      Effectuez une recherche profonde de fournisseurs pour le produit ou la catégorie suivante : "${query}".
      Région privilégiée : ${region || "Algérie, Chine (Alibaba, Yiwu), Turquie"}.

      Donnez des informations réelles, à jour et exploitables grâce à vos outils de recherche.
      Votre rapport doit inclure :
      1. Les marchés de gros populaires en Algérie où l'on trouve ce produit (ex: Hamiz, El Eulma, Ain M'lila, etc. si pertinent).
      2. Des exemples de fournisseurs potentiels ou d'agents d'importation avec leurs coordonnées réelles ou types de contact (numéros de téléphone, pages Facebook/Instagram de grossistes en Algérie, sites web de grossistes).
      3. Une liste de plateformes internationales (Alibaba, Taobao, 1688) avec des astuces d'importation spécifiques à l'Algérie (douanes, transporteurs d'importation dits "transitaires" ou "cabine").
      4. Un comparatif des coûts estimatifs d'achat au gros vs prix de vente au détail moyen en Algérie.
      5. Des conseils de négociation avec ces fournisseurs.

      Format de sortie : Utilisez un format Markdown élégant avec des titres clairs, des icônes, des listes à puces et des tableaux. Soyez le plus précis possible.
    `;

    let responseText = "";
    try {
      // Perform generation with googleSearch tool enabled
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      responseText = response.text || "";
    } catch (searchError: any) {
      console.warn("Google Search Grounding failed, falling back to standard generation:", searchError);
      
      const isQuotaOr429 = searchError.message?.toLowerCase().includes("quota") || 
                           searchError.message?.includes("429") || 
                           searchError.message?.includes("RESOURCE_EXHAUSTED");

      if (isQuotaOr429) {
        // Fall back to standard model call without Google Search tool
        try {
          const fallbackResponse = await client.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt + "\n\n(Note pour le modèle: La recherche web en direct n'étant pas disponible à cause des quotas actuels, veuillez fournir votre meilleur rapport complet sur la base de vos connaissances acquises sur le marché algérien et l'importation de ce produit.)"
          });
          responseText = fallbackResponse.text || "";
        } catch (fallbackError: any) {
          console.error("Fallback generation also failed:", fallbackError);
          throw fallbackError;
        }
      } else {
        throw searchError;
      }
    }

    res.json({ results: responseText });
  } catch (error: any) {
    console.error("Error searching suppliers:", error);
    const isQuota = error.message?.toLowerCase().includes("quota") || 
                    error.message?.includes("429") || 
                    error.message?.includes("RESOURCE_EXHAUSTED");
    if (isQuota) {
      return res.status(429).json({ 
        error: "Le quota de requêtes de l'IA pour la recherche est temporairement saturé. Veuillez patienter quelques minutes avant de réessayer, ou configurez votre propre clé API Gemini personnelle dans le panneau Paramètres > Secrets." 
      });
    }
    res.status(500).json({ error: error.message || "An error occurred during supplier search." });
  }
});

// 3. Image Generator for Products
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, aspectRatio } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const client = getAI();
    const response = await client.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: {
        parts: [
          {
            text: `High quality e-commerce product mockup illustration or clean commercial advertising photo of: ${prompt}. Studio lighting, clean product photography style, isolated background, premium visual look.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio || "1:1",
          imageSize: "1K"
        }
      }
    });

    let imageUrl = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          imageUrl = `data:image/png;base64,${base64EncodeString}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      // Fallback placeholder image if no image data returned
      imageUrl = `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=60`;
    }

    res.json({ imageUrl });
  } catch (error: any) {
    console.error("Error generating image:", error);
    const isQuota = error.message?.toLowerCase().includes("quota") || 
                    error.message?.includes("429") || 
                    error.message?.includes("RESOURCE_EXHAUSTED");
    if (isQuota) {
      return res.status(429).json({ 
        error: "Le quota de l'IA pour la génération d'images est saturé. Veuillez réessayer dans quelques minutes ou configurer votre clé API Gemini personnelle dans le panneau de Secrets." 
      });
    }
    res.status(500).json({ error: error.message || "An error occurred during image generation." });
  }
});

// 4. Business Coach Chatbot
app.post("/api/chat-coach", async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required." });
    }

    const client = getAI();
    
    // Set up role instructions for the AI Coach
    const systemInstruction = `
      Vous êtes "E-Com Coach", un conseiller d'affaires IA d'élite spécialisé dans le marché e-commerce en Algérie (ventes en ligne, livraison à domicile avec Yalidine, ZR Express, Baridimob, sourcing local de produits au Hamiz, Belfort, El Eulma, et importation).
      Votre rôle est d'aider les e-commerçants à réussir, augmenter leurs ventes, négocier avec les fournisseurs et optimiser leurs publicités (Facebook Ads, TikTok Ads).
      Donnez des conseils pratiques, réalistes, adaptés au marché algérien et chiffrez les exemples en Dinars Algériens (DA).
      Soyez encourageant, professionnel et très instructif.
    `;

    // Convert message history to the format required by the SDK
    const formattedContents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: systemInstruction
      }
    });

    res.json({ response: response.text });
  } catch (error: any) {
    console.error("Error in chat coach:", error);
    const isQuota = error.message?.toLowerCase().includes("quota") || 
                    error.message?.includes("429") || 
                    error.message?.includes("RESOURCE_EXHAUSTED");
    if (isQuota) {
      return res.status(429).json({ 
        error: "Le quota de conversation avec le coach IA est temporairement saturé. Veuillez patienter quelques instants ou configurer votre clé API Gemini personnelle dans le panneau de Secrets." 
      });
    }
    res.status(500).json({ error: error.message || "An error occurred during chat coaching." });
  }
});


// 5. Product Import from Alibaba, AliExpress, Amazon URL
app.post("/api/import-product-url", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "L'URL du produit est requise." });
    }

    const lowerUrl = url.toLowerCase();
    const isAlibaba = lowerUrl.includes("alibaba.com");
    const isAliExpress = lowerUrl.includes("aliexpress.com") || lowerUrl.includes("aliexpress.ru");
    const isAmazon = lowerUrl.includes("amazon.com") || lowerUrl.includes("amazon.fr") || lowerUrl.includes("amazon.ae") || lowerUrl.includes("amazon.co.uk");

    if (!isAlibaba && !isAliExpress && !isAmazon) {
      return res.status(400).json({ 
        error: "URL non supportée. Veuillez insérer un lien direct de produit valide provenant d'Alibaba, AliExpress, ou Amazon." 
      });
    }

    const platformName = isAlibaba ? "Alibaba" : isAliExpress ? "AliExpress" : "Amazon";

    // Extract any keywords from the URL slug/pathname to guide the AI model
    let urlSlugInfo = "";
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const parts = pathname.split(/[/-]+/).filter(p => p.length > 3 && !p.endsWith(".html") && isNaN(Number(p)));
      if (parts.length > 0) {
        urlSlugInfo = parts.join(" ");
      }
    } catch (e) {
      console.warn("Could not extract slug info:", e);
    }

    const client = getAI();
    const prompt = `
      Vous êtes un spécialiste chevronné de l'importation de produits et du e-commerce (notamment du Sourcing en Chine/International pour revendre en Algérie).
      L'utilisateur souhaite importer les détails d'un produit depuis cette URL de la plateforme ${platformName} :
      - URL : ${url}
      - Mots clés détectés : ${urlSlugInfo || "Inconnus"}

      Votre tâche est d'analyser ou de rechercher ce produit sur internet (en utilisant la recherche Google en direct s'il le faut) et de structurer des informations commerciales ultra-vendeuses et complètes adaptées au marché algérien.

      Veuillez générer et renvoyer UNIQUEMENT un objet JSON valide contenant les clés suivantes :
      1. "productName" : Un nom de produit court, percutant et vendeur en français (ex: "Projecteur LED Home Cinéma Ultra-HD").
      2. "price" : Un prix estimé de revente en Algérie en Dinars Algériens (DA). Calculez cela sur la base d'une revente avec une marge saine (ex: si le produit coûte $10 à $20, son prix de revente en Algérie est d'environ 3500 à 5900 DA). Renvoyez uniquement un nombre entier (ex: 4500).
      3. "productDescription" : Une description produit en français de 3 à 4 phrases maximum, rédigée dans un style très persuasif (copywriting pro), qui insiste sur le problème résolu et les avantages pour un acheteur en Algérie.
      4. "features" : 3 à 5 caractéristiques clés majeures du produit, écrites chacune sur une nouvelle ligne (pas de puces ni de tirets en début de ligne), idéales pour être affichées sous forme de puces (ex: "Qualité d'image 4K native\\nBatterie longue autonomie 8 heures\\nFormat ultra-léger et transportable").
      5. "imagePrompt" : Un prompt ultra-détaillé et professionnel en anglais pour générer une magnifique image studio publicitaire 3D de ce produit (ex: "A high-end modern portable video projector on a clean wooden table, warm ambient studio lighting, soft shadow, ultra realistic 3D render, 8k resolution").

      ATTENTION : Votre réponse doit être STRICTEMENT du JSON valide, sans aucune phrase d'introduction ou de conclusion, et sans bloc de code markdown. Commencez par { et finissez par }.
    `;

    let responseText = "";
    try {
      // Use search grounding to fetch the URL or look up details
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });
      responseText = response.text || "";
    } catch (searchError: any) {
      console.warn("Grounding failed during import, falling back to basic content generation:", searchError);
      try {
        const fallbackResponse = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt + "\n\n(Note : La recherche web est momentanément désactivée, faites de votre mieux pour déduire l'article d'après les mots clés.)",
          config: {
            responseMimeType: "application/json"
          }
        });
        responseText = fallbackResponse.text || "";
      } catch (fallbackError: any) {
        console.error("All AI generation pathways failed for import:", fallbackError);
        throw fallbackError;
      }
    }

    // Attempt to parse JSON response
    let parsedData;
    try {
      let cleanedJson = responseText.trim();
      if (cleanedJson.startsWith("```json")) {
        cleanedJson = cleanedJson.substring(7);
      }
      if (cleanedJson.endsWith("```")) {
        cleanedJson = cleanedJson.substring(0, cleanedJson.length - 3);
      }
      parsedData = JSON.parse(cleanedJson.trim());
    } catch (err) {
      console.error("Could not parse AI JSON response:", responseText);
      // Clean fallback object
      const formattedSlug = urlSlugInfo ? urlSlugInfo.replace(/\b\w/g, c => c.toUpperCase()) : "Produit " + platformName;
      parsedData = {
        productName: formattedSlug,
        price: 4900,
        productDescription: `Découvrez notre tout nouveau produit sélectionné directement de ${platformName}. Conçu avec des matériaux de qualité supérieure pour une performance inégalée et une satisfaction client maximale.`,
        features: "Importé directement avec garantie qualité\nDesign moderne et robuste\nExcellent rapport qualité-prix en Algérie\nLivraison rapide à domicile sur 58 Wilayas",
        imagePrompt: `${formattedSlug} isolated on a premium background, studio lighting, product photography, high-resolution 3D render`
      };
    }

    res.json(parsedData);
  } catch (error: any) {
    console.error("Error in product import API:", error);
    const isQuota = error.message?.toLowerCase().includes("quota") || 
                    error.message?.includes("429") || 
                    error.message?.includes("RESOURCE_EXHAUSTED");
    if (isQuota) {
      return res.status(429).json({ 
        error: "Le quota de requêtes de l'IA est saturé. Veuillez patienter une minute puis réessayer, ou configurez votre clé API Gemini personnelle." 
      });
    }
    res.status(500).json({ error: error.message || "Une erreur est survenue lors de l'importation du produit." });
  }
});


// --- VITE MIDDLEWARE & STATIC ASSET HANDLERS ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
