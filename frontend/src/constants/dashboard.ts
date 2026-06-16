export const VIEWS = {
  DASHBOARD: "dashboard",
  MERGE: "merge",
  REFACTOR: "refactor",
  CREATE_NEW_KB: "create_new_kb",
  MISSING_TRANSLATION: "missing_translation",
  EDIT: "edit",
  OUTDATED: "outdated",
} as const;

export const API_ENDPOINTS = {
  DASHBOARD: "/api/v1/knowledgeassist/dashboard",
  COMMON_ISSUES: "/api/v1/knowledgeassist/get_most_common_issues_without_kb",
  ACTION: "/api/v1/knowledgeassist/action",
  COLLECTIONS: "/knowledgebase/collections",
  // Knowledge Assist specific collections endpoint (applies RBAC)
  KNOWLEDGE_ASSIST_COLLECTIONS: "/knowledgebase/collections/knowledge-assist",
  DOCUMENT: "/knowledgebase/document",
  DOCUMENT_LIST: "/knowledgebase/document_list",
  ALL_DOCUMENTS: "/knowledgebase/org/documents",
  ALL_ARTICLES: "/api/v1/knowledgeassist/recommendations",
  // Tag Management Endpoints
  TAGS: "/tags",
  TAGS_FOR_USER: "/tags/user",
  COLLECTIONS_WITH_TAGS: "/knowledgebase/collections-with-tags",
  COLLECTIONS_WITH_TAGS_FOR_USER: "/knowledgebase/collections-with-tags-for-user",
  // Admin KB Articles endpoint (all 4 admin roles can see all collections)
  COLLECTIONS_WITH_TAGS_ADMIN: "/knowledgebase/collections-with-tags/admin",
} as const;

export const TOAST_CONFIG = {
  position: "bottom-right" as const,
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
};

const clientName = process.env.NEXT_PUBLIC_CLIENT;

export const VIEW_TITLES = {
  [VIEWS.DASHBOARD]:
    clientName === "PROFILE_GD" ? "Knowledge Assist AI" : "Knowledge Assist",
  [VIEWS.MERGE]: "Merge Duplicate Articles",
  [VIEWS.REFACTOR]: "Update Article",
  [VIEWS.EDIT]: "Edit Article",
  [VIEWS.CREATE_NEW_KB]: "Create new Knowledge Article",
  // [VIEWS.TRANSLATE]: 'Translate Article',
  [VIEWS.OUTDATED]: "Outdated Articles",
  [VIEWS.MISSING_TRANSLATION]: "Translate Article",
} as const;

export const COLLECTION_ID =
  process.env.NEXT_PUBLIC_COLLECTION_ID ||
  "3fd2f21c-750e-4ced-9f8f-e00ef9966696";

export const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_FRONTEND_IP || "https://backend-api.aiopshq.dev";
// export const COLLECTION_ID = process.env.NEXT_PUBLIC_COLLECTION_ID
// || '15535ee4-7c38-485d-adea-fe0b250e35bd';
