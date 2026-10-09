/**
 * ui/SchemaMappingGrid.tsx — Dropdown Schema Mapping Grid with Manual Overrides
 * Governed by PRD §3.1 Steps 5–6, §4.2; REQ-002
 */

import React from 'react';
import { CanonicalField, SchemaMapping } from '../types/ingest';

export interface SchemaMappingGridProps {
  headers: string[];
  mapping: SchemaMapping;
  onMappingChange: (newMapping: SchemaMapping) => void;
}

interface FieldDefinition {
  field: CanonicalField;
  label: string;
  required: boolean;
  description: string;
  unmappedNotice?: string;
}

const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    field: 'text',
    label: 'Raw Feedback Text',
    required: true,
    description: 'Unstructured customer quotes, issue descriptions, or reviews.',
    unmappedNotice: 'Mandatory field. Must map to a valid column to enable analysis.'
  },
  {
    field: 'tier',
    label: 'Customer Tier / ARR',
    required: false,
    description: 'Plan tier (Enterprise, Pro, Free). Unmapped rows default to UNKNOWN (1.0x Tier-Weighted).',
    unmappedNotice: 'Optional. If unmapped, all rows evaluated as UNKNOWN (1.0x).'
  },
  {
    field: 'feedback_id',
    label: 'Feedback ID',
    required: false,
    description: 'Unique ticket or row ID. If unmapped, Sift auto-generates stable IDs (FB-001, FB-002...).',
    unmappedNotice: 'Optional. Auto-generates FB-001, FB-002...'
  },
  {
    field: 'user_id',
    label: 'User ID',
    required: false,
    description: 'Individual submitter or author identifier (e.g. email, user UUID).',
    unmappedNotice: 'Optional.'
  },
  {
    field: 'account_id',
    label: 'Account ID',
    required: false,
    description: 'Corporate customer account for revenue-weighted deduplication (IC-012).',
    unmappedNotice: 'Optional. If unmapped, accounts estimated provisionally.'
  }
];

export const SchemaMappingGrid: React.FC<SchemaMappingGridProps> = ({
  headers,
  mapping,
  onMappingChange
}) => {
  const handleSelectChange = (field: CanonicalField, value: string) => {
    const updated: SchemaMapping = { ...mapping };
    const cleanVal = value === '__NONE__' ? null : value;

    if (field === 'text') {
      updated.text = cleanVal ?? '';
    } else {
      updated[field] = cleanVal;
    }

    onMappingChange(updated);
  };

  const isTextMapped = Boolean(mapping.text && mapping.text.trim().length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Column Schema Mapping
        </h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {headers.length} CSV columns detected
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem'
        }}
      >
        {FIELD_DEFINITIONS.map((def) => {
          const currentVal = mapping[def.field] ?? '__NONE__';
          const isInvalidRequired = def.required && !isTextMapped;

          return (
            <div
              key={def.field}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: `1px solid ${isInvalidRequired ? 'var(--color-red)' : 'var(--border-subtle)'}`,
                borderRadius: '8px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                boxShadow: isInvalidRequired ? '0 0 0 1px var(--color-red)' : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label
                  htmlFor={`select-${def.field}`}
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: isInvalidRequired ? '#FCA5A5' : 'var(--text-primary)'
                  }}
                >
                  {def.label} {def.required && <span style={{ color: 'var(--color-red)' }}>*</span>}
                </label>
                {def.required ? (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.125rem 0.375rem',
                      borderRadius: '4px',
                      backgroundColor: isInvalidRequired ? 'var(--color-red-bg)' : 'rgba(56, 189, 248, 0.15)',
                      color: isInvalidRequired ? '#FCA5A5' : '#38BDF8'
                    }}
                  >
                    Required
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      padding: '0.125rem 0.375rem',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-card)'
                    }}
                  >
                    Optional
                  </span>
                )}
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, minHeight: '2.4rem' }}>
                {def.description}
              </p>

              <select
                id={`select-${def.field}`}
                value={currentVal ?? '__NONE__'}
                onChange={(e) => handleSelectChange(def.field, e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: `1px solid ${isInvalidRequired ? 'var(--color-red)' : 'var(--border-strong)'}`,
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {!def.required && (
                  <option value="__NONE__">
                    -- Not Mapped --
                  </option>
                )}
                {def.required && !isTextMapped && (
                  <option value="__NONE__">
                    -- Select Raw Feedback Column --
                  </option>
                )}
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>

              {isInvalidRequired && (
                <span style={{ fontSize: '0.75rem', color: '#FCA5A5', marginTop: '0.25rem' }}>
                  ⚠️ {def.unmappedNotice}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
