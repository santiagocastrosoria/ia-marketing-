import type { Repository } from "@/lib/db/repository";
import { chunkText } from "@/lib/brand/chunker";
import {
  extractKeywordsFromText,
  retrieveByKeywords,
} from "@/lib/brand/knowledgeRetriever";
import { validateBrandKnowledge } from "@/lib/brand/knowledgeValidator";
import type {
  BrandDocumentInput,
  BrandKnowledgeContext,
  BrandProfileInput,
} from "@/lib/types/brand";
import {
  MALDIVAS_NEGATIVE_KEYWORDS,
  MALDIVAS_KEYWORDS,
} from "@/lib/utils/presets";

export async function getBrandKnowledgeContext(
  repo: Repository,
  businessId: string,
  query?: string
): Promise<BrandKnowledgeContext> {
  const profile = await repo.getBrandProfile(businessId);
  const documents = await repo.getBrandDocuments(businessId);
  const allChunks = await repo.getBrandKnowledgeChunks(businessId);

  const retrievalQuery =
    query ??
    [
      profile?.positioning,
      profile?.main_products,
      profile?.ideal_customer,
      profile?.differentiators,
    ]
      .filter(Boolean)
      .join(" ");

  const { chunks: relevantChunks } = retrieveByKeywords(
    retrievalQuery,
    allChunks,
    8
  );

  const faqs = documents
    .filter((d) => d.document_type === "faq")
    .map((d) => d.content_text ?? d.title);
  const objections = documents
    .filter((d) => d.document_type === "objection")
    .map((d) => d.content_text ?? d.title);
  const competitors = documents
    .filter((d) => d.document_type === "competitor")
    .map((d) => d.content_text ?? d.title);

  const priceDoc = documents.find((d) => d.document_type === "price_range");
  const linksDoc = documents.find((d) => d.document_type === "important_links");

  const importantLinks: { label: string; url: string }[] = [];
  if (linksDoc?.metadata_json?.links) {
    const links = linksDoc.metadata_json.links as { label: string; url: string }[];
    importantLinks.push(...links);
  } else if (linksDoc?.content_text) {
    linksDoc.content_text.split("\n").forEach((line) => {
      const [label, url] = line.split("|").map((s) => s.trim());
      if (url) importantLinks.push({ label: label || url, url });
    });
  }

  const validation = validateBrandKnowledge(profile ?? null, documents);

  const corpusText = [
    profile?.positioning,
    profile?.main_products,
    profile?.materials,
    profile?.differentiators,
    ...documents.map((d) => d.content_text),
    ...relevantChunks.map((c) => c.chunk_text),
  ]
    .filter(Boolean)
    .join(" ");

  const suggestedKeywords = [
    ...extractKeywordsFromText(corpusText, 20),
    ...(profile?.preferred_words ?? []),
    ...(profile?.main_products
      ? profile.main_products.split(/[,;]/).map((s) => s.trim().toLowerCase())
      : []),
  ].filter((k, i, arr) => k.length > 2 && arr.indexOf(k) === i);

  const negativeKeywords = [
    ...(profile?.forbidden_words ?? []),
  ].filter((k, i, arr) => arr.indexOf(k) === i);

  return {
    businessId,
    profile: profile ?? null,
    documents,
    chunks: relevantChunks.length > 0 ? relevantChunks : allChunks.slice(0, 5),
    positioning: profile?.positioning ?? "",
    brandVoice: profile?.brand_voice ?? "",
    idealCustomer: profile?.ideal_customer ?? "",
    mainProducts: profile?.main_products ?? "",
    materials: profile?.materials ?? "",
    differentiators: profile?.differentiators ?? "",
    locations: profile?.locations ?? [],
    preferredWords: profile?.preferred_words ?? [],
    forbiddenWords: profile?.forbidden_words ?? [],
    primaryCta: profile?.primary_cta ?? "",
    secondaryCta: profile?.secondary_cta ?? "",
    faqs,
    objections,
    competitors,
    priceRange: priceDoc?.content_text ?? "",
    importantLinks,
    suggestedKeywords:
      suggestedKeywords.length > 0 ? suggestedKeywords : [...MALDIVAS_KEYWORDS],
    negativeKeywords:
      negativeKeywords.length > 0 ? negativeKeywords : [...MALDIVAS_NEGATIVE_KEYWORDS],
    isComplete: validation.isComplete,
    missingFields: validation.missingFields,
    completenessScore: validation.completenessScore,
  };
}

