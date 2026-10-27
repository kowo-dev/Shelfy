export interface LegalInfo {
  controllerName: string | null;
  contactEmail: string | null;
  jurisdiction: string | null;
  hostingProviderName: string | null;
  hostingProviderAddress: string | null;
  isFederationEnabled: boolean;
  isRegistrationOpen: boolean;
}
