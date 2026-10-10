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
  RankedCardList
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
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.2rem',
              color: '#FFFFFF'
            }}
          >
            S
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              SIFT
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              AI Product Feedback → Insight Agent
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {file && (
            <button
              onClick={() => setIsConfirmDialogOpen(true)}
              style={{
                fontSize: '0.8rem',
                padding: '0.4rem 0.75rem',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)'
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
              fontSize: '0.8rem',
              fontWeight: 500,
              padding: '0.4rem 0.85rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              color: '#38BDF8',
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}
          >
            <span aria-hidden="true">🔒</span>
            <span>Ephemeral Privacy & AI Disclosure</span>
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

                {/* Dual-View Discovery Workspace (2x2 Matrix + Ranked Cards) */}
                <div
                  id="dual-view-workspace"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                    gap: '1.5rem',
                    alignItems: 'start',
                  }}
                >
                  {/* Left Column: 2x2 Spatial Matrix */}
                  <SpatialMatrixView
                    clusters={scoredDataset.scoredClusters}
                    selectedClusterId={selectedClusterId}
                    onSelectCluster={(id) => setSelectedClusterId(id)}
                  />

                  {/* Right Column: Ranked Card List */}
                  <RankedCardList
                    clusters={scoredDataset.scoredClusters}
                    selectedClusterId={selectedClusterId}
                    onSelectCluster={(id) => setSelectedClusterId(id)}
                  />
                </div>
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
