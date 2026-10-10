#!/usr/bin/env node

/**
 * scripts/generate-fixture-300.js — Generates fixtures/valid_300rows.csv
 * Governed by PRD §5.2, §10.3, manual Part IV and Part V §M2-E.
 *
 * Requirements:
 * 1. 300 realistic, purely synthetic B2B SaaS feedback rows (zero real customer PII).
 * 2. Columns: Feedback ID (FB-001 to FB-300), Raw Feedback Text, Customer Tier, Account ID, Date.
 * 3. Customer Tiers: Enterprise, Pro, Free, and blank (UNKNOWN).
 * 4. Span at least 6 distinct product themes:
 *    - Theme 1 (FB-001 to FB-050): CSV export timeout & truncation
 *    - Theme 2 (FB-051 to FB-100): Chart rendering lag & dashboard performance
 *    - Theme 3 (FB-101 to FB-150): SSO/SAML configuration & identity sync
 *    - Theme 4 (FB-151 to FB-200): Invoice PDF generation & tax receipt metadata
 *    - Theme 5 (FB-201 to FB-250): Webhook retries & event delivery timeouts
 *    - Theme 6 (FB-251 to FB-300): Search filter persistence & query state loss
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TARGET_PATH = path.resolve(ROOT_DIR, 'fixtures', 'valid_300rows.csv');

// Theme 1: CSV export timeout & truncation (FB-001 .. FB-050)
const THEME_1_TEXTS = [
  'Exporting report to CSV times out after 60 seconds with 504 Gateway Timeout when row count exceeds 15000.',
  'CSV export truncated at exactly 1000 records without showing any error or warning banner in Chrome on macOS.',
  'The CSV download fails consistently on our monthly transaction audit table containing 25000 rows.',
  'When generating a full CSV dump, the browser tab memory climbs to 2 GB and crashes with out of memory error.',
  'CSV export button is completely unresponsive when date range filter spans more than 6 months.',
  'Non-ASCII UTF-8 characters and accented customer names are corrupted and mangled in exported CSV files.',
  'Export to CSV produces a completely blank 0 KB file when running in Safari 17 on iOS or macOS.',
  'Large CSV exports trigger an HTTP 502 Bad Gateway error from cloud proxy after 30 seconds of spinning.',
  'The background CSV job never finishes processing and leaves the export modal stuck at 99 percent.',
  'Need streaming CSV export for datasets over 50000 records because synchronous download always fails.',
  'Exported CSV files are missing custom metadata columns defined in workspace table settings.',
  'Attempting to export analytics summary to CSV causes high server latency and returns HTTP 500.',
  'CSV download link sent via email expires before file download finishes on slower corporate network connections.',
  'Customer tier and revenue fields are omitted from CSV output even though admin permissions are granted.',
  'Exporting filtered audit log to CSV includes deleted rows that should have been excluded by active filter.',
  'The CSV export modal freezes and locks UI interaction until browser page is forcefully refreshed.',
  'When exporting dataset with 8000 rows, download terminates prematurely at row 4200.',
  'Special characters such as commas and quotation marks in feedback text break column alignment in CSV.',
  'CSV export job times out with error code ERR_CONNECTION_TIMED_OUT on Windows 11 Chrome.',
  'Scheduled weekly CSV export automated task fails silently without sending failure notification to admins.',
  'CSV export generates malformed line breaks causing Excel to report file corruption upon opening.',
  'Downloading CSV report fails with network error when dataset contains more than 100 columns.',
  'The CSV export progress bar jumps from 10 percent to failed with an unhandled server timeout error.',
  'Exporting table data to CSV truncates numbers exceeding 16 digits into incorrect scientific notation.',
  'Bulk CSV export takes over 3 minutes for 5000 items, causing our compliance team workflow severe delays.',
  'Clicking export to CSV while pagination is loading triggers a duplicate download of identical rows.',
  'CSV export filename contains invalid timezone timestamp characters preventing saving on Windows filesystem.',
  'When exporting transaction log to CSV, decimal currency precision is rounded off to integers incorrectly.',
  'CSV export fails with HTTP 504 timeout whenever multiple users in the same organization trigger export.',
  'The export dropdown menu closes immediately without initiating CSV download when clicked in Firefox 124.',
  'Export to CSV omits rows where account ID is null rather than printing an empty string.',
  'Customer email addresses in CSV export are truncated after 20 characters causing data loss.',
  'Attempting to download 12000 rows in CSV crashes the Node export worker process on the backend.',
  'CSV file download begins but network stream drops after exactly 1 MB of data transferred.',
  'Filtering by date and exporting to CSV ignores the timezone offset and exports records from prior day.',
  'Need an asynchronous CSV export option with download webhook notification for large tables.',
  'Exporting user permissions to CSV drops nested role attributes without any indication.',
  'The CSV export dialog does not show estimated remaining time or byte transfer progress.',
  'CSV exports larger than 10 MB fail with error code 413 Payload Too Large from edge gateway.',
  'Exporting activity logs to CSV fails if any row contains emojis or 4-byte unicode characters.',
  'Exported CSV columns do not match the visible table column order configured by the user.',
  'Running CSV export during peak hours causes dashboard response times to degrade across team.',
  'CSV export button remains disabled after applying valid filter criteria until page reload.',
  'The CSV export worker times out at 45 seconds when joining customer account tags.',
  'Downloading CSV on Edge browser results in an unrecognized format warning due to missing MIME type.',
  'CSV download fails with HTTP 503 Service Unavailable when background queue has more than 10 jobs.',
  'Exporting 3000 customer feedback records to CSV takes 90 seconds and often drops the last batch.',
  'CSV export lacks option to select delimiter such as semicolon for European locale spreadsheets.',
  'The CSV export button requires three consecutive clicks before triggering download in Chrome on Ubuntu.',
  'Export to CSV consistently times out on datasets with over 7000 rows, blocking executive reporting.'
];

// Theme 2: Chart rendering lag & dashboard performance (FB-051 .. FB-100)
const THEME_2_TEXTS = [
  'Analytics dashboard executive charts take over 12 seconds to render when switching team workspaces.',
  'Interactive line chart lags noticeably and drops frames during zoom and pan operations on Windows 11.',
  'The metrics overview dashboard tab freezes up and causes high CPU usage in Chrome browser.',
  'Rendering trend graphs with more than 50 data points causes the browser main thread to stutter.',
  'Dashboard charts fail to load entirely and display a blank canvas when time range is set to 90 days.',
  'Real-time metrics graph updates cause constant screen flickering and visual layout shifting.',
  'Switching between bar chart and scatter plot views triggers an unhandled memory leak in React renderer.',
  'Chart rendering latency on mobile and tablet touchscreens makes dashboard navigation unusable.',
  'High latency loading historical volume charts during peak business hours in European timezone.',
  'Stacked area chart tooltips disappear immediately before values can be read on mouse hover.',
  'Dashboard widget loading spinners never resolve if API request returns empty array for metric.',
  'Zooming in on historical latency line graph crashes page with unhandled Out of Bounds error.',
  'Rendering multiple gauge charts simultaneously pushes browser memory usage above 1.5 GB.',
  'Chart legend labels overlap and become unreadable when there are more than 6 metric series.',
  'The summary dashboard takes 18 seconds to display charts on Safari 17 on macOS Sonoma.',
  'TimeSeries graph data points do not align with vertical axis tick marks on high DPI retina displays.',
  'Performance on the feedback trends page is sluggish when rendering more than 200 items.',
  'Bar chart animation causes significant UI stutter and frame drops on Firefox 125 for Linux.',
  'Switching dashboard time window from 7d to 30d freezes UI for 8 seconds without loading spinner.',
  'Custom chart color palettes reset to default theme after switching between workspace tabs.',
  'Chart axis scale fails to adapt when metric value spikes to zero, flattening all visible curves.',
  'Dashboard crashes with WebGL context lost error when leaving browser tab open in background.',
  'Metrics chart rendering blocks user interaction with page navigation bar for several seconds.',
  'Pie chart slices with less than 2 percent value overlap and render labels on top of each other.',
  'Historical trend chart fails to load with error code 500 when querying 12-month aggregated metrics.',
  'Drill-down click interaction on chart bars fails to navigate to underlying feedback list.',
  'Rendering live telemetry graphs causes laptop fans to spin up due to excessive canvas redraws.',
  'Chart rendering engine does not support dark mode theme resulting in blinding white backgrounds.',
  'Dashboard performance degrades progressively after viewing 5 different project dashboards in a session.',
  'Exporting chart as PNG image produces a blurry low-resolution 72 DPI image unsuitable for slides.',
  'Chart data points render with 2-hour delay because client timestamp parsing ignores local timezone.',
  'The metric card sparklines freeze rendering when browser window is resized across breakpoints.',
  'Multi-metric comparison chart takes over 20 seconds to aggregate and render 500 records.',
  'Hovering over data points on scatter plot causes tooltip flickering and UI thread lockup.',
  'Dashboard page load time exceeds 15 seconds on initial load, frustrating executive stakeholders.',
  'Heatmap chart fails to render cell values when dimension values contain special characters.',
  'Rendering bar charts with negative values clips bars below baseline without proper negative axis.',
  'Dashboard memory usage grows steadily by 50 MB every minute when auto-refresh toggle is enabled.',
  'Chart rendering throws TypeError: cannot read properties of undefined when dataset has missing date gaps.',
  'The cumulative volume graph renders erratic jagged lines when date intervals are set to hourly.',
  'Executive dashboard fails to load charts on iPad Safari resulting in blank rectangular containers.',
  'Graph rendering pipeline does not cancel pending render requests when user changes active filter.',
  'Chart tooltip values do not show currency symbols or formatted thousands separators.',
  'Loading the retention cohort chart causes browser tab memory to spike and trigger crash page.',
  'Chart axis labels are truncated with ellipsis even when ample horizontal whitespace is available.',
  'Dashboard charts take over 10 seconds to load for accounts with more than 1000 feedback entries.',
  'Line chart smoothing algorithm distorts sharp metric drops into gentle rounded curves misleading viewers.',
  'Rendering interactive timeline graph locks keyboard scrolling and touch gestures on mobile devices.',
  'Chart rendering engine throws unhandled DOMException when container dimensions are zero during initial layout.',
  'Dashboard summary charts fail to refresh automatically when new feedback items are submitted.'
];

// Theme 3: SSO/SAML configuration & authentication (FB-101 .. FB-150)
const THEME_3_TEXTS = [
  'Okta SAML 2.0 single sign-on redirect loop fails with error code 403 Forbidden upon initial login.',
  'SAML SSO certificate rotation cannot be completed self-service in organization security settings.',
  'Azure AD SCIM user provisioning integration fails to sync user groups and department metadata.',
  'Google Workspace SSO logout does not invalidate active application session refresh tokens.',
  'Two-factor authentication SMS verification codes frequently arrive delayed by 10 to 15 minutes.',
  'Enforcing mandatory MFA for all team members lacks an administrative organization-wide toggle.',
  'SAML assertion signature verification fails with error code 401 Unauthorized for custom IdP.',
  'PingIdentity SAML integration drops RelayState parameter during login redirect sequence.',
  'Just-In-Time user provisioning via SAML assigns default Viewer role instead of configured department role.',
  'Single Sign-On login page loops indefinitely when user email domain does not match exact IdP domain.',
  'SAML metadata XML upload fails with unhandled schema validation error for standard OneLogin XML.',
  'Session timeout occurs after only 15 minutes of inactivity despite organization policy set to 8 hours.',
  'Azure Active Directory SSO login returns error AADSTS50105 indicating user is not assigned to application.',
  'Admin cannot configure multiple SAML identity providers for organizations with subsidiary domains.',
  'SSO authentication fails with error 400 Bad Request when SAML assertion exceeds 8 KB in size.',
  'Revoking user in Okta directory does not terminate active browser sessions until token expiration.',
  'SAML authentication logs lack detailed error descriptions, displaying only generic login failure.',
  'Configuring custom SAML attribute mapping for employee ID field fails to persist after saving settings.',
  'Google OAuth 2.0 login button is unresponsive when third-party cookies are blocked in Chrome.',
  'Two-factor authentication backup recovery codes cannot be regenerated from user security profile.',
  'SAML Single Logout (SLO) endpoint returns HTTP 500 and fails to log user out of central IdP.',
  'Admin cannot enforce IP whitelist restrictions for users authenticating through corporate SSO.',
  'SSO login page displays unstyled raw XML error message when IdP certificate expires.',
  'SCIM synchronization creates duplicate user accounts when user email address has mixed casing.',
  'Okta SSO redirect fails on mobile devices due to missing responsive viewport on login gateway.',
  'Users with multiple email aliases in Google Workspace cannot authenticate using secondary alias.',
  'SAML attribute name format requires Basic but IdP sends URI reference causing attribute parse failure.',
  'Cannot bypass SSO login for external contractor accounts with non-corporate email domains.',
  'Enabling SSO locks out local email/password admin accounts before SAML connection is verified.',
  'Azure AD SSO integration fails with error code 502 when tenant contains more than 1000 groups.',
  'SAML Response lacks required InResponseTo attribute error received during identity verification.',
  'Password reset link email for non-SSO accounts is delivered with an expired security token.',
  'Admin audit log does not record failed SAML authentication attempts or invalid assertion payloads.',
  'Duo Security 2FA prompt fails to render inside iframe on Safari browser due to cross-site tracking block.',
  'SAML login flow fails when corporate proxy strips or modifies Referer header in HTTP request.',
  'User provisioning via SCIM API returns HTTP 429 Too Many Requests during bulk employee onboarding.',
  'SSO session token cookies are set without Secure or SameSite attributes creating vulnerability warning.',
  'Configuring SAML SSO requires manual engineering support because self-service wizard lacks documentation.',
  'Google SSO login produces HTTP 400 redirect_uri_mismatch when accessing workspace from custom domain.',
  'Role-based access control permissions mapped via SAML groups revert to default after every user login.',
  'Hardware security key (WebAuthn / FIDO2) registration fails with unhandled error in Firefox.',
  'SSO authentication takes over 8 seconds per login due to redundant upstream IdP certificate checks.',
  'SAML metadata endpoint does not support HTTPS TLS 1.3 causing handshake failure on modern gateways.',
  'Admin cannot download SP metadata XML certificate from workspace security settings page.',
  'Two-factor authentication code input field does not support paste from password manager apps.',
  'SAML NameID format emailAddress rejected when IdP sends transient identifier format.',
  'Okta integration fails to de-provision suspended employees, leaving account access active.',
  'SSO login button disappears from sign-in page when custom workspace branding logo is enabled.',
  'Authenticating via SAML on mobile app fails with error code 404 on deep link callback URL.',
  'SAML SSO integration frequently fails with clock skew timestamp validation error on edge servers.'
];

// Theme 4: Invoice PDF generation & tax metadata (FB-151 .. FB-200)
const THEME_4_TEXTS = [
  'Cannot download PDF VAT invoices and billing receipts from billing administration dashboard.',
  'Monthly invoice receipt emails fail to send to designated billing contact email alias.',
  'Need to add custom company tax registration number and PO number on recurring monthly invoices.',
  'Credit card payment update form returns generic payment failure without specifying decline reason.',
  'Invoices tab shows incorrect currency symbol when billing country is set to United Kingdom GBP.',
  'Downloading invoice PDF produces a corrupted 0-byte file on Safari 17 browser.',
  'Invoice PDF generation times out with HTTP 504 Gateway Timeout during end-of-month billing cycles.',
  'Company address on generated PDF invoice is truncated after 30 characters omitting postal code.',
  'Subscription renewal charge occurred two days before scheduled billing cycle date without prior notice.',
  'Invoices do not itemize seat additions and prorated tier upgrades clearly for accounting audit.',
  'Billing administration page displays loading spinner indefinitely when loading payment history.',
  'Failed payment retry notification does not include direct payment update URL for billing admins.',
  'Downloading tax invoices in bulk produces an error when date range includes more than 12 invoices.',
  'Need invoice PDF to include reverse charge VAT disclosure statement for European B2B compliance.',
  'Credit card expiration date cannot be updated without re-entering the entire 16-digit card number.',
  'Invoice download button is greyed out and unclickable for all paid invoices older than 6 months.',
  'Generated PDF invoice layout renders overlapping text between invoice header and company logo.',
  'Customer billing currency cannot be switched from USD to EUR without contacting support.',
  'Monthly billing notification email contains broken image links and unstyled raw HTML markup.',
  'Attempting to download invoice PDF throws unhandled 500 error when company name has ampersand.',
  'ACH bank transfer payment details do not display routing number instructions on billing page.',
  'Invoice PDF does not display total paid stamp or payment confirmation transaction identifier.',
  'Updating billing contact email address does not update recipient for automated receipt delivery.',
  'Billing invoice date displays UTC timestamp instead of organization local accounting timezone.',
  'Payment receipt PDF fails to generate with error code 502 when billing address contains unicode.',
  'Cannot generate consolidated quarterly invoice PDF for organizations with multiple sub-accounts.',
  'Annual subscription invoice does not show discount code applied or breakdown of annual savings.',
  'Billing portal redirects to white screen when customer attempts to access Stripe billing portal.',
  'Tax calculation engine applies incorrect state sales tax rate for California billing addresses.',
  'Invoice PDF document title metadata displays Untitled Document instead of company invoice number.',
  'Payment failed banner persists on dashboard header even after successful payment processing.',
  'Invoice line items do not show unit price and quantity breakdown for add-on feature packages.',
  'Downloading billing receipt on mobile browser opens raw binary stream in tab instead of saving PDF.',
  'Custom purchase order PO number entered during checkout is omitted from subsequent invoice PDFs.',
  'Billing history table does not support sorting invoices by date, amount, or payment status.',
  'Invoice PDF margins are misconfigured causing footer pagination to print on separate blank page.',
  'Prorated credit balance from mid-cycle tier downgrade does not show as credit on next invoice.',
  'Billing settings page lacks option to pause subscription during seasonal business downtime.',
  'Invoice generation worker fails with out of memory error when compiling detailed usage metrics.',
  'Billing receipt emails arrive without PDF attachment requiring manual download from portal.',
  'Changing payment method from credit card to wire transfer requires deleting existing card first.',
  'Invoice number sequence contains gaps and non-sequential numbering confusing accounting auditors.',
  'Generated invoice PDF lacks digital signature verification required by corporate accounts payable.',
  'Credit card charge description on bank statement does not match registered company product name.',
  'Billing administration portal fails to load with error code 403 for secondary billing admin role.',
  'Invoices generated for accounts in Germany do not include mandatory German Steuernummer tax ID.',
  'Updating VAT ID returns error message Invalid VAT Number for valid VIES European registration.',
  'Invoice download link in notification email expires after 24 hours requiring portal login.',
  'Payment processing system retries failed card charges 5 times in 2 hours triggering fraud alert.',
  'PDF invoice generation fails with error 500 whenever customer company name exceeds 50 characters.'
];

// Theme 5: Webhook retries & event delivery timeouts (FB-201 .. FB-250)
const THEME_5_TEXTS = [
  'Slack integration sends duplicate webhook alert notifications for every customer feedback item.',
  'Webhook payload delivery fails with timeout when payload contains long multi-paragraph feedback text.',
  'Cannot configure webhook endpoint retry policy or view historical delivery failure logs.',
  'Webhook HMAC SHA-256 signature validation fails when payload contains non-English unicode characters.',
  'Zapier integration trigger fires multiple times for a single feedback ticket submission.',
  'Outbound webhooks drop event notifications silently without retry when destination server returns 503.',
  'Webhook delivery latency exceeds 45 seconds during high-volume feedback ingestion periods.',
  'Webhook testing modal in developer settings sends ping payload but does not display HTTP response.',
  'Webhook deliveries fail with SSL handshake error when destination endpoint uses Let\'s Encrypt cert.',
  'Need exponential backoff retry configuration for outbound webhooks with minimum 5 retry attempts.',
  'Webhook event payloads do not include customer tier metadata or unique account identifier.',
  'Outbound webhook delivery workers fail with HTTP 504 timeout when endpoint responds in over 5 seconds.',
  'Webhook signing secret cannot be rotated self-service without deleting and recreating webhook.',
  'Disabling a failing webhook endpoint is not possible without completely deleting its configuration.',
  'Webhook logs table does not display request headers, response status code, or response body.',
  'Webhook delivery fails with error code 400 Bad Request when feedback text contains raw backslashes.',
  'Real-time webhook notifications arrive out of chronological order during bulk CSV ingestion jobs.',
  'Outbound webhook requests do not include unique event ID header (X-Event-ID) for deduplication.',
  'Webhook subscription for cluster created events fails to fire when clusters are reconciled.',
  'Webhook endpoints configured with custom port numbers fail with invalid URL validation error.',
  'Webhook retry queue fills up and drops events when third-party server experiences 10-minute outage.',
  'Payload size limit for outbound webhooks is undocumented and truncates payloads larger than 64 KB.',
  'Webhook delivery to Microsoft Teams connector fails due to incompatible JSON card formatting.',
  'Cannot filter webhook subscriptions by specific event types such as feedback_ingested or cluster_updated.',
  'Webhook delivery worker drops requests without retry if DNS lookup takes more than 1 second.',
  'HMAC signature header X-Hub-Signature-256 is missing from webhook ping test verification requests.',
  'Webhook failure alerts are not sent to developer email when endpoint error rate exceeds 50 percent.',
  'Outbound webhooks sent to localhost or private IP addresses fail without clear error message.',
  'Webhook delivery queue latency spikes to 10 minutes when system processes large customer CSVs.',
  'Customer feedback updated webhook event payload is missing prior state values for diff comparison.',
  'Webhook delivery times out consistently when sending to AWS API Gateway endpoints with 29s timeout.',
  'Cannot configure custom HTTP headers such as Authorization Bearer token on outbound webhooks.',
  'Webhook logs truncate server response body to 100 characters making debugging API errors impossible.',
  'Outbound webhook worker process crashes on malformed JSON payload containing unescaped quotes.',
  'Webhook payload contains raw internal database IDs instead of canonical feedback IDs like FB-001.',
  'Webhook retry mechanism does not honor Retry-After response header returned by destination server.',
  'Automated webhook retry attempts stop after only 2 attempts, dropping critical event notifications.',
  'Webhook configuration page crashes with unhandled JavaScript error when entering URL over 120 chars.',
  'Webhook deliveries are suspended automatically after 3 failures without sending notification to admin.',
  'Webhook events for deleted feedback items are never dispatched to configured endpoints.',
  'Cannot test individual event types in webhook developer console without triggering live events.',
  'Webhook delivery requests fail with HTTP 413 error when batch feedback payload exceeds 1 MB.',
  'Webhooks configured for specific tags fire for all feedback items regardless of tag filters.',
  'Outbound webhook HTTP user agent header does not include product version or identification string.',
  'Webhook delivery service drops headers when redirecting through 301 or 302 HTTP status codes.',
  'Webhook delivery timestamps use Unix epoch seconds instead of standard ISO 8601 UTC strings.',
  'Destination servers receive duplicate webhook deliveries with identical timestamp and event payload.',
  'Webhook delivery logs do not record IP address of destination server that handled the request.',
  'Outbound webhooks fail silently when destination server returns HTTP 429 Too Many Requests.',
  'Webhook retry worker causes server CPU spike when thousands of failed deliveries accumulate.'
];

// Theme 6: Search filter persistence & query state loss (FB-251 .. FB-300)
const THEME_6_TEXTS = [
  'Full-text search in feedback view does not support boolean AND and OR search operator syntax.',
  'Search input clears query text automatically whenever new feedback items arrive via live sync.',
  'Filtering feedback by customer tier does not persist across page navigation or tab switching.',
  'Cannot search feedback text using exact phrase matching with surrounding quotation marks.',
  'Date range filter resets to last 7 days every time a filter tag is removed or modified.',
  'Tag search autocomplete dropdown is case sensitive and misses mixed-case or capitalized tags.',
  'Active filters are completely lost when clicking back button in browser navigation history.',
  'Filtering by multiple account IDs returns zero results instead of matching any selected account.',
  'Search query URL parameters are not updated when applying filters, preventing sharing search link.',
  'Clearing a single filter pill unexpectedly resets all other active filters to default state.',
  'Search input field lags by 500 milliseconds on every keystroke when dataset contains 1000 items.',
  'Filtering by severity rating blocker does not update cluster card counts in real-time.',
  'Search query containing special characters like plus or ampersand returns HTTP 400 error.',
  'Selected filter state is not preserved when refreshing browser page, forcing manual re-entry.',
  'Filter dropdown menu closes prematurely when user clicks multi-select checkboxes.',
  'Searching by customer email address yields no results if email contains uppercase characters.',
  'Date filter picker calendar widget is cut off by bottom viewport boundary on smaller laptop screens.',
  'Search indexing takes over 5 minutes to index newly imported CSV feedback items.',
  'Filtering by UNKNOWN customer tier returns empty list even when unmapped tier rows exist.',
  'Search results do not highlight matching keyword phrases within raw feedback text cards.',
  'Applying date filter between specific dates excludes items submitted on end date timestamp.',
  'Saved filter views cannot be renamed, edited, or deleted from the filter presets menu.',
  'Search input does not support keyboard shortcut such as CMD+K or slash to focus search bar.',
  'Multi-select account filter list lacks a select all or clear all shortcut button.',
  'Search query text box does not show clear X button when text is entered, requiring backspacing.',
  'Filtering by multiple tags uses OR logic instead of AND logic without any option to toggle.',
  'Search results pagination resets to page 1 unexpectedly when sorting column is changed.',
  'Filter drawer panel cannot be closed using ESC key on keyboard causing accessibility friction.',
  'Searching for feedback by feedback ID like FB-042 returns partial matches on random ID strings.',
  'Search filter bar overlaps top rows of feedback table when browser window width is under 1000px.',
  'Filter dropdown options do not show count badge indicating number of matching feedback rows.',
  'Applying account tier filter and exporting data exports all tiers instead of filtered subset.',
  'Search query input loses focus after typing first letter due to re-rendering parent component.',
  'Filtering by date range fails with NaN date error when browser locale uses DD/MM/YYYY format.',
  'Search indexing service throws unhandled exception when feedback text contains emojis.',
  'Saved search presets are not shared across team members within the same organization workspace.',
  'Search query returns stale cached results even after underlying feedback item was updated.',
  'Filter chips in header wrap awkwardly onto three lines, pushing main content below fold.',
  'Searching by account name fails if account name has leading or trailing whitespace.',
  'Date range preset Last 30 Days calculates 30 days from UTC midnight rather than user local time.',
  'Multi-select dropdown search input field does not autofocus when dropdown menu opens.',
  'Search results table does not display total count of matching feedback items found.',
  'Filter by customer tier dropdown lists Free tier twice when some rows have lowercase free.',
  'Searching text with hyphenated words such as real-time fails to match text containing real time.',
  'Clearing search input does not restore full list of feedback items until user clicks away.',
  'Filter modal dialog is not accessible via keyboard tab navigation, trapping keyboard focus.',
  'Search results sort order changes randomly when clicking on pagination page numbers.',
  'Applying more than 4 simultaneous filters causes browser URL length to exceed limit and error.',
  'Search autocomplete suggests deleted feedback tags that have no active feedback items.',
  'Search query state is wiped out completely when user switches between matrix view and card view.'
];

// Accounts ACC-101 .. ACC-150
function getAccountId(index) {
  // ~5% missing account IDs to test estimated account metrics
  if (index % 20 === 0) return '';
  const num = 101 + (index % 50);
  return `ACC-${num}`;
}

// Tier distribution: Enterprise, Pro, Free, and blank UNKNOWN
function getTier(index) {
  const mod = index % 10;
  if (mod === 0) return ''; // ~10% UNKNOWN (blank)
  if (mod <= 4) return 'Enterprise'; // ~40% Enterprise
  if (mod <= 7) return 'Pro'; // ~30% Pro
  return 'Free'; // ~20% Free
}

// Date distribution: 2026-09-01 .. 2026-10-10
function getDate(index) {
  const start = new Date('2026-09-01T00:00:00Z').getTime();
  const end = new Date('2026-10-10T00:00:00Z').getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const daysTotal = Math.floor((end - start) / dayMs);
  const offsetDays = index % (daysTotal + 1);
  const targetDate = new Date(start + offsetDays * dayMs);
  return targetDate.toISOString().split('T')[0];
}

function escapeCsvCell(cell) {
  if (cell === null || cell === undefined) return '';
  const str = String(cell);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generate300RowsCsv() {
  const allTexts = [
    ...THEME_1_TEXTS,
    ...THEME_2_TEXTS,
    ...THEME_3_TEXTS,
    ...THEME_4_TEXTS,
    ...THEME_5_TEXTS,
    ...THEME_6_TEXTS
  ];

  if (allTexts.length !== 300) {
    throw new Error(`Expected exactly 300 texts, got ${allTexts.length}`);
  }

  const rows = [];
  rows.push(['Feedback ID', 'Raw Feedback Text', 'Customer Tier', 'Account ID', 'Date'].map(escapeCsvCell).join(','));

  for (let i = 0; i < 300; i++) {
    const feedbackId = `FB-${String(i + 1).padStart(3, '0')}`;
    const text = allTexts[i];
    const tier = getTier(i);
    const accountId = getAccountId(i);
    const date = getDate(i);

    rows.push([feedbackId, text, tier, accountId, date].map(escapeCsvCell).join(','));
  }

  return rows.join('\n') + '\n';
}

// Run if directly called
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const csvContent = generate300RowsCsv();
  fs.writeFileSync(TARGET_PATH, csvContent, 'utf8');
  console.log(`[FIXTURE GENERATED] Successfully wrote 300 rows to ${TARGET_PATH}`);
  const lines = csvContent.trim().split('\n');
  console.log(`[VERIFICATION] Total lines: ${lines.length} (1 header + 300 data rows)`);
  console.log(`[HEADER]: ${lines[0]}`);
  console.log(`[FIRST ROW]: ${lines[1]}`);
  console.log(`[LAST ROW]: ${lines[lines.length - 1]}`);
}
