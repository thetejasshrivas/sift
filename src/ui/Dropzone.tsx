/**
 * ui/Dropzone.tsx — CSV File Dropzone & Ingestion Component
 * Governed by PRD §3.1 Step 3, §4.1; REQ-001; TS-001
 */

import React, { useState, useRef } from 'react';

export interface DropzoneProps {
  onFileAccepted: (file: File) => void;
  onError: (message: string) => void;
  isLoading?: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFileAccepted, onError, isLoading }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFile = (file: File) => {
    // 1. Strict extension check: accept .csv only per PRD §4.1 / REQ-001
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv')) {
      const ext = fileName.includes('.') ? `.${fileName.split('.').pop()}` : 'unknown file';
      onError(`Invalid file type (${ext}). Sift strictly accepts standard .csv files only (.xlsx, .pdf, .json are rejected).`);
      return;
    }

    // 2. Max size check: 10MB
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      onError(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum limit of 10 MB.`);
      return;
    }

    if (file.size === 0) {
      onError('The selected CSV file is empty (0 bytes).');
      return;
    }

    onFileAccepted(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      validateAndProcessFile(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      validateAndProcessFile(file);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label="Upload CSV feedback file. Drag and drop or press enter to browse."
      style={{
        border: `2px dashed ${isDragOver ? 'var(--border-focus)' : 'var(--border-strong)'}`,
        backgroundColor: isDragOver ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-surface)',
        borderRadius: '12px',
        padding: '3rem 2rem',
        textAlign: 'center',
        cursor: isLoading ? 'wait' : 'pointer',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        outline: 'none'
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleInputChange}
        disabled={isLoading}
      />

      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.75rem',
          color: '#38BDF8'
        }}
      >
        📄
      </div>

      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
          {isLoading ? 'Parsing CSV in Memory...' : 'Drop customer feedback CSV here, or browse'}
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Standard exports from Zendesk, Intercom, Gong, or product reviews
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          justifyContent: 'center',
          marginTop: '0.5rem'
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.625rem',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            borderRadius: '9999px',
            border: '1px solid var(--border-subtle)'
          }}
        >
          .csv only
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.625rem',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            borderRadius: '9999px',
            border: '1px solid var(--border-subtle)'
          }}
        >
          Max 2,000 rows
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.625rem',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            borderRadius: '9999px',
            border: '1px solid var(--border-subtle)'
          }}
        >
          Max 10 MB
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.625rem',
            backgroundColor: 'rgba(5, 150, 105, 0.15)',
            color: '#34D399',
            borderRadius: '9999px',
            border: '1px solid rgba(5, 150, 105, 0.4)'
          }}
        >
          🔒 Local Browser Memory Only
        </span>
      </div>
    </div>
  );
};
