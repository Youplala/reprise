import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeOfficialIdentity } from '../src/services/official-identity.ts';

test('exige un nom et un e-mail valide, nettoie le reste', () => {
  assert.equal(normalizeOfficialIdentity({ fullName: 'Élie', email: 'pas-un-mail' }), undefined);
  assert.equal(normalizeOfficialIdentity({ fullName: ' ', email: 'a@b.fr' }), undefined);
  assert.deepEqual(
    normalizeOfficialIdentity({
      fullName: '  Élie   BROSSET ',
      email: ' Elie@Example.com ',
      age: '32 ans',
      residenceCity: ' Paris ',
      country: '',
    }),
    { fullName: 'Élie BROSSET', email: 'elie@example.com', age: '32', residenceCity: 'Paris', country: undefined },
  );
});
