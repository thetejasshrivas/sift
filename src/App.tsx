/**
 * App.tsx — SIFT Discovery Workspace Main Application
 * Governed by PRD §3.1 (Steps 1–8), §3.2, §8; MDD §2.7, §4.6; GAP-22; IC-001, IC-002, IC-011, IC-012
 */

import React, { useState, useMemo } from 'react';
import { parseCsvFile, parseCsvText } from './ingest';
import { IngestionResult, SchemaMapping } from './types/ingest';
import syntheticCsvText from '../fixtures/synthetic_50.csv?raw';
import {
  processFeedbackRows,
  computeAccountCounts,
  calculateDataQualityMetrics,
  createQualityAlertBanner,
  ProcessedFeedbackRow
} from './identity';
import {
  Toast,
  PrivacyModal,
  ConfirmDialog,
  Dropzone,
  SchemaMappingGrid,
  DataQualityBanner,
  RowPreviewTable,
  PreFlightNotice,
  ProgressBar,
  ReconciliationDiagnostics,
  CalibrationBar,
  SpatialMatrixView,
  RankedCardList,
  DeepDiveDrawer
} from './ui';
import {
  runTwoPassClusteringPipeline,
  BatchPipelineProgress,
  TwoPassPipelineResult,
  createBenchmarkClusters
} from './ai';
import {
  scoreAndRankClusters,
  DEFAULT_SLIDER_WEIGHTS
} from './scoring';
import { SliderWeights } from './types/scoring';

