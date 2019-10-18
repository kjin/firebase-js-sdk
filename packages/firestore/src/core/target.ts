/**
 * @license
 * Copyright 2019 Google Inc.
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

import { DocumentKey } from '../model/document_key';
import { ResourcePath } from '../model/path';
import { isNullOrUndefined } from '../util/types';
import { Bound, Filter, OrderBy, Query } from './query';

/**
 * Target is the class we use to convert to query proto, to save in LocalStore
 * and send to backend via RemoteStore. It only has the query attributes backend
 * supports, unlike `Query`, which might have attributes we support locally
 * in the SDK.
 */
export class Target {
  private memoizedCanonicalId: string | null = null;

  /**
   * Initializes a Target with a path and optional additional query constraints.
   * Path must currently be empty if this is a collection group query.
   *
   * NOTE: you should always construct `Target` from `Query.toTarget` instead of
   * using this constructor, because `Query` provides sensible default `orderBy`
   * property.
   */
  constructor(
    readonly path: ResourcePath,
    readonly collectionGroup: string | null = null,
    readonly orderBy: OrderBy[] = [],
    readonly filters: Filter[] = [],
    readonly limit: number | null = null,
    readonly startAt: Bound | null = null,
    readonly endAt: Bound | null = null
  ) {}

  canonicalId(): string {
    if (this.memoizedCanonicalId === null) {
      let canonicalId = this.path.canonicalString();
      if (this.collectionGroup !== null) {
        canonicalId += '|cg:' + this.collectionGroup;
      }
      canonicalId += '|f:';
      for (const filter of this.filters) {
        canonicalId += filter.canonicalId();
        canonicalId += ',';
      }
      canonicalId += '|ob:';
      // TODO(dimond): make this collision resistant
      for (const orderBy of this.orderBy) {
        canonicalId += orderBy.canonicalId();
        canonicalId += ',';
      }
      if (!isNullOrUndefined(this.limit)) {
        canonicalId += '|l:';
        canonicalId += this.limit!;
      }
      if (this.startAt) {
        canonicalId += '|lb:';
        canonicalId += this.startAt.canonicalId();
      }
      if (this.endAt) {
        canonicalId += '|ub:';
        canonicalId += this.endAt.canonicalId();
      }
      this.memoizedCanonicalId = canonicalId;
    }
    return this.memoizedCanonicalId;
  }

  toString(): string {
    return `Target(${this.toContentString()})`;
  }

  toContentString(): string {
    let str = this.path.canonicalString();
    if (this.collectionGroup !== null) {
      str += ' collectionGroup=' + this.collectionGroup;
    }
    if (this.filters.length > 0) {
      str += `, filters: [${this.filters.join(', ')}]`;
    }
    if (!isNullOrUndefined(this.limit)) {
      str += ', limit: ' + this.limit;
    }
    if (this.orderBy.length > 0) {
      str += `, orderBy: [${this.orderBy.join(', ')}]`;
    }
    if (this.startAt) {
      str += ', startAt: ' + this.startAt.canonicalId();
    }
    if (this.endAt) {
      str += ', endAt: ' + this.endAt.canonicalId();
    }

    return str;
  }

  isEqual(other: Target): boolean {
    if (this.limit !== other.limit) {
      return false;
    }

    if (this.orderBy.length !== other.orderBy.length) {
      return false;
    }

    for (let i = 0; i < this.orderBy.length; i++) {
      if (!this.orderBy[i].isEqual(other.orderBy[i])) {
        return false;
      }
    }

    if (this.filters.length !== other.filters.length) {
      return false;
    }

    for (let i = 0; i < this.filters.length; i++) {
      if (!this.filters[i].isEqual(other.filters[i])) {
        return false;
      }
    }

    if (this.collectionGroup !== other.collectionGroup) {
      return false;
    }

    if (!this.path.isEqual(other.path)) {
      return false;
    }

    if (
      this.startAt !== null
        ? !this.startAt.isEqual(other.startAt)
        : other.startAt !== null
    ) {
      return false;
    }

    return this.endAt !== null
      ? this.endAt.isEqual(other.endAt)
      : other.endAt === null;
  }

  isDocumentQuery(): boolean {
    return (
      DocumentKey.isDocumentKey(this.path) &&
      this.collectionGroup === null &&
      this.filters.length === 0
    );
  }

  /**
   * Creates a `Query` object from this `Target`. Note the result might be
   * different from the original `Query` from which we get this instance.
   */
  toTargetQuery(): Query {
    return new Query(
      this.path,
      this.collectionGroup,
      this.orderBy,
      this.filters,
      this.limit,
      this.startAt,
      this.endAt
    );
  }
}