export interface UserProfile {
  userId: string;
  email: string;
  subscriptionStatus: "free" | "business";
  companyName?: string;
  createdAt?: string;
}

export interface ProductSite {
  siteId: string;
  userId: string;
  productName: string;
  productDescription?: string;
  features?: string;
  price: number;
  slug: string;
  imageUrl?: string;
  generatedHtml: string;
  createdAt: string;
}

export interface ProfitCalculation {
  calcId: string;
  userId: string;
  productName: string;
  productCost: number;
  sellingPrice: number;
  deliveryFees: number;
  deliverySuccessRate: number; // e.g. 70 for 70%
  marketingCostPerOrder: number;
  expectedProfit: number;
  createdAt: string;
}

export interface SupplierSearch {
  searchId: string;
  userId: string;
  query: string;
  results: string; // Markdown format
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ChatSession {
  sessionId: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

export interface BaridiMobPayment {
  paymentId: string;
  userId: string;
  amount: number;
  senderRip: string;
  transactionReference: string;
  screenshotUrl?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}
