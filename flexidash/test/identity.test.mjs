import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toWixMemberId,
  toWixContactId,
  toFlexiDashUserId,
  toInstanceId,
  assertDistinctIdentityTypes,
} from '../src/models/identity.ts';

test('Identity Taxonomy & Separation Suite', async (t) => {
  await t.test('properly brands distinct identifier types', () => {
    const memberId = toWixMemberId('wm-uuid-1234');
    const contactId = toWixContactId('wc-uuid-5678');
    const userId = toFlexiDashUserId('fd-uuid-9999');
    const instId = toInstanceId('inst-uuid-0000');

    assert.equal(typeof memberId, 'string');
    assert.equal(typeof contactId, 'string');
    assert.equal(typeof userId, 'string');
    assert.equal(typeof instId, 'string');
    assert.notEqual(memberId, contactId);
  });

  await t.test('assertDistinctIdentityTypes passes when memberId and contactId are distinct', () => {
    const memberId = toWixMemberId('wm-uuid-1234');
    const contactId = toWixContactId('wc-uuid-5678');

    assert.doesNotThrow(() => {
      assertDistinctIdentityTypes(memberId, contactId);
    });
  });

  await t.test('assertDistinctIdentityTypes throws error if memberId and contactId share identical string', () => {
    const memberId = toWixMemberId('shared-uuid');
    const contactId = toWixContactId('shared-uuid');

    assert.throws(
      () => {
        assertDistinctIdentityTypes(memberId, contactId);
      },
      /Security Violation/,
      'Must reject conflation of Member ID and Contact ID'
    );
  });
});
