/**
 * Central access-control registry.
 *
 * Single source of truth for who can do what across the product. UI code must
 * derive visibility from these maps instead of scattering role booleans in
 * components. The server stays authoritative — these maps only drive what the
 * client renders; every privileged action is re-checked in Cloud Functions
 * (requireAdmin / role checks in functions/src).
 *
 * Two role families exist today and are kept deliberately separate:
 *  - Product roles: who the user is in the product (candidate/employer/…),
 *    stored on users/{uid}.role + subscription_status.
 *  - Admin roles: operators of the platform console (reviewer/admin/super),
 *    resolved server-side via adminWhoAmI().
 * API clients (keys created in Account → API Access) are scoped separately
 * via API_KEY_SCOPES — a key never inherits its owner's admin role.
 */

// ─── admin console permissions ───────────────────────────────────────────────

export type AdminRole = 'reviewer' | 'admin' | 'super';

export type AdminPermission =
  | 'admin.dashboard.read'
  | 'admin.audit.read'
  | 'admin.users.read'
  | 'admin.users.credits.adjust'
  | 'admin.users.subscription.write'
  | 'admin.prompts.read'
  | 'admin.prompts.draft'
  | 'admin.prompts.publish'
  | 'admin.quotas.read'
  | 'admin.quotas.write'
  | 'admin.models.read'
  | 'admin.models.write'
  | 'admin.keys.read'
  | 'admin.keys.rotate'
  | 'admin.admins.manage'
  | 'admin.apiplatform.read'
  | 'admin.apiplatform.manage'
  | 'admin.web3.manage';

const REVIEWER_PERMISSIONS: AdminPermission[] = [
  'admin.dashboard.read',
  'admin.audit.read',
];

const ADMIN_PERMISSIONS: AdminPermission[] = [
  ...REVIEWER_PERMISSIONS,
  'admin.users.read',
  'admin.users.credits.adjust',
  'admin.users.subscription.write',
  'admin.prompts.read',
  'admin.prompts.draft',
  'admin.quotas.read',
  'admin.quotas.write',
  'admin.apiplatform.read',
];

const SUPER_PERMISSIONS: AdminPermission[] = [
  ...ADMIN_PERMISSIONS,
  'admin.prompts.publish',
  'admin.models.read',
  'admin.models.write',
  'admin.keys.read',
  'admin.keys.rotate',
  'admin.admins.manage',
  'admin.apiplatform.manage',
  'admin.web3.manage',
];

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  reviewer: new Set(REVIEWER_PERMISSIONS),
  admin: new Set(ADMIN_PERMISSIONS),
  super: new Set(SUPER_PERMISSIONS),
};

export const hasAdminPermission = (
  role: AdminRole | null | undefined,
  permission: AdminPermission,
): boolean => (role ? ADMIN_ROLE_PERMISSIONS[role].has(permission) : false);

/** Human-readable summaries rendered in the Access Control permission matrix. */
export const ADMIN_ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  reviewer: 'Read-only oversight: platform dashboard and the audit trail.',
  admin: 'Day-to-day operations: users, credits, subscriptions, prompts (drafts), quotas.',
  super: 'Full control: everything above plus model routing, provider keys, prompt publishing, admin invitations, API platform and Web3 settings.',
};

/**
 * Rows of the read-only permission matrix shown on the Access Control tab.
 * Kept as data so the UI never hand-maintains checkmarks.
 */
export const ADMIN_PERMISSION_MATRIX: { label: string; permission: AdminPermission }[] = [
  { label: 'View dashboard & metrics', permission: 'admin.dashboard.read' },
  { label: 'View audit log', permission: 'admin.audit.read' },
  { label: 'View users', permission: 'admin.users.read' },
  { label: 'Adjust credits', permission: 'admin.users.credits.adjust' },
  { label: 'Override subscriptions', permission: 'admin.users.subscription.write' },
  { label: 'Edit prompt drafts', permission: 'admin.prompts.draft' },
  { label: 'Publish / roll back prompts', permission: 'admin.prompts.publish' },
  { label: 'Edit platform quotas', permission: 'admin.quotas.write' },
  { label: 'Manage models & routing', permission: 'admin.models.write' },
  { label: 'View / rotate provider keys', permission: 'admin.keys.rotate' },
  { label: 'Invite / remove admins', permission: 'admin.admins.manage' },
  { label: 'View API platform usage', permission: 'admin.apiplatform.read' },
  { label: 'Manage API platform', permission: 'admin.apiplatform.manage' },
  { label: 'Manage Web3 settings', permission: 'admin.web3.manage' },
];

// ─── product roles (documentation + matrix source) ───────────────────────────

export type ProductRole =
  | 'anonymous'
  | 'candidate_free'
  | 'candidate_paid'
  | 'employer'
  | 'agency';

/**
 * What each product role can reach. This mirrors the gates that actually run
 * (route guards in SiteRouter/CareerApp, tier checks in resolveProvider) and is
 * rendered on the Access Control tab so the team has one place to read it.
 */
export const PRODUCT_ROLE_ACCESS: Record<ProductRole, { label: string; access: string[] }> = {
  anonymous: {
    label: 'Visitor (signed out)',
    access: ['Marketing pages', 'Pricing', 'Sample report', 'Job browsing (read-only)'],
  },
  candidate_free: {
    label: 'Candidate · Free',
    access: ['Workspace', 'Resume analysis (credit-gated)', 'Free-tier models (output-capped)', 'Job search & applications', 'Personal API keys'],
  },
  candidate_paid: {
    label: 'Candidate · Paid',
    access: ['Everything in Free', 'Paid model tier', 'Higher monthly credits', 'Full toolkit without analysis limits'],
  },
  employer: {
    label: 'Employer',
    access: ['Hiring portal', 'Job posting & applicant funnel', 'Talent discovery & shortlist', 'Org profile & billing', 'Custom AI endpoint (BYOA)'],
  },
  agency: {
    label: 'Agency',
    access: ['Agency hub', 'Bulk candidate review'],
  },
};

// ─── API client scopes ───────────────────────────────────────────────────────

/**
 * Scopes attachable to API-platform keys. A key carries an explicit scope list;
 * the server must enforce the scope on every call (never trust the client).
 */
export const API_KEY_SCOPES = [
  { id: 'resume.analyze', description: 'Run resume analysis' },
  { id: 'tools.generate', description: 'Run generation tools (cover letter, plans, …)' },
  { id: 'jobs.read', description: 'Read active job postings' },
  { id: 'usage.read', description: 'Read own usage and quota state' },
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]['id'];
