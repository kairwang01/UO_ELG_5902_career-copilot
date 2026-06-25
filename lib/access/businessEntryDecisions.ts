export type BusinessPortalActionDecision =
  | 'enter_portal'
  | 'open_signup'
  | 'open_business_access_prompt'
  | 'go_back';

interface BusinessPortalActionInput {
  hasSession: boolean;
  canEnterBusinessPortal: boolean;
  hasPortalHandler: boolean;
}

export function decideBusinessPortalAction(input: BusinessPortalActionInput): BusinessPortalActionDecision {
  if (!input.hasSession) return 'open_signup';
  if (!input.canEnterBusinessPortal) return 'open_business_access_prompt';
  return input.hasPortalHandler ? 'enter_portal' : 'go_back';
}
