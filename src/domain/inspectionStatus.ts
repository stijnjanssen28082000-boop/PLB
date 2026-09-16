import type { InspectionStatus } from './types';

/**
 * The status flow from docs/datamodel.md 3.4. Mirrors
 * allowed_inspection_transition() in the Postgres migrations — the app checks it
 * so the inspector gets a sane error offline, the server checks it because the
 * app runs on a device we do not control.
 */
const ALLOWED_TRANSITIONS: Record<InspectionStatus, InspectionStatus[]> = {
  draft: ['in_progress'],
  in_progress: ['awaiting_signatures'],
  // An inspector who spots something on the summary screen goes back to work.
  awaiting_signatures: ['in_progress', 'signed'],
  signed: ['pending_sync'],
  pending_sync: ['synced'],
  synced: ['ai_processing', 'review'],
  ai_processing: ['review'],
  review: ['approved'],
  approved: ['sent'],
  sent: ['archived'],
  archived: [],
};

const LOCKED_STATUSES = new Set<InspectionStatus>([
  'signed',
  'pending_sync',
  'synced',
  'ai_processing',
  'review',
  'approved',
  'sent',
  'archived',
]);

/** Everything from `signed` on is immutable apart from AI review and approval. */
export const isLockedStatus = (status: InspectionStatus): boolean => LOCKED_STATUSES.has(status);

export class InvalidStatusTransitionError extends Error {
  constructor(
    readonly from: InspectionStatus,
    readonly to: InspectionStatus,
  ) {
    super(`Invalid inspection status transition: ${from} -> ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

export function canTransition(from: InspectionStatus, to: InspectionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * The only way a status changes (§6.4). Returns the new status so callers read
 * as `inspection.status = transitionInspectionStatus(...)`.
 */
export function transitionInspectionStatus(
  from: InspectionStatus,
  to: InspectionStatus,
): InspectionStatus {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
  return to;
}
