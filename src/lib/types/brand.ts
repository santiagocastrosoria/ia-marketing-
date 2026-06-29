export type BrandDocumentType =
  | "general"
  | "faq"
  | "objection"
  | "competitor"
  | "price_range"
  | "important_links"
  | "file"
  | "product_sheet";

export interface BrandProfile {
  id: string;
  business_id: string;
  positioning?: string;
  brand_voice?: string;
  ideal_customer?: string;
  main_products?: string;
  materials?: string;
  differentiators?: string;
  locations?: string[];
  forbidden_words?: string[];
  preferred_words?: string[];
  primary_cta?: string;
  secondary_cta?: string;
  created_at: string;
  updated_at: string;
}

export interface BrandDocument {
  id: string;
  business_id: string;
  title: string;
  document_type: BrandDocumentType;
  content_text?: string;
  file_url?: string;
  metadata_json?: Record<string, unknown>;
  created_at: string;
}

export interface BrandKnowledgeChunk {
  id: string;
  business_id: string;
  document_id?: string;
  chunk_text: string;
  embedding?: number[] | null;
  metadata_json?: Record<string, unknown>;
  created_at: string;
}

export interface BrandProfileInput {
  business_id: string;
  positioning?: string;
  brand_voice?: string;
  ideal_customer?: string;
  main_products?: string;
  materials?: string;
  differentiators?: string;
  locations?: string[];
  forbidden_words?: string[];
  preferred_words?: string[];
  primary_cta?: string;
  secondary_cta?: string;
}

export interface BrandDocumentInput {
  business_id: string;
  title: string;
  document_type: BrandDocumentType;
  content_text?: string;
  file_url?: string;
  metadata_json?: Record<string, unknown>;
}

/** Aggregated context consumed by all agents */
export interface BrandKnowledgeContext {
  businessId: string;
  profile: BrandProfile | null;
  documents: BrandDocument[];
  chunks: BrandKnowledgeChunk[];
  /** Derived for agents */
  positioning: string;
  brandVoice: string;
  idealCustomer: string;
  mainProducts: string;
  materials: string;
  differentiators: string;
  locations: string[];
  preferredWords: string[];
  forbiddenWords: string[];
  primaryCta: string;
  secondaryCta: string;
  faqs: string[];
  objections: string[];
  competitors: string[];
  priceRange: string;
  importantLinks: { label: string; url: string }[];
  suggestedKeywords: string[];
  negativeKeywords: string[];
  isComplete: boolean;
  missingFields: string[];
  completenessScore: number;
}

export interface BrandKnowledgeValidation {
  isComplete: boolean;
  missingFields: string[];
  completenessScore: number;
  message: string;
}
