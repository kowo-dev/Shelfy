export interface DomainRule {
  domain: string;
  reason: string | null;
  createdAt: string;
}

export interface KnownInstance {
  domain: string;
  accounts: number;
  followedLocally: number;
  lastSeen: string | null;
  pendingDeliveries: number;
  failingDeliveries: number;
  lastError: string | null;
  isBlocked: boolean;
  isAllowed: boolean;
}

export interface FederationOverview {
  isEnabled: boolean;
  mode: 'open' | 'allowlist';
  handleDomain: string;
  instances: KnownInstance[];
  blocks: DomainRule[];
  allows: DomainRule[];
  reports: number;
}

export interface FederationReport {
  id: string;
  reporterDomain: string;
  reporterHandle: string | null;
  targetHandle: string | null;
  objectUris: string;
  content: string | null;
  createdAt: string;
}
