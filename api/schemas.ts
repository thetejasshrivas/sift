/**
 * api/schemas.ts — JSON Schemas and Validation Constants
 * Governed by PRD §5.3, §9.2, §9.3, IC-004, and REQ-013.
 */

import Ajv from 'ajv';

// Caps and Limits
export const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2 MB total payload ceiling (REQ-013 / TS-016)
export const MAX_ITEMS_PER_BATCH = 50; // Maximum 50 rows per batch (PRD §5.2 / §9.2)
export const PER_ITEM_TEXT_CAP = 4000; // Character cap per feedback row (~1,000 tokens ceiling)

export interface BatchItem {
  feedback_id: string;
  text: string;
  tier?: string;
}

export interface ClusterRequestPayload {
  batch_index: number;
  total_batches: number;
  items: BatchItem[];
}

export interface ClusterQuote {
  feedback_id: string;
  quote_snippet: string;
}

export interface ClusterResponseItem {
  cluster_id: string;
  cluster_title: string;
  canonical_category: string;
  problem_summary: string;
  root_cause_hypothesis: string;
  severity_rating: number; // 1, 2, or 3
  member_feedback_ids: string[];
  quotes: ClusterQuote[];
}

export interface ClusterResponseBody {
  clusters: ClusterResponseItem[];
}

// PRD §9.2 Request Schema (Draft-07 with literal URI, IC-004)
export const PRD_92_REQUEST_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["batch_index", "total_batches", "items"],
  "properties": {
    "batch_index": { "type": "integer", "minimum": 0 },
    "total_batches": { "type": "integer", "minimum": 1 },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["feedback_id", "text"],
        "properties": {
          "feedback_id": { "type": "string" },
          "text": { "type": "string" },
          "tier": { "type": "string" }
        }
      }
    }
  }
} as const;

// PRD §5.3 Upstream LLM Response Schema (Draft-07 with literal URI, IC-004)
export const PRD_53_RESPONSE_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["clusters"],
  "properties": {
    "clusters": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "cluster_id",
          "cluster_title",
          "canonical_category",
          "problem_summary",
          "root_cause_hypothesis",
          "severity_rating",
          "member_feedback_ids",
          "quotes"
        ],
        "properties": {
          "cluster_id": { "type": "string" },
          "cluster_title": { "type": "string" },
          "canonical_category": { "type": "string" },
          "problem_summary": { "type": "string" },
          "root_cause_hypothesis": { "type": "string" },
          "severity_rating": { "type": "integer", "minimum": 1, "maximum": 3 },
          "member_feedback_ids": {
            "type": "array",
            "items": { "type": "string" }
          },
          "quotes": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["feedback_id", "quote_snippet"],
              "properties": {
                "feedback_id": { "type": "string" },
                "quote_snippet": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
} as const;

// OpenAPI Schema for Gemini API responseSchema parameter (omits $schema keyword)
export const GEMINI_RESPONSE_SCHEMA = {
  "type": "object",
  "required": ["clusters"],
  "properties": {
    "clusters": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "cluster_id",
          "cluster_title",
          "canonical_category",
          "problem_summary",
          "root_cause_hypothesis",
          "severity_rating",
          "member_feedback_ids",
          "quotes"
        ],
        "properties": {
          "cluster_id": { "type": "string" },
          "cluster_title": { "type": "string" },
          "canonical_category": { "type": "string" },
          "problem_summary": { "type": "string" },
          "root_cause_hypothesis": { "type": "string" },
          "severity_rating": { "type": "integer" },
          "member_feedback_ids": {
            "type": "array",
            "items": { "type": "string" }
          },
          "quotes": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["feedback_id", "quote_snippet"],
              "properties": {
                "feedback_id": { "type": "string" },
                "quote_snippet": { "type": "string" }
              }
            }
          }
        }
      }
    }
  }
};

// Initialize Ajv instance for strict schema enforcement
const ajv = new Ajv({ allErrors: true });
export const validateClusterRequest = ajv.compile<ClusterRequestPayload>(PRD_92_REQUEST_SCHEMA);
export const validateClusterResponse = ajv.compile<ClusterResponseBody>(PRD_53_RESPONSE_SCHEMA);
