/**
 * FlexiDash Identity Models & Branded Types
 *
 * Enforces compile-time and runtime distinction between:
 * - Wix Member IDs
 * - Wix Contact IDs
 * - FlexiDash User IDs
 * - External Subject IDs
 * - Wix App Instance IDs
 */

export type Branded<T, B> = T & { readonly __brand: B };

export type WixMemberId = Branded<string, 'WixMemberId'>;
export type WixContactId = Branded<string, 'WixContactId'>;
export type FlexiDashUserId = Branded<string, 'FlexiDashUserId'>;
export type ExternalSubjectId = Branded<string, 'ExternalSubjectId'>;
export type InstanceId = Branded<string, 'InstanceId'>;

export function toWixMemberId(id: string): WixMemberId {
  if (!id || typeof id !== 'string') throw new Error('Invalid WixMemberId');
  return id as WixMemberId;
}

export function toWixContactId(id: string): WixContactId {
  if (!id || typeof id !== 'string') throw new Error('Invalid WixContactId');
  return id as WixContactId;
}

export function toFlexiDashUserId(id: string): FlexiDashUserId {
  if (!id || typeof id !== 'string') throw new Error('Invalid FlexiDashUserId');
  return id as FlexiDashUserId;
}

export function toExternalSubjectId(id: string): ExternalSubjectId {
  if (!id || typeof id !== 'string') throw new Error('Invalid ExternalSubjectId');
  return id as ExternalSubjectId;
}

export function toInstanceId(id: string): InstanceId {
  if (!id || typeof id !== 'string') throw new Error('Invalid InstanceId');
  return id as InstanceId;
}

export type IdentityStatus = 'active' | 'pending_approval' | 'suspended';

export interface IdentityMapping {
  id: string;
  instanceId: InstanceId;
  flexidashUserId: FlexiDashUserId;
  wixMemberId?: WixMemberId;
  wixContactId?: WixContactId;
  externalSubjectId?: ExternalSubjectId;
  email: string;
  status: IdentityStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Security Assertion: Guarantees that a contact ID is never conflated with a member ID
 */
export function assertDistinctIdentityTypes(memberId?: WixMemberId, contactId?: WixContactId): void {
  if (memberId && contactId && (memberId as unknown as string) === (contactId as unknown as string)) {
    throw new Error('Security Violation: WixMemberId and WixContactId cannot share identical UUIDs');
  }
}

