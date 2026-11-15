/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aurora from "../aurora.js";
import type * as bounty from "../bounty.js";
import type * as case01 from "../case01.js";
import type * as challenges from "../challenges.js";
import type * as creatorGrowth from "../creatorGrowth.js";
import type * as creatorIdentity from "../creatorIdentity.js";
import type * as demo from "../demo.js";
import type * as drops from "../drops.js";
import type * as feed from "../feed.js";
import type * as http from "../http.js";
import type * as pings from "../pings.js";
import type * as presence from "../presence.js";
import type * as push from "../push.js";
import type * as rateLimits from "../rateLimits.js";
import type * as signal from "../signal.js";
import type * as templates_aurora from "../templates/aurora.js";
import type * as templates_engine from "../templates/engine.js";
import type * as templates_random from "../templates/random.js";
import type * as templates_registry from "../templates/registry.js";
import type * as templates_splitCode from "../templates/splitCode.js";
import type * as templates_types from "../templates/types.js";
import type * as whop from "../whop.js";
import type * as whopAuth from "../whopAuth.js";
import type * as whopCreator from "../whopCreator.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aurora: typeof aurora;
  bounty: typeof bounty;
  case01: typeof case01;
  challenges: typeof challenges;
  creatorGrowth: typeof creatorGrowth;
  creatorIdentity: typeof creatorIdentity;
  demo: typeof demo;
  drops: typeof drops;
  feed: typeof feed;
  http: typeof http;
  pings: typeof pings;
  presence: typeof presence;
  push: typeof push;
  rateLimits: typeof rateLimits;
  signal: typeof signal;
  "templates/aurora": typeof templates_aurora;
  "templates/engine": typeof templates_engine;
  "templates/random": typeof templates_random;
  "templates/registry": typeof templates_registry;
  "templates/splitCode": typeof templates_splitCode;
  "templates/types": typeof templates_types;
  whop: typeof whop;
  whopAuth: typeof whopAuth;
  whopCreator: typeof whopCreator;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
