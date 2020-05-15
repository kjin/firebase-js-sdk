/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { IdTokenResult } from '@firebase/auth-types-exp';

import { AuthInternal } from '../../model/auth';
import { UserInternal } from '../../model/user';
import { PersistedBlob } from '../persistence';
import { ProviderId } from '../providers';
import { assert } from '../util/assert';
import { castInternal } from '../util/cast_internal';
import { getIdTokenResult } from './id_token_result';
import { reload } from './reload';
import { StsTokenManager } from './token_manager';

export interface UserParameters {
  uid: string;
  auth: AuthInternal;
  stsTokenManager: StsTokenManager;

  displayName?: string;
  email?: string;
  phoneNumber?: string;
  photoURL?: string;
}

function assertStringOrUndefined(
  assertion: unknown,
  appName: string
): asserts assertion is string | undefined {
  assert(
    typeof assertion === 'string' || typeof assertion === 'undefined',
    appName
  );
}

export class UserImpl implements UserInternal {
  // For the user object, provider is always Firebase.
  readonly providerId = ProviderId.FIREBASE;
  stsTokenManager: StsTokenManager;
  refreshToken = '';

  uid: string;
  auth: AuthInternal;
  emailVerified = false;
  tenantId = null;
  metadata = {};
  providerData = [];

  // Optional fields from UserInfo
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;

  constructor({ uid, auth, stsTokenManager, ...opt }: UserParameters) {
    this.uid = uid;
    this.auth = auth;
    this.stsTokenManager = stsTokenManager;
    this.displayName = opt.displayName || null;
    this.email = opt.email || null;
    this.phoneNumber = opt.phoneNumber || null;
    this.photoURL = opt.photoURL || null;
  }

  async getIdToken(forceRefresh?: boolean): Promise<string> {
    const tokens = await this.stsTokenManager.getToken(this.auth, forceRefresh);
    assert(tokens, this.auth.name);

    const { refreshToken, accessToken, wasRefreshed } = tokens;
    this.refreshToken = refreshToken || '';

    if (wasRefreshed && castInternal(this.auth.currentUser) === this) {
      this.auth._notifyStateListeners();
    }

    return accessToken;
  }

  getIdTokenResult(forceRefresh?: boolean): Promise<IdTokenResult> {
    return getIdTokenResult(castInternal(this), forceRefresh);
  }

  reload(): Promise<void> {
    return reload(castInternal(this));
  }

  delete(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  toPlainObject(): PersistedBlob {
    return {
      uid: this.uid,
      stsTokenManager: this.stsTokenManager.toPlainObject(),
      displayName: this.displayName || undefined,
      email: this.email || undefined,
      phoneNumber: this.phoneNumber || undefined,
      photoURL: this.phoneNumber || undefined
    };
  }

  static fromPlainObject(
    auth: AuthInternal,
    object: PersistedBlob
  ): UserInternal {
    const {
      uid,
      stsTokenManager: plainObjectTokenManager,
      displayName,
      email,
      phoneNumber,
      photoURL
    } = object;

    assert(uid && plainObjectTokenManager, auth.name);

    const stsTokenManager = StsTokenManager.fromPlainObject(
      auth.name,
      plainObjectTokenManager as PersistedBlob
    );

    assert(typeof uid === 'string', auth.name);
    assertStringOrUndefined(displayName, auth.name);
    assertStringOrUndefined(email, auth.name);
    assertStringOrUndefined(phoneNumber, auth.name);
    assertStringOrUndefined(photoURL, auth.name);
    return new UserImpl({
      uid,
      auth,
      stsTokenManager,
      displayName,
      email,
      phoneNumber,
      photoURL
    });
  }
}