export async function upsertBrandProfile(
  repo: Repository,
  input: BrandProfileInput
): Promise<BrandKnowledgeContext> {
  const existing = await repo.getBrandProfile(input.business_id);
  if (existing) {
    const updated = await repo.updateBrandProfile(existing.id, input);
    if (!updated) {
      throw new Error(`No se pudo actualizar brand_profile para business ${input.business_id}`);
    }
  } else {
    await repo.createBrandProfile(input);
  }
  await reindexBusinessKnowledge(repo, input.business_id);
  return getBrandKnowledgeContext(repo, input.business_id);
}

export async function addBrandDocument(
  repo: Repository,
  input: BrandDocumentInput
): Promise<BrandKnowledgeContext> {
  const doc = await repo.createBrandDocument(input);
  if (input.content_text) {
    const chunks = chunkText(input.content_text);
    for (const text of chunks) {
      await repo.createBrandKnowledgeChunk({
        business_id: input.business_id,
        document_id: doc.id,
        chunk_text: text,
        embedding: null,
        metadata_json: { document_type: input.document_type, title: input.title },
      });
    }
  }
  return getBrandKnowledgeContext(repo, input.business_id);
}

export async function reindexBusinessKnowledge(
  repo: Repository,
  businessId: string
): Promise<void> {
  const profile = await repo.getBrandProfile(businessId);
  const documents = await repo.getBrandDocuments(businessId);

  await repo.deleteBrandKnowledgeChunks(businessId);

  const profileTexts = [
    profile?.positioning && `Posicionamiento: ${profile.positioning}`,
    profile?.brand_voice && `Tono: ${profile.brand_voice}`,
    profile?.main_products && `Productos: ${profile.main_products}`,
    profile?.materials && `Materiales: ${profile.materials}`,
    profile?.differentiators && `Diferenciales: ${profile.differentiators}`,
    profile?.ideal_customer && `Cliente ideal: ${profile.ideal_customer}`,
    profile?.locations?.length &&
      `Zonas: ${profile.locations.join(", ")}`,
    profile?.preferred_words?.length &&
      `Palabras recomendadas: ${profile.preferred_words.join(", ")}`,
    profile?.forbidden_words?.length &&
      `Palabras prohibidas: ${profile.forbidden_words.join(", ")}`,
  ].filter(Boolean) as string[];

  for (const text of profileTexts) {
    for (const chunk of chunkText(text)) {
      await repo.createBrandKnowledgeChunk({
        business_id: businessId,
        chunk_text: chunk,
        embedding: null,
        metadata_json: { source: "brand_profile" },
      });
    }
  }

  for (const doc of documents) {
    if (!doc.content_text) continue;
    for (const chunk of chunkText(doc.content_text)) {
      await repo.createBrandKnowledgeChunk({
        business_id: businessId,
        document_id: doc.id,
        chunk_text: chunk,
        embedding: null,
        metadata_json: {
          source: "document",
          document_type: doc.document_type,
          title: doc.title,
        },
      });
    }
  }
}

export async function validateForCampaignCreation(
  repo: Repository,
  businessId: string
): Promise<{ allowed: boolean; validation: ReturnType<typeof validateBrandKnowledge> }> {
  const profile = await repo.getBrandProfile(businessId);
  const documents = await repo.getBrandDocuments(businessId);
  const validation = validateBrandKnowledge(profile ?? null, documents);
  return { allowed: validation.isComplete, validation };
}

export { validateBrandKnowledge };