export const App: React.FC = () => {
  // Pure ephemeral React memory state (GAP-22: strictly no localStorage/sessionStorage/IndexedDB)
  const [file, setFile] = useState<File | null>(null);
  const [ingestionResult, setIngestionResult] = useState<IngestionResult | null>(null);
  const [activeMapping, setActiveMapping] = useState<SchemaMapping | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'error' | 'warning' | 'info'; message: string } | null>(null);
  const [analysisTriggered, setAnalysisTriggered] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState<BatchPipelineProgress | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [twoPassResult, setTwoPassResult] = useState<TwoPassPipelineResult | null>(null);
  const [sliderWeights, setSliderWeights] = useState<SliderWeights>(DEFAULT_SLIDER_WEIGHTS);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [tabletActiveTab, setTabletActiveTab] = useState<'matrix' | 'cards'>('matrix');
  const [mobileScatterOpen, setMobileScatterOpen] = useState(false);

  // File acceptance & parsing handler
  const handleFileAccepted = async (selectedFile: File) => {
    setIsLoading(true);
    setToast(null);

    try {
      const result = await parseCsvFile(selectedFile, { maxRows: 2000 });

      setFile(selectedFile);
      setIngestionResult(result);
      setActiveMapping(result.mapping);
      setAnalysisTriggered(false);
      setTwoPassResult(null);
      setToast({
        type: 'info',
        message: `Successfully loaded "${selectedFile.name}" (${result.rowCount} rows parsed locally).`
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse CSV file.';
      setToast({ type: 'error', message: errorMessage });
      setFile(null);
      setIngestionResult(null);
      setActiveMapping(null);
      setTwoPassResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Load bundled 50-row benchmark sample dataset
  const handleLoadSample = () => {
    setIsLoading(true);
    setToast(null);

    try {
      const result = parseCsvText(syntheticCsvText, { maxRows: 2000 });
      const mockFile = new File([syntheticCsvText], 'synthetic_50.csv', { type: 'text/csv' });
      setFile(mockFile);
      setIngestionResult(result);
      setActiveMapping(result.mapping);
      setAnalysisTriggered(false);
      setTwoPassResult(null);
      setToast({
        type: 'info',
        message: `Loaded benchmark dataset "synthetic_50.csv" (${result.rowCount} rows parsed locally).`
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse sample CSV.';
      setToast({ type: 'error', message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  // Re-process raw rows when user modifies schema mapping
  const { processedRows, accountCounts, qualityMetrics, qualityBanner, isTextMapped } = useMemo(() => {
    if (!ingestionResult || !activeMapping) {
      return {
        processedRows: [] as ProcessedFeedbackRow[],
        accountCounts: null,
        qualityMetrics: null,
        qualityBanner: null,
        isTextMapped: false
      };
    }

    const textCol = activeMapping.text?.trim();
    const isMapped = Boolean(textCol && textCol.length > 0);

    // Re-map rows in-memory based on active schema mapping
    const mappedRows = ingestionResult.rows.map((row) => {
      const raw = row.rawRow;
      return {
        ...row,
        text: isMapped && textCol ? (raw[textCol] ?? '') : '',
        tier: activeMapping.tier ? raw[activeMapping.tier] : undefined,
        account_id: activeMapping.account_id ? raw[activeMapping.account_id] : undefined,
        user_id: activeMapping.user_id ? raw[activeMapping.user_id] : undefined
      };
    });

    const processed = processFeedbackRows(mappedRows);
    const isTierMapped = Boolean(activeMapping.tier);
    const isAccountMapped = Boolean(activeMapping.account_id);

    const counts = computeAccountCounts(processed, { isAccountColumnMapped: isAccountMapped });
    const metrics = calculateDataQualityMetrics(processed, {
      isTierColumnMapped: isTierMapped,
      isAccountColumnMapped: isAccountMapped
    });
    const banner = createQualityAlertBanner(metrics);

    return {
      processedRows: processed,
      accountCounts: counts,
      qualityMetrics: metrics,
      qualityBanner: banner,
      isTextMapped: isMapped
    };
  }, [ingestionResult, activeMapping]);

  // Scored dataset computation with live 60-FPS slider calibration (PRD REQ-008 & REQ-009)
  const scoredDataset = useMemo(() => {
    if (!twoPassResult || !twoPassResult.finalClusters.length || !processedRows.length) {
      return null;
    }
    return scoreAndRankClusters(twoPassResult.finalClusters, processedRows, sliderWeights);
  }, [twoPassResult, processedRows, sliderWeights]);

  // Mobile static quadrant summary counts (REQ-010 / M4-A)
  const mobileQuadrantCounts = useMemo(() => {
    if (!scoredDataset) {
      return { hiHf: 0, hiLf: 0, liHf: 0, liLf: 0 };
    }
    const plottable = scoredDataset.scoredClusters.filter(
      (c) => c.cluster_id !== 'CLUST-UNC' && !c.flags.isUnclusteredBucket
    );
    let hiHf = 0;
    let hiLf = 0;
    let liHf = 0;
    let liLf = 0;
    for (const c of plottable) {
      const isHi = c.normalized.I_n >= 0.5;
      const isHf = c.normalized.F_n >= 0.5;
      if (isHi && isHf) hiHf++;
      else if (isHi && !isHf) hiLf++;
      else if (!isHi && isHf) liHf++;
      else liLf++;
    }
    return { hiHf, hiLf, liHf, liLf };
  }, [scoredDataset]);

  const selectedCluster = useMemo(() => {
    if (!scoredDataset || !selectedClusterId) return null;
    return scoredDataset.scoredClusters.find((c) => c.cluster_id === selectedClusterId) || null;
  }, [scoredDataset, selectedClusterId]);

  const handleOpenDrawer = (clusterId: string) => {
    setSelectedClusterId(clusterId);
    setIsDrawerOpen(true);
  };

  // Reset all session state in ephemeral memory
  const handleConfirmStartNew = () => {
    if (abortController) {
      abortController.abort();
    }
    setFile(null);
    setIngestionResult(null);
    setActiveMapping(null);
    setAnalysisTriggered(false);
    setPipelineProgress(null);
    setTwoPassResult(null);
    setAbortController(null);
    setSliderWeights(DEFAULT_SLIDER_WEIGHTS);
    setSelectedClusterId(null);
    setIsConfirmDialogOpen(false);
    setToast({
      type: 'info',
      message: 'Session state cleared. All in-memory data purged.'
    });
  };

  // Instant demo clusters loader for offline exploration and benchmark validation
  const handleLoadDemoClusters = () => {
    if (!processedRows.length) return;
    const demoResult = createBenchmarkClusters(processedRows);
    setTwoPassResult(demoResult);
    setToast({
      type: 'info',
      message: `Loaded ${demoResult.finalClusters.length} benchmark clusters for calibration & discovery matrix preview.`,
    });
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setToast({
        type: 'warning',
        message: 'Analysis cancellation requested. Completing active operation...'
      });
    }
  };

  const handleAnalyze = async () => {
    if (!isTextMapped || processedRows.length === 0) return;
    const controller = new AbortController();
    setAbortController(controller);
    setAnalysisTriggered(true);

    try {
      const result = await runTwoPassClusteringPipeline(processedRows, {
        signal: controller.signal,
        onProgress: (p) => setPipelineProgress(p),
      });

      setTwoPassResult(result);

      if (result.isCancelled) {
        setToast({
          type: 'warning',
          message: 'Analysis cancelled. Processed clusters are preserved.'
        });
      } else if (result.pass2Reconciliation.hasFailures) {
        setToast({
          type: 'warning',
          message: `Analysis completed with advisory note: ${result.advisoryBannerMessage || 'Pass 2 reconciliation degraded.'}`
        });
      } else {
        setToast({
          type: 'info',
          message: `Analysis and cross-batch reconciliation completed! Identified ${result.finalClusters.length} problem clusters.`
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({
        type: 'error',
        message: `Pipeline encountered an error: ${msg}`
      });
    } finally {
      setAbortController(null);
    }
  };

  const handleRetryFailedBatches = async () => {
    if (!twoPassResult || !twoPassResult.failedBatchIndices.length || processedRows.length === 0) return;
    const controller = new AbortController();
    setAbortController(controller);
    setAnalysisTriggered(true);

    try {
      const result = await runTwoPassClusteringPipeline(processedRows, {
        signal: controller.signal,
        onProgress: (p) => setPipelineProgress(p),
        retryBatchIndices: twoPassResult.failedBatchIndices,
        existingClusters: twoPassResult.pass1Pipeline.allClusters,
      });

      setTwoPassResult(result);
      if (result.isFullyFailed) {
        setToast({
          type: 'error',
          message: 'Retry failed: provider errors persisted. Feedback remains in Unclustered Feedback.',
        });
      } else {
        setToast({
          type: 'info',
          message: `Retry completed! Current cluster count: ${result.finalClusters.length}.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setToast({
        type: 'error',
        message: `Retry encountered an error: ${msg}`,
      });
    } finally {
      setAbortController(null);
    }
  };


  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toast Alert Region */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Privacy Disclosure Modal */}
      <PrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />

      {/* Clear State Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        title="Start New Analysis?"
        message="This will immediately purge all ingested rows and mapping configurations from browser memory. This action cannot be undone."
        confirmLabel="Purge & Start New"
        onConfirm={handleConfirmStartNew}
        onCancel={() => setIsConfirmDialogOpen(false)}
      />

      {/* Header / Ingestion Bar per MDD §2.7 */}
      <header
        style={{
          borderBottom: '2px solid var(--border-strong)',
          backgroundColor: 'var(--bg-surface)',
          padding: '1.25rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.85rem' }}>
          <div
            id="brand-logo-mark"
            aria-hidden="true"
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="30" height="30" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="22" cy="22" r="19" stroke="var(--text-primary)" strokeWidth="1.75"/>
              <line x1="22" y1="3" x2="22" y2="41" stroke="var(--text-primary)" strokeWidth="1.75"/>
              <line x1="3" y1="22" x2="41" y2="22" stroke="var(--text-primary)" strokeWidth="1.75"/>
              <path d="M22 22L22 3.5C32.2173 3.5 40.5 11.7827 40.5 22L22 22Z" fill="var(--text-primary)"/>
              <circle cx="31" cy="31" r="2.5" fill="var(--text-primary)"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.65rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0, lineHeight: 1 }}>
              SIFT
            </h1>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '3px' }}>
              EXECUTIVE INTELLIGENCE &amp; PRIORITY SYNTHESIS
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {file && (
            <button
              onClick={() => setIsConfirmDialogOpen(true)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.4rem 0.85rem',
                backgroundColor: 'var(--bg-subtle)',
                color: 'var(--text-primary)',
                borderRadius: '2px',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              ↺ Start New Analysis
            </button>
          )}

          {/* Privacy Pill per PRD §3.1 Step 1 */}
          <button
            onClick={() => setIsPrivacyModalOpen(true)}
            aria-label="View Data Privacy and Security specifications"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.4rem 0.85rem',
              borderRadius: '2px',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            <span aria-hidden="true">🔒</span>
            <span>Zero Payload Logging</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '2rem', maxWidth: '1360px', width: '100%', margin: '0 auto' }}>
        {!file || !ingestionResult || !activeMapping ? (
          /* Step 1: Landing / Hero & Empty State */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: '720px', margin: '2rem auto' }}>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(37, 99, 235, 0.15)',
                  color: '#60A5FA',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  border: '1px solid rgba(37, 99, 235, 0.3)'
                }}
              >
                Ephemeral B2B SaaS Decision Workspace
              </div>
              <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                Prioritize Customer Feedback with Evidence Receipts
              </h2>
              <p style={{ marginTop: '1rem', fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Ingest unstructured CSV exports locally in browser memory. Balance Enterprise ARR protection against
                mass UX friction using verifiable priority scoring and exact verbatim quote receipts.
              </p>
            </div>

            {/* Dropzone Component */}
            <Dropzone
              onFileAccepted={handleFileAccepted}
              onError={(msg) => setToast({ type: 'error', message: msg })}
              isLoading={isLoading}
            />

            {/* Benchmark Sample Button */}
            <div style={{ textAlign: 'center', marginTop: '-1rem' }}>
              <button
                id="btn-load-sample"
                onClick={handleLoadSample}
                disabled={isLoading}
                style={{
                  padding: '0.5rem 1.125rem',
                  backgroundColor: 'var(--bg-surface)',
                  color: '#38BDF8',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
              >
                <span>⚡</span>
                <span>Load Benchmark Dataset (synthetic_50.csv)</span>
              </button>
            </div>

            {/* Privacy Highlight Banner */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}
            >
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }} aria-hidden="true">
                🛡️
              </span>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Zero Database Overhead:</strong> Feedback tables are parsed
                entirely in ephemeral browser memory. Raw feedback is transmitted solely during cloud clustering via stateless proxy
                with zero payload logging.
              </div>
            </div>
          </div>
        ) : (
          /* Steps 4–8: Ingestion Workspace, Schema Mapping & Quality Verification */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* File Metadata Overview */}
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '1rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Active Ingested File
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  📄 {file.name}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Rows:</span>{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{ingestionResult.rowCount}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Columns:</span>{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{ingestionResult.headers.length}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Delimiter:</span>{' '}
                  <code style={{ color: '#38BDF8' }}>{JSON.stringify(ingestionResult.delimiter)}</code>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>File Size:</span>{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{(file.size / 1024).toFixed(1)} KB</strong>
                </div>
              </div>
            </div>

            {/* Data Quality Summary & Alert Banner */}
            {qualityMetrics && qualityBanner && accountCounts && (
              <DataQualityBanner
                metrics={qualityMetrics}
                banner={qualityBanner}
                accountCounts={accountCounts}
              />
            )}

            {/* Dropdown Schema Mapping Grid */}
            <SchemaMappingGrid
              headers={ingestionResult.headers}
              mapping={activeMapping}
              onMappingChange={(newMapping) => setActiveMapping(newMapping)}
            />

            {/* Verbatim Row Preview Table */}
            <RowPreviewTable
              rows={processedRows}
              totalRowCount={ingestionResult.rowCount}
            />

            {/* Batch Analysis Progress Bar */}
            {analysisTriggered && pipelineProgress && (
              <ProgressBar
                progress={pipelineProgress}
                onCancel={handleCancel}
                isCancelling={Boolean(abortController?.signal.aborted)}
              />
            )}

            {/* Pre-Flight Notice & Action Controls */}
            <PreFlightNotice
              rowCount={ingestionResult.rowCount}
              isTextMapped={isTextMapped}
              onAnalyze={handleAnalyze}
              onStartNew={() => setIsConfirmDialogOpen(true)}
              onLoadDemoClusters={handleLoadDemoClusters}
              isAnalyzing={analysisTriggered}
            />

            {/* M3-B Interactive Calibration & Dual-View Workspace */}
            {scoredDataset && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem' }}>
                {/* Calibration Bar (60-FPS RAF batching) */}
                <CalibrationBar
                  weights={sliderWeights}
                  onWeightsChange={(newWeights) => setSliderWeights(newWeights)}
                />

                {/* Dataset Sample Size Warning Banner (GAP-02) */}
                {scoredDataset.warningBanner && (
                  <div
                    id="sample-size-warning-banner"
                    role="alert"
                    style={{
                      backgroundColor: 'rgba(217, 119, 6, 0.12)',
                      border: '1px solid rgba(217, 119, 6, 0.35)',
                      borderRadius: '8px',
                      padding: '0.85rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.85rem',
                      color: '#FBBF24',
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>⚠️</span>
                    <div>
                      <strong>Data Quality Notice:</strong> {scoredDataset.warningBanner}
                    </div>
                  </div>
                )}

                {/* Dual-View Discovery Workspace (2x2 Matrix + Ranked Cards - PRD REQ-010) */}
                {/* Tablet Navigation Tabs (768px - 1023px per TS-015) */}
                <div
                  id="tablet-view-tabs"
                  className="tablet-tabs-bar"
                  role="tablist"
                  aria-label="Workspace View Tabs"
                  style={{
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <button
                    type="button"
                    id="tab-priority-matrix"
                    role="tab"
                    aria-selected={tabletActiveTab === 'matrix'}
                    onClick={() => setTabletActiveTab('matrix')}
                    style={{
                      flex: 1,
                      padding: '0.65rem 1rem',
                      borderRadius: '2px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      backgroundColor: tabletActiveTab === 'matrix' ? '#292524' : '#FFFFFF',
                      color: tabletActiveTab === 'matrix' ? '#FFFFFF' : '#57534E',
                      border: '1px solid',
                      borderColor: tabletActiveTab === 'matrix' ? '#292524' : '#E5DFD5',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    📊 2×2 Priority Matrix
                  </button>
                  <button
                    type="button"
                    id="tab-ranked-cards"
                    role="tab"
                    aria-selected={tabletActiveTab === 'cards'}
                    onClick={() => setTabletActiveTab('cards')}
                    style={{
                      flex: 1,
                      padding: '0.65rem 1rem',
                      borderRadius: '2px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      backgroundColor: tabletActiveTab === 'cards' ? '#292524' : '#FFFFFF',
                      color: tabletActiveTab === 'cards' ? '#FFFFFF' : '#57534E',
                      border: '1px solid',
                      borderColor: tabletActiveTab === 'cards' ? '#292524' : '#E5DFD5',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    📑 Ranked Insight Cards ({scoredDataset.scoredClusters.length})
                  </button>
                </div>

                {/* Mobile Static Quadrant Summary Card (< 768px per M4-A) */}
                <div id="mobile-quadrant-summary-wrapper" className="mobile-quadrant-summary-wrapper">
                  <div
                    id="mobile-quadrant-summary-card"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '2px',
                      padding: '1.25rem',
                      marginBottom: '1rem',
                      boxShadow: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                      <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        2×2 Quadrant Summary
                      </h4>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        split at 0.5 of normalized scale
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                      <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '2px', padding: '0.75rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600, color: '#991B1B' }}>
                          High Impact / High Frequency
                          <span style={{ display: 'block', fontSize: '0.6rem', color: '#B91C1C', opacity: 0.9 }}>High Revenue Risk / High Volume</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 600, color: '#1C1917', marginTop: '0.2rem' }}>
                          {mobileQuadrantCounts.hiHf} <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>clusters</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '2px', padding: '0.75rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600, color: '#B45309' }}>
                          High Impact / Low Frequency
                          <span style={{ display: 'block', fontSize: '0.6rem', color: '#92400E', opacity: 0.9 }}>Enterprise Risk / Low Volume</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 600, color: '#1C1917', marginTop: '0.2rem' }}>
                          {mobileQuadrantCounts.hiLf} <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>clusters</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '2px', padding: '0.75rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600, color: '#475569' }}>
                          Low Impact / High Frequency
                          <span style={{ display: 'block', fontSize: '0.6rem', color: '#334155', opacity: 0.9 }}>Mass Friction / Low ARR</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 600, color: '#1C1917', marginTop: '0.2rem' }}>
                          {mobileQuadrantCounts.liHf} <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>clusters</span>
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#F5F2EB', border: '1px solid #E5DFD5', borderRadius: '2px', padding: '0.75rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600, color: '#78716C' }}>
                          Low Impact / Low Frequency
                          <span style={{ display: 'block', fontSize: '0.6rem', color: '#57534E', opacity: 0.9 }}>Low Priority</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 600, color: '#1C1917', marginTop: '0.2rem' }}>
                          {mobileQuadrantCounts.liLf} <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>clusters</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        id="btn-toggle-mobile-scatter"
                        onClick={() => setMobileScatterOpen(!mobileScatterOpen)}
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '0.2rem 0.4rem',
                        }}
                      >
                        {mobileScatterOpen ? 'Hide Scatter Plot ▲' : 'Show SVG Scatter Plot ▼'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dual-View Workspace Container (Desktop 45/55 Layout per REQ-010) */}
                <div
                  id="dual-view-workspace"
                  className="dual-view-workspace-container"
                >
                  {/* Left Column: 2x2 Spatial Matrix (SVG Scatter) */}
                  <div
                    className={`workspace-matrix-col ${tabletActiveTab !== 'matrix' ? 'tablet-hidden' : ''} ${!mobileScatterOpen ? 'mobile-hidden' : ''}`}
                  >
                    <SpatialMatrixView
                      clusters={scoredDataset.scoredClusters}
                      selectedClusterId={selectedClusterId}
                      hoveredClusterId={hoveredClusterId}
                      onSelectCluster={(id) => setSelectedClusterId(id)}
                      onHoverCluster={(id) => setHoveredClusterId(id)}
                      onOpenDrawer={handleOpenDrawer}
                    />
                  </div>

                  {/* Right Column: Ranked Card List */}
                  <div
                    className={`workspace-cards-col ${tabletActiveTab !== 'cards' ? 'tablet-hidden' : ''}`}
                  >
                    <RankedCardList
                      clusters={scoredDataset.scoredClusters}
                      selectedClusterId={selectedClusterId}
                      hoveredClusterId={hoveredClusterId}
                      onSelectCluster={(id) => setSelectedClusterId(id)}
                      onHoverCluster={(id) => setHoveredClusterId(id)}
                      onOpenDrawer={handleOpenDrawer}
                      isAccountIdsUnmapped={!activeMapping?.account_id || (accountCounts?.isAccountUnmappedWarning ?? false)}
                    />
                  </div>
                </div>

                {/* Deep-Dive Drawer (600px Right-hand slide-out per REQ-010) */}
                <DeepDiveDrawer
                  cluster={selectedCluster}
                  isOpen={isDrawerOpen}
                  onClose={() => setIsDrawerOpen(false)}
                  allRows={processedRows}
                />
              </div>
            )}

            {/* Reconciliation Diagnostics Panel & Uncertainty Badges (M2-C / M2-D) */}
            {twoPassResult && (
              <ReconciliationDiagnostics
                diagnostics={twoPassResult.diagnostics}
                clusters={twoPassResult.finalClusters}
                clustUnc={twoPassResult.clustUnc}
                integrity={twoPassResult.pass2Reconciliation.integrity}
                advisoryBannerMessage={twoPassResult.advisoryBannerMessage}
                isFullyFailed={twoPassResult.isFullyFailed}
                failedBatchIndices={twoPassResult.failedBatchIndices}
                onRetryFailedBatches={handleRetryFailedBatches}
                isRetrying={analysisTriggered}
              />
            )}
          </div>

        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          padding: '1rem 2rem',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}
      >
        SIFT v0.1.0 (P0 MVP Core) — Ephemeral In-Memory Workspace. Zero persistent storage.
      </footer>
    </div>
  );
};

export default App;
