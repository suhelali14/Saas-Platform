
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model ProviderUser
 * Who can sign in to the console. This is the vendor's own team.
 */
export type ProviderUser = $Result.DefaultSelection<Prisma.$ProviderUserPayload>
/**
 * Model ClinicAccount
 * One clinic customer.
 */
export type ClinicAccount = $Result.DefaultSelection<Prisma.$ClinicAccountPayload>
/**
 * Model OnboardingStep
 * The onboarding checklist for one clinic. Rows are created from a fixed
 * template when the account is created, so progress is visible rather than
 * living in someone's head.
 */
export type OnboardingStep = $Result.DefaultSelection<Prisma.$OnboardingStepPayload>
/**
 * Model ActivityLog
 * Append-only record of what was done to an account and by whom. The same
 * reasoning as the clinic's own audit log: an action on a customer's
 * infrastructure should be attributable months later.
 */
export type ActivityLog = $Result.DefaultSelection<Prisma.$ActivityLogPayload>
/**
 * Model HealthCheck
 * Result of pinging a clinic's /health endpoint. Deliberately the only
 * thing this console ever reads from a live clinic deployment — no patient
 * data, no counts, nothing behind auth.
 */
export type HealthCheck = $Result.DefaultSelection<Prisma.$HealthCheckPayload>
/**
 * Model Invoice
 * One of Nayaverse's own invoices to a clinic. A GST tax invoice once it
 * is ISSUED: from then on its lines and number are never edited, only
 * marked paid or voided -- an invoice that changes after it was sent is
 * not an invoice.
 */
export type Invoice = $Result.DefaultSelection<Prisma.$InvoicePayload>
/**
 * Model PlanChange
 * Every change to what a clinic is entitled to, and whether it reached
 * the clinic. The answer to "when did they move to Hospital, and who
 * agreed it" a year later.
 */
export type PlanChange = $Result.DefaultSelection<Prisma.$PlanChangePayload>

/**
 * Enums
 */
export namespace $Enums {
  export const ProviderRole: {
  OWNER: 'OWNER',
  STAFF: 'STAFF'
};

export type ProviderRole = (typeof ProviderRole)[keyof typeof ProviderRole]


export const AccountStatus: {
  LEAD: 'LEAD',
  ONBOARDING: 'ONBOARDING',
  LIVE: 'LIVE',
  SUSPENDED: 'SUSPENDED',
  CHURNED: 'CHURNED'
};

export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus]


export const PlanTier: {
  BASIC: 'BASIC',
  STANDARD: 'STANDARD',
  PREMIUM: 'PREMIUM',
  ENTERPRISE: 'ENTERPRISE'
};

export type PlanTier = (typeof PlanTier)[keyof typeof PlanTier]


export const BillingCycle: {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  ANNUAL: 'ANNUAL'
};

export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle]


export const PricingModel: {
  SETUP_YEARLY: 'SETUP_YEARLY',
  SUBSCRIPTION: 'SUBSCRIPTION',
  LICENCE_AMC: 'LICENCE_AMC'
};

export type PricingModel = (typeof PricingModel)[keyof typeof PricingModel]


export const InvoiceStatus: {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PAID: 'PAID',
  VOID: 'VOID'
};

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus]

}

export type ProviderRole = $Enums.ProviderRole

export const ProviderRole: typeof $Enums.ProviderRole

export type AccountStatus = $Enums.AccountStatus

export const AccountStatus: typeof $Enums.AccountStatus

export type PlanTier = $Enums.PlanTier

export const PlanTier: typeof $Enums.PlanTier

export type BillingCycle = $Enums.BillingCycle

export const BillingCycle: typeof $Enums.BillingCycle

export type PricingModel = $Enums.PricingModel

export const PricingModel: typeof $Enums.PricingModel

export type InvoiceStatus = $Enums.InvoiceStatus

export const InvoiceStatus: typeof $Enums.InvoiceStatus

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more ProviderUsers
 * const providerUsers = await prisma.providerUser.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more ProviderUsers
   * const providerUsers = await prisma.providerUser.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.providerUser`: Exposes CRUD operations for the **ProviderUser** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ProviderUsers
    * const providerUsers = await prisma.providerUser.findMany()
    * ```
    */
  get providerUser(): Prisma.ProviderUserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.clinicAccount`: Exposes CRUD operations for the **ClinicAccount** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ClinicAccounts
    * const clinicAccounts = await prisma.clinicAccount.findMany()
    * ```
    */
  get clinicAccount(): Prisma.ClinicAccountDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.onboardingStep`: Exposes CRUD operations for the **OnboardingStep** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more OnboardingSteps
    * const onboardingSteps = await prisma.onboardingStep.findMany()
    * ```
    */
  get onboardingStep(): Prisma.OnboardingStepDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.activityLog`: Exposes CRUD operations for the **ActivityLog** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ActivityLogs
    * const activityLogs = await prisma.activityLog.findMany()
    * ```
    */
  get activityLog(): Prisma.ActivityLogDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.healthCheck`: Exposes CRUD operations for the **HealthCheck** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more HealthChecks
    * const healthChecks = await prisma.healthCheck.findMany()
    * ```
    */
  get healthCheck(): Prisma.HealthCheckDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.invoice`: Exposes CRUD operations for the **Invoice** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Invoices
    * const invoices = await prisma.invoice.findMany()
    * ```
    */
  get invoice(): Prisma.InvoiceDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.planChange`: Exposes CRUD operations for the **PlanChange** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more PlanChanges
    * const planChanges = await prisma.planChange.findMany()
    * ```
    */
  get planChange(): Prisma.PlanChangeDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.19.3
   * Query Engine version: c2990dca591cba766e3b7ef5d9e8a84796e47ab7
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    ProviderUser: 'ProviderUser',
    ClinicAccount: 'ClinicAccount',
    OnboardingStep: 'OnboardingStep',
    ActivityLog: 'ActivityLog',
    HealthCheck: 'HealthCheck',
    Invoice: 'Invoice',
    PlanChange: 'PlanChange'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "providerUser" | "clinicAccount" | "onboardingStep" | "activityLog" | "healthCheck" | "invoice" | "planChange"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      ProviderUser: {
        payload: Prisma.$ProviderUserPayload<ExtArgs>
        fields: Prisma.ProviderUserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ProviderUserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProviderUserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ProviderUserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProviderUserPayload>
          }
          findFirst: {
            args: Prisma.ProviderUserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProviderUserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ProviderUserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProviderUserPayload>
          }
          findMany: {
            args: Prisma.ProviderUserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProviderUserPayload>[]
          }
          create: {
            args: Prisma.ProviderUserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProviderUserPayload>
          }
          createMany: {
            args: Prisma.ProviderUserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ProviderUserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProviderUserPayload>[]
          }
          delete: {
            args: Prisma.ProviderUserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProviderUserPayload>
          }
          update: {
            args: Prisma.ProviderUserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProviderUserPayload>
          }
          deleteMany: {
            args: Prisma.ProviderUserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ProviderUserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ProviderUserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProviderUserPayload>[]
          }
          upsert: {
            args: Prisma.ProviderUserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ProviderUserPayload>
          }
          aggregate: {
            args: Prisma.ProviderUserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateProviderUser>
          }
          groupBy: {
            args: Prisma.ProviderUserGroupByArgs<ExtArgs>
            result: $Utils.Optional<ProviderUserGroupByOutputType>[]
          }
          count: {
            args: Prisma.ProviderUserCountArgs<ExtArgs>
            result: $Utils.Optional<ProviderUserCountAggregateOutputType> | number
          }
        }
      }
      ClinicAccount: {
        payload: Prisma.$ClinicAccountPayload<ExtArgs>
        fields: Prisma.ClinicAccountFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ClinicAccountFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClinicAccountPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ClinicAccountFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClinicAccountPayload>
          }
          findFirst: {
            args: Prisma.ClinicAccountFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClinicAccountPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ClinicAccountFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClinicAccountPayload>
          }
          findMany: {
            args: Prisma.ClinicAccountFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClinicAccountPayload>[]
          }
          create: {
            args: Prisma.ClinicAccountCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClinicAccountPayload>
          }
          createMany: {
            args: Prisma.ClinicAccountCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ClinicAccountCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClinicAccountPayload>[]
          }
          delete: {
            args: Prisma.ClinicAccountDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClinicAccountPayload>
          }
          update: {
            args: Prisma.ClinicAccountUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClinicAccountPayload>
          }
          deleteMany: {
            args: Prisma.ClinicAccountDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ClinicAccountUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ClinicAccountUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClinicAccountPayload>[]
          }
          upsert: {
            args: Prisma.ClinicAccountUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ClinicAccountPayload>
          }
          aggregate: {
            args: Prisma.ClinicAccountAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateClinicAccount>
          }
          groupBy: {
            args: Prisma.ClinicAccountGroupByArgs<ExtArgs>
            result: $Utils.Optional<ClinicAccountGroupByOutputType>[]
          }
          count: {
            args: Prisma.ClinicAccountCountArgs<ExtArgs>
            result: $Utils.Optional<ClinicAccountCountAggregateOutputType> | number
          }
        }
      }
      OnboardingStep: {
        payload: Prisma.$OnboardingStepPayload<ExtArgs>
        fields: Prisma.OnboardingStepFieldRefs
        operations: {
          findUnique: {
            args: Prisma.OnboardingStepFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OnboardingStepPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.OnboardingStepFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OnboardingStepPayload>
          }
          findFirst: {
            args: Prisma.OnboardingStepFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OnboardingStepPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.OnboardingStepFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OnboardingStepPayload>
          }
          findMany: {
            args: Prisma.OnboardingStepFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OnboardingStepPayload>[]
          }
          create: {
            args: Prisma.OnboardingStepCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OnboardingStepPayload>
          }
          createMany: {
            args: Prisma.OnboardingStepCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.OnboardingStepCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OnboardingStepPayload>[]
          }
          delete: {
            args: Prisma.OnboardingStepDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OnboardingStepPayload>
          }
          update: {
            args: Prisma.OnboardingStepUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OnboardingStepPayload>
          }
          deleteMany: {
            args: Prisma.OnboardingStepDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.OnboardingStepUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.OnboardingStepUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OnboardingStepPayload>[]
          }
          upsert: {
            args: Prisma.OnboardingStepUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$OnboardingStepPayload>
          }
          aggregate: {
            args: Prisma.OnboardingStepAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateOnboardingStep>
          }
          groupBy: {
            args: Prisma.OnboardingStepGroupByArgs<ExtArgs>
            result: $Utils.Optional<OnboardingStepGroupByOutputType>[]
          }
          count: {
            args: Prisma.OnboardingStepCountArgs<ExtArgs>
            result: $Utils.Optional<OnboardingStepCountAggregateOutputType> | number
          }
        }
      }
      ActivityLog: {
        payload: Prisma.$ActivityLogPayload<ExtArgs>
        fields: Prisma.ActivityLogFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ActivityLogFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityLogPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ActivityLogFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityLogPayload>
          }
          findFirst: {
            args: Prisma.ActivityLogFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityLogPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ActivityLogFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityLogPayload>
          }
          findMany: {
            args: Prisma.ActivityLogFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityLogPayload>[]
          }
          create: {
            args: Prisma.ActivityLogCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityLogPayload>
          }
          createMany: {
            args: Prisma.ActivityLogCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ActivityLogCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityLogPayload>[]
          }
          delete: {
            args: Prisma.ActivityLogDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityLogPayload>
          }
          update: {
            args: Prisma.ActivityLogUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityLogPayload>
          }
          deleteMany: {
            args: Prisma.ActivityLogDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ActivityLogUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ActivityLogUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityLogPayload>[]
          }
          upsert: {
            args: Prisma.ActivityLogUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ActivityLogPayload>
          }
          aggregate: {
            args: Prisma.ActivityLogAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateActivityLog>
          }
          groupBy: {
            args: Prisma.ActivityLogGroupByArgs<ExtArgs>
            result: $Utils.Optional<ActivityLogGroupByOutputType>[]
          }
          count: {
            args: Prisma.ActivityLogCountArgs<ExtArgs>
            result: $Utils.Optional<ActivityLogCountAggregateOutputType> | number
          }
        }
      }
      HealthCheck: {
        payload: Prisma.$HealthCheckPayload<ExtArgs>
        fields: Prisma.HealthCheckFieldRefs
        operations: {
          findUnique: {
            args: Prisma.HealthCheckFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HealthCheckPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.HealthCheckFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HealthCheckPayload>
          }
          findFirst: {
            args: Prisma.HealthCheckFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HealthCheckPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.HealthCheckFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HealthCheckPayload>
          }
          findMany: {
            args: Prisma.HealthCheckFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HealthCheckPayload>[]
          }
          create: {
            args: Prisma.HealthCheckCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HealthCheckPayload>
          }
          createMany: {
            args: Prisma.HealthCheckCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.HealthCheckCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HealthCheckPayload>[]
          }
          delete: {
            args: Prisma.HealthCheckDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HealthCheckPayload>
          }
          update: {
            args: Prisma.HealthCheckUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HealthCheckPayload>
          }
          deleteMany: {
            args: Prisma.HealthCheckDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.HealthCheckUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.HealthCheckUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HealthCheckPayload>[]
          }
          upsert: {
            args: Prisma.HealthCheckUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$HealthCheckPayload>
          }
          aggregate: {
            args: Prisma.HealthCheckAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateHealthCheck>
          }
          groupBy: {
            args: Prisma.HealthCheckGroupByArgs<ExtArgs>
            result: $Utils.Optional<HealthCheckGroupByOutputType>[]
          }
          count: {
            args: Prisma.HealthCheckCountArgs<ExtArgs>
            result: $Utils.Optional<HealthCheckCountAggregateOutputType> | number
          }
        }
      }
      Invoice: {
        payload: Prisma.$InvoicePayload<ExtArgs>
        fields: Prisma.InvoiceFieldRefs
        operations: {
          findUnique: {
            args: Prisma.InvoiceFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.InvoiceFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>
          }
          findFirst: {
            args: Prisma.InvoiceFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.InvoiceFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>
          }
          findMany: {
            args: Prisma.InvoiceFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>[]
          }
          create: {
            args: Prisma.InvoiceCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>
          }
          createMany: {
            args: Prisma.InvoiceCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.InvoiceCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>[]
          }
          delete: {
            args: Prisma.InvoiceDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>
          }
          update: {
            args: Prisma.InvoiceUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>
          }
          deleteMany: {
            args: Prisma.InvoiceDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.InvoiceUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.InvoiceUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>[]
          }
          upsert: {
            args: Prisma.InvoiceUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$InvoicePayload>
          }
          aggregate: {
            args: Prisma.InvoiceAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateInvoice>
          }
          groupBy: {
            args: Prisma.InvoiceGroupByArgs<ExtArgs>
            result: $Utils.Optional<InvoiceGroupByOutputType>[]
          }
          count: {
            args: Prisma.InvoiceCountArgs<ExtArgs>
            result: $Utils.Optional<InvoiceCountAggregateOutputType> | number
          }
        }
      }
      PlanChange: {
        payload: Prisma.$PlanChangePayload<ExtArgs>
        fields: Prisma.PlanChangeFieldRefs
        operations: {
          findUnique: {
            args: Prisma.PlanChangeFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanChangePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.PlanChangeFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanChangePayload>
          }
          findFirst: {
            args: Prisma.PlanChangeFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanChangePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.PlanChangeFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanChangePayload>
          }
          findMany: {
            args: Prisma.PlanChangeFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanChangePayload>[]
          }
          create: {
            args: Prisma.PlanChangeCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanChangePayload>
          }
          createMany: {
            args: Prisma.PlanChangeCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.PlanChangeCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanChangePayload>[]
          }
          delete: {
            args: Prisma.PlanChangeDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanChangePayload>
          }
          update: {
            args: Prisma.PlanChangeUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanChangePayload>
          }
          deleteMany: {
            args: Prisma.PlanChangeDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.PlanChangeUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.PlanChangeUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanChangePayload>[]
          }
          upsert: {
            args: Prisma.PlanChangeUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$PlanChangePayload>
          }
          aggregate: {
            args: Prisma.PlanChangeAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePlanChange>
          }
          groupBy: {
            args: Prisma.PlanChangeGroupByArgs<ExtArgs>
            result: $Utils.Optional<PlanChangeGroupByOutputType>[]
          }
          count: {
            args: Prisma.PlanChangeCountArgs<ExtArgs>
            result: $Utils.Optional<PlanChangeCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory | null
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    providerUser?: ProviderUserOmit
    clinicAccount?: ClinicAccountOmit
    onboardingStep?: OnboardingStepOmit
    activityLog?: ActivityLogOmit
    healthCheck?: HealthCheckOmit
    invoice?: InvoiceOmit
    planChange?: PlanChangeOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type ProviderUserCountOutputType
   */

  export type ProviderUserCountOutputType = {
    activity: number
  }

  export type ProviderUserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    activity?: boolean | ProviderUserCountOutputTypeCountActivityArgs
  }

  // Custom InputTypes
  /**
   * ProviderUserCountOutputType without action
   */
  export type ProviderUserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUserCountOutputType
     */
    select?: ProviderUserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ProviderUserCountOutputType without action
   */
  export type ProviderUserCountOutputTypeCountActivityArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ActivityLogWhereInput
  }


  /**
   * Count Type ClinicAccountCountOutputType
   */

  export type ClinicAccountCountOutputType = {
    steps: number
    activity: number
    health: number
    invoices: number
    planChanges: number
  }

  export type ClinicAccountCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    steps?: boolean | ClinicAccountCountOutputTypeCountStepsArgs
    activity?: boolean | ClinicAccountCountOutputTypeCountActivityArgs
    health?: boolean | ClinicAccountCountOutputTypeCountHealthArgs
    invoices?: boolean | ClinicAccountCountOutputTypeCountInvoicesArgs
    planChanges?: boolean | ClinicAccountCountOutputTypeCountPlanChangesArgs
  }

  // Custom InputTypes
  /**
   * ClinicAccountCountOutputType without action
   */
  export type ClinicAccountCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccountCountOutputType
     */
    select?: ClinicAccountCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ClinicAccountCountOutputType without action
   */
  export type ClinicAccountCountOutputTypeCountStepsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OnboardingStepWhereInput
  }

  /**
   * ClinicAccountCountOutputType without action
   */
  export type ClinicAccountCountOutputTypeCountActivityArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ActivityLogWhereInput
  }

  /**
   * ClinicAccountCountOutputType without action
   */
  export type ClinicAccountCountOutputTypeCountHealthArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: HealthCheckWhereInput
  }

  /**
   * ClinicAccountCountOutputType without action
   */
  export type ClinicAccountCountOutputTypeCountInvoicesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: InvoiceWhereInput
  }

  /**
   * ClinicAccountCountOutputType without action
   */
  export type ClinicAccountCountOutputTypeCountPlanChangesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PlanChangeWhereInput
  }


  /**
   * Models
   */

  /**
   * Model ProviderUser
   */

  export type AggregateProviderUser = {
    _count: ProviderUserCountAggregateOutputType | null
    _min: ProviderUserMinAggregateOutputType | null
    _max: ProviderUserMaxAggregateOutputType | null
  }

  export type ProviderUserMinAggregateOutputType = {
    id: string | null
    email: string | null
    passwordHash: string | null
    name: string | null
    role: $Enums.ProviderRole | null
    isActive: boolean | null
    createdAt: Date | null
  }

  export type ProviderUserMaxAggregateOutputType = {
    id: string | null
    email: string | null
    passwordHash: string | null
    name: string | null
    role: $Enums.ProviderRole | null
    isActive: boolean | null
    createdAt: Date | null
  }

  export type ProviderUserCountAggregateOutputType = {
    id: number
    email: number
    passwordHash: number
    name: number
    role: number
    isActive: number
    createdAt: number
    _all: number
  }


  export type ProviderUserMinAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    name?: true
    role?: true
    isActive?: true
    createdAt?: true
  }

  export type ProviderUserMaxAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    name?: true
    role?: true
    isActive?: true
    createdAt?: true
  }

  export type ProviderUserCountAggregateInputType = {
    id?: true
    email?: true
    passwordHash?: true
    name?: true
    role?: true
    isActive?: true
    createdAt?: true
    _all?: true
  }

  export type ProviderUserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ProviderUser to aggregate.
     */
    where?: ProviderUserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ProviderUsers to fetch.
     */
    orderBy?: ProviderUserOrderByWithRelationInput | ProviderUserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ProviderUserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ProviderUsers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ProviderUsers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ProviderUsers
    **/
    _count?: true | ProviderUserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ProviderUserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ProviderUserMaxAggregateInputType
  }

  export type GetProviderUserAggregateType<T extends ProviderUserAggregateArgs> = {
        [P in keyof T & keyof AggregateProviderUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateProviderUser[P]>
      : GetScalarType<T[P], AggregateProviderUser[P]>
  }




  export type ProviderUserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ProviderUserWhereInput
    orderBy?: ProviderUserOrderByWithAggregationInput | ProviderUserOrderByWithAggregationInput[]
    by: ProviderUserScalarFieldEnum[] | ProviderUserScalarFieldEnum
    having?: ProviderUserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ProviderUserCountAggregateInputType | true
    _min?: ProviderUserMinAggregateInputType
    _max?: ProviderUserMaxAggregateInputType
  }

  export type ProviderUserGroupByOutputType = {
    id: string
    email: string
    passwordHash: string
    name: string
    role: $Enums.ProviderRole
    isActive: boolean
    createdAt: Date
    _count: ProviderUserCountAggregateOutputType | null
    _min: ProviderUserMinAggregateOutputType | null
    _max: ProviderUserMaxAggregateOutputType | null
  }

  type GetProviderUserGroupByPayload<T extends ProviderUserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ProviderUserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ProviderUserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ProviderUserGroupByOutputType[P]>
            : GetScalarType<T[P], ProviderUserGroupByOutputType[P]>
        }
      >
    >


  export type ProviderUserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    role?: boolean
    isActive?: boolean
    createdAt?: boolean
    activity?: boolean | ProviderUser$activityArgs<ExtArgs>
    _count?: boolean | ProviderUserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["providerUser"]>

  export type ProviderUserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    role?: boolean
    isActive?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["providerUser"]>

  export type ProviderUserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    role?: boolean
    isActive?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["providerUser"]>

  export type ProviderUserSelectScalar = {
    id?: boolean
    email?: boolean
    passwordHash?: boolean
    name?: boolean
    role?: boolean
    isActive?: boolean
    createdAt?: boolean
  }

  export type ProviderUserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "email" | "passwordHash" | "name" | "role" | "isActive" | "createdAt", ExtArgs["result"]["providerUser"]>
  export type ProviderUserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    activity?: boolean | ProviderUser$activityArgs<ExtArgs>
    _count?: boolean | ProviderUserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type ProviderUserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type ProviderUserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $ProviderUserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ProviderUser"
    objects: {
      activity: Prisma.$ActivityLogPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      email: string
      passwordHash: string
      name: string
      role: $Enums.ProviderRole
      isActive: boolean
      createdAt: Date
    }, ExtArgs["result"]["providerUser"]>
    composites: {}
  }

  type ProviderUserGetPayload<S extends boolean | null | undefined | ProviderUserDefaultArgs> = $Result.GetResult<Prisma.$ProviderUserPayload, S>

  type ProviderUserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ProviderUserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ProviderUserCountAggregateInputType | true
    }

  export interface ProviderUserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ProviderUser'], meta: { name: 'ProviderUser' } }
    /**
     * Find zero or one ProviderUser that matches the filter.
     * @param {ProviderUserFindUniqueArgs} args - Arguments to find a ProviderUser
     * @example
     * // Get one ProviderUser
     * const providerUser = await prisma.providerUser.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ProviderUserFindUniqueArgs>(args: SelectSubset<T, ProviderUserFindUniqueArgs<ExtArgs>>): Prisma__ProviderUserClient<$Result.GetResult<Prisma.$ProviderUserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ProviderUser that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ProviderUserFindUniqueOrThrowArgs} args - Arguments to find a ProviderUser
     * @example
     * // Get one ProviderUser
     * const providerUser = await prisma.providerUser.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ProviderUserFindUniqueOrThrowArgs>(args: SelectSubset<T, ProviderUserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ProviderUserClient<$Result.GetResult<Prisma.$ProviderUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ProviderUser that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProviderUserFindFirstArgs} args - Arguments to find a ProviderUser
     * @example
     * // Get one ProviderUser
     * const providerUser = await prisma.providerUser.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ProviderUserFindFirstArgs>(args?: SelectSubset<T, ProviderUserFindFirstArgs<ExtArgs>>): Prisma__ProviderUserClient<$Result.GetResult<Prisma.$ProviderUserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ProviderUser that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProviderUserFindFirstOrThrowArgs} args - Arguments to find a ProviderUser
     * @example
     * // Get one ProviderUser
     * const providerUser = await prisma.providerUser.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ProviderUserFindFirstOrThrowArgs>(args?: SelectSubset<T, ProviderUserFindFirstOrThrowArgs<ExtArgs>>): Prisma__ProviderUserClient<$Result.GetResult<Prisma.$ProviderUserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ProviderUsers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProviderUserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ProviderUsers
     * const providerUsers = await prisma.providerUser.findMany()
     * 
     * // Get first 10 ProviderUsers
     * const providerUsers = await prisma.providerUser.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const providerUserWithIdOnly = await prisma.providerUser.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ProviderUserFindManyArgs>(args?: SelectSubset<T, ProviderUserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProviderUserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ProviderUser.
     * @param {ProviderUserCreateArgs} args - Arguments to create a ProviderUser.
     * @example
     * // Create one ProviderUser
     * const ProviderUser = await prisma.providerUser.create({
     *   data: {
     *     // ... data to create a ProviderUser
     *   }
     * })
     * 
     */
    create<T extends ProviderUserCreateArgs>(args: SelectSubset<T, ProviderUserCreateArgs<ExtArgs>>): Prisma__ProviderUserClient<$Result.GetResult<Prisma.$ProviderUserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ProviderUsers.
     * @param {ProviderUserCreateManyArgs} args - Arguments to create many ProviderUsers.
     * @example
     * // Create many ProviderUsers
     * const providerUser = await prisma.providerUser.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ProviderUserCreateManyArgs>(args?: SelectSubset<T, ProviderUserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ProviderUsers and returns the data saved in the database.
     * @param {ProviderUserCreateManyAndReturnArgs} args - Arguments to create many ProviderUsers.
     * @example
     * // Create many ProviderUsers
     * const providerUser = await prisma.providerUser.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ProviderUsers and only return the `id`
     * const providerUserWithIdOnly = await prisma.providerUser.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ProviderUserCreateManyAndReturnArgs>(args?: SelectSubset<T, ProviderUserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProviderUserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ProviderUser.
     * @param {ProviderUserDeleteArgs} args - Arguments to delete one ProviderUser.
     * @example
     * // Delete one ProviderUser
     * const ProviderUser = await prisma.providerUser.delete({
     *   where: {
     *     // ... filter to delete one ProviderUser
     *   }
     * })
     * 
     */
    delete<T extends ProviderUserDeleteArgs>(args: SelectSubset<T, ProviderUserDeleteArgs<ExtArgs>>): Prisma__ProviderUserClient<$Result.GetResult<Prisma.$ProviderUserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ProviderUser.
     * @param {ProviderUserUpdateArgs} args - Arguments to update one ProviderUser.
     * @example
     * // Update one ProviderUser
     * const providerUser = await prisma.providerUser.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ProviderUserUpdateArgs>(args: SelectSubset<T, ProviderUserUpdateArgs<ExtArgs>>): Prisma__ProviderUserClient<$Result.GetResult<Prisma.$ProviderUserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ProviderUsers.
     * @param {ProviderUserDeleteManyArgs} args - Arguments to filter ProviderUsers to delete.
     * @example
     * // Delete a few ProviderUsers
     * const { count } = await prisma.providerUser.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ProviderUserDeleteManyArgs>(args?: SelectSubset<T, ProviderUserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ProviderUsers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProviderUserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ProviderUsers
     * const providerUser = await prisma.providerUser.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ProviderUserUpdateManyArgs>(args: SelectSubset<T, ProviderUserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ProviderUsers and returns the data updated in the database.
     * @param {ProviderUserUpdateManyAndReturnArgs} args - Arguments to update many ProviderUsers.
     * @example
     * // Update many ProviderUsers
     * const providerUser = await prisma.providerUser.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ProviderUsers and only return the `id`
     * const providerUserWithIdOnly = await prisma.providerUser.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ProviderUserUpdateManyAndReturnArgs>(args: SelectSubset<T, ProviderUserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ProviderUserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ProviderUser.
     * @param {ProviderUserUpsertArgs} args - Arguments to update or create a ProviderUser.
     * @example
     * // Update or create a ProviderUser
     * const providerUser = await prisma.providerUser.upsert({
     *   create: {
     *     // ... data to create a ProviderUser
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ProviderUser we want to update
     *   }
     * })
     */
    upsert<T extends ProviderUserUpsertArgs>(args: SelectSubset<T, ProviderUserUpsertArgs<ExtArgs>>): Prisma__ProviderUserClient<$Result.GetResult<Prisma.$ProviderUserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ProviderUsers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProviderUserCountArgs} args - Arguments to filter ProviderUsers to count.
     * @example
     * // Count the number of ProviderUsers
     * const count = await prisma.providerUser.count({
     *   where: {
     *     // ... the filter for the ProviderUsers we want to count
     *   }
     * })
    **/
    count<T extends ProviderUserCountArgs>(
      args?: Subset<T, ProviderUserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ProviderUserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ProviderUser.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProviderUserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ProviderUserAggregateArgs>(args: Subset<T, ProviderUserAggregateArgs>): Prisma.PrismaPromise<GetProviderUserAggregateType<T>>

    /**
     * Group by ProviderUser.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ProviderUserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ProviderUserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ProviderUserGroupByArgs['orderBy'] }
        : { orderBy?: ProviderUserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ProviderUserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetProviderUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ProviderUser model
   */
  readonly fields: ProviderUserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ProviderUser.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ProviderUserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    activity<T extends ProviderUser$activityArgs<ExtArgs> = {}>(args?: Subset<T, ProviderUser$activityArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ActivityLogPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ProviderUser model
   */
  interface ProviderUserFieldRefs {
    readonly id: FieldRef<"ProviderUser", 'String'>
    readonly email: FieldRef<"ProviderUser", 'String'>
    readonly passwordHash: FieldRef<"ProviderUser", 'String'>
    readonly name: FieldRef<"ProviderUser", 'String'>
    readonly role: FieldRef<"ProviderUser", 'ProviderRole'>
    readonly isActive: FieldRef<"ProviderUser", 'Boolean'>
    readonly createdAt: FieldRef<"ProviderUser", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ProviderUser findUnique
   */
  export type ProviderUserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUser
     */
    select?: ProviderUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProviderUser
     */
    omit?: ProviderUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProviderUserInclude<ExtArgs> | null
    /**
     * Filter, which ProviderUser to fetch.
     */
    where: ProviderUserWhereUniqueInput
  }

  /**
   * ProviderUser findUniqueOrThrow
   */
  export type ProviderUserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUser
     */
    select?: ProviderUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProviderUser
     */
    omit?: ProviderUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProviderUserInclude<ExtArgs> | null
    /**
     * Filter, which ProviderUser to fetch.
     */
    where: ProviderUserWhereUniqueInput
  }

  /**
   * ProviderUser findFirst
   */
  export type ProviderUserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUser
     */
    select?: ProviderUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProviderUser
     */
    omit?: ProviderUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProviderUserInclude<ExtArgs> | null
    /**
     * Filter, which ProviderUser to fetch.
     */
    where?: ProviderUserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ProviderUsers to fetch.
     */
    orderBy?: ProviderUserOrderByWithRelationInput | ProviderUserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ProviderUsers.
     */
    cursor?: ProviderUserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ProviderUsers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ProviderUsers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ProviderUsers.
     */
    distinct?: ProviderUserScalarFieldEnum | ProviderUserScalarFieldEnum[]
  }

  /**
   * ProviderUser findFirstOrThrow
   */
  export type ProviderUserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUser
     */
    select?: ProviderUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProviderUser
     */
    omit?: ProviderUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProviderUserInclude<ExtArgs> | null
    /**
     * Filter, which ProviderUser to fetch.
     */
    where?: ProviderUserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ProviderUsers to fetch.
     */
    orderBy?: ProviderUserOrderByWithRelationInput | ProviderUserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ProviderUsers.
     */
    cursor?: ProviderUserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ProviderUsers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ProviderUsers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ProviderUsers.
     */
    distinct?: ProviderUserScalarFieldEnum | ProviderUserScalarFieldEnum[]
  }

  /**
   * ProviderUser findMany
   */
  export type ProviderUserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUser
     */
    select?: ProviderUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProviderUser
     */
    omit?: ProviderUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProviderUserInclude<ExtArgs> | null
    /**
     * Filter, which ProviderUsers to fetch.
     */
    where?: ProviderUserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ProviderUsers to fetch.
     */
    orderBy?: ProviderUserOrderByWithRelationInput | ProviderUserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ProviderUsers.
     */
    cursor?: ProviderUserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ProviderUsers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ProviderUsers.
     */
    skip?: number
    distinct?: ProviderUserScalarFieldEnum | ProviderUserScalarFieldEnum[]
  }

  /**
   * ProviderUser create
   */
  export type ProviderUserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUser
     */
    select?: ProviderUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProviderUser
     */
    omit?: ProviderUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProviderUserInclude<ExtArgs> | null
    /**
     * The data needed to create a ProviderUser.
     */
    data: XOR<ProviderUserCreateInput, ProviderUserUncheckedCreateInput>
  }

  /**
   * ProviderUser createMany
   */
  export type ProviderUserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ProviderUsers.
     */
    data: ProviderUserCreateManyInput | ProviderUserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ProviderUser createManyAndReturn
   */
  export type ProviderUserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUser
     */
    select?: ProviderUserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ProviderUser
     */
    omit?: ProviderUserOmit<ExtArgs> | null
    /**
     * The data used to create many ProviderUsers.
     */
    data: ProviderUserCreateManyInput | ProviderUserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ProviderUser update
   */
  export type ProviderUserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUser
     */
    select?: ProviderUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProviderUser
     */
    omit?: ProviderUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProviderUserInclude<ExtArgs> | null
    /**
     * The data needed to update a ProviderUser.
     */
    data: XOR<ProviderUserUpdateInput, ProviderUserUncheckedUpdateInput>
    /**
     * Choose, which ProviderUser to update.
     */
    where: ProviderUserWhereUniqueInput
  }

  /**
   * ProviderUser updateMany
   */
  export type ProviderUserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ProviderUsers.
     */
    data: XOR<ProviderUserUpdateManyMutationInput, ProviderUserUncheckedUpdateManyInput>
    /**
     * Filter which ProviderUsers to update
     */
    where?: ProviderUserWhereInput
    /**
     * Limit how many ProviderUsers to update.
     */
    limit?: number
  }

  /**
   * ProviderUser updateManyAndReturn
   */
  export type ProviderUserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUser
     */
    select?: ProviderUserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ProviderUser
     */
    omit?: ProviderUserOmit<ExtArgs> | null
    /**
     * The data used to update ProviderUsers.
     */
    data: XOR<ProviderUserUpdateManyMutationInput, ProviderUserUncheckedUpdateManyInput>
    /**
     * Filter which ProviderUsers to update
     */
    where?: ProviderUserWhereInput
    /**
     * Limit how many ProviderUsers to update.
     */
    limit?: number
  }

  /**
   * ProviderUser upsert
   */
  export type ProviderUserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUser
     */
    select?: ProviderUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProviderUser
     */
    omit?: ProviderUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProviderUserInclude<ExtArgs> | null
    /**
     * The filter to search for the ProviderUser to update in case it exists.
     */
    where: ProviderUserWhereUniqueInput
    /**
     * In case the ProviderUser found by the `where` argument doesn't exist, create a new ProviderUser with this data.
     */
    create: XOR<ProviderUserCreateInput, ProviderUserUncheckedCreateInput>
    /**
     * In case the ProviderUser was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ProviderUserUpdateInput, ProviderUserUncheckedUpdateInput>
  }

  /**
   * ProviderUser delete
   */
  export type ProviderUserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUser
     */
    select?: ProviderUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProviderUser
     */
    omit?: ProviderUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProviderUserInclude<ExtArgs> | null
    /**
     * Filter which ProviderUser to delete.
     */
    where: ProviderUserWhereUniqueInput
  }

  /**
   * ProviderUser deleteMany
   */
  export type ProviderUserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ProviderUsers to delete
     */
    where?: ProviderUserWhereInput
    /**
     * Limit how many ProviderUsers to delete.
     */
    limit?: number
  }

  /**
   * ProviderUser.activity
   */
  export type ProviderUser$activityArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogInclude<ExtArgs> | null
    where?: ActivityLogWhereInput
    orderBy?: ActivityLogOrderByWithRelationInput | ActivityLogOrderByWithRelationInput[]
    cursor?: ActivityLogWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ActivityLogScalarFieldEnum | ActivityLogScalarFieldEnum[]
  }

  /**
   * ProviderUser without action
   */
  export type ProviderUserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUser
     */
    select?: ProviderUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProviderUser
     */
    omit?: ProviderUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProviderUserInclude<ExtArgs> | null
  }


  /**
   * Model ClinicAccount
   */

  export type AggregateClinicAccount = {
    _count: ClinicAccountCountAggregateOutputType | null
    _avg: ClinicAccountAvgAggregateOutputType | null
    _sum: ClinicAccountSumAggregateOutputType | null
    _min: ClinicAccountMinAggregateOutputType | null
    _max: ClinicAccountMaxAggregateOutputType | null
  }

  export type ClinicAccountAvgAggregateOutputType = {
    monthlyFee: Decimal | null
    setupFee: Decimal | null
    yearlyFee: Decimal | null
    licenceFee: Decimal | null
    amcPercent: Decimal | null
    hostingFee: Decimal | null
    maxUsersOverride: number | null
  }

  export type ClinicAccountSumAggregateOutputType = {
    monthlyFee: Decimal | null
    setupFee: Decimal | null
    yearlyFee: Decimal | null
    licenceFee: Decimal | null
    amcPercent: Decimal | null
    hostingFee: Decimal | null
    maxUsersOverride: number | null
  }

  export type ClinicAccountMinAggregateOutputType = {
    id: string | null
    slug: string | null
    name: string | null
    contactName: string | null
    contactEmail: string | null
    contactPhone: string | null
    city: string | null
    notes: string | null
    status: $Enums.AccountStatus | null
    plan: $Enums.PlanTier | null
    monthlyFee: Decimal | null
    currency: string | null
    billingCycle: $Enums.BillingCycle | null
    startedAt: Date | null
    renewsAt: Date | null
    pricingModel: $Enums.PricingModel | null
    setupFee: Decimal | null
    yearlyFee: Decimal | null
    licenceFee: Decimal | null
    amcPercent: Decimal | null
    hostingFee: Decimal | null
    maxUsersOverride: number | null
    billingName: string | null
    billingAddress: string | null
    gstin: string | null
    billingState: string | null
    appliedPlan: $Enums.PlanTier | null
    appliedFeatures: string | null
    appliedReadOnly: boolean | null
    appliedAt: Date | null
    planJobId: string | null
    isDemo: boolean | null
    publicDomain: string | null
    portalDomain: string | null
    apiDomain: string | null
    neonProjectId: string | null
    vercelWebProjectId: string | null
    vercelApiProjectId: string | null
    provisionedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ClinicAccountMaxAggregateOutputType = {
    id: string | null
    slug: string | null
    name: string | null
    contactName: string | null
    contactEmail: string | null
    contactPhone: string | null
    city: string | null
    notes: string | null
    status: $Enums.AccountStatus | null
    plan: $Enums.PlanTier | null
    monthlyFee: Decimal | null
    currency: string | null
    billingCycle: $Enums.BillingCycle | null
    startedAt: Date | null
    renewsAt: Date | null
    pricingModel: $Enums.PricingModel | null
    setupFee: Decimal | null
    yearlyFee: Decimal | null
    licenceFee: Decimal | null
    amcPercent: Decimal | null
    hostingFee: Decimal | null
    maxUsersOverride: number | null
    billingName: string | null
    billingAddress: string | null
    gstin: string | null
    billingState: string | null
    appliedPlan: $Enums.PlanTier | null
    appliedFeatures: string | null
    appliedReadOnly: boolean | null
    appliedAt: Date | null
    planJobId: string | null
    isDemo: boolean | null
    publicDomain: string | null
    portalDomain: string | null
    apiDomain: string | null
    neonProjectId: string | null
    vercelWebProjectId: string | null
    vercelApiProjectId: string | null
    provisionedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ClinicAccountCountAggregateOutputType = {
    id: number
    slug: number
    name: number
    contactName: number
    contactEmail: number
    contactPhone: number
    city: number
    notes: number
    status: number
    plan: number
    featureOverrides: number
    monthlyFee: number
    currency: number
    billingCycle: number
    startedAt: number
    renewsAt: number
    pricingModel: number
    setupFee: number
    yearlyFee: number
    licenceFee: number
    amcPercent: number
    hostingFee: number
    maxUsersOverride: number
    billingName: number
    billingAddress: number
    gstin: number
    billingState: number
    appliedPlan: number
    appliedFeatures: number
    appliedReadOnly: number
    appliedAt: number
    planJobId: number
    isDemo: number
    publicDomain: number
    portalDomain: number
    apiDomain: number
    neonProjectId: number
    vercelWebProjectId: number
    vercelApiProjectId: number
    provisionedAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ClinicAccountAvgAggregateInputType = {
    monthlyFee?: true
    setupFee?: true
    yearlyFee?: true
    licenceFee?: true
    amcPercent?: true
    hostingFee?: true
    maxUsersOverride?: true
  }

  export type ClinicAccountSumAggregateInputType = {
    monthlyFee?: true
    setupFee?: true
    yearlyFee?: true
    licenceFee?: true
    amcPercent?: true
    hostingFee?: true
    maxUsersOverride?: true
  }

  export type ClinicAccountMinAggregateInputType = {
    id?: true
    slug?: true
    name?: true
    contactName?: true
    contactEmail?: true
    contactPhone?: true
    city?: true
    notes?: true
    status?: true
    plan?: true
    monthlyFee?: true
    currency?: true
    billingCycle?: true
    startedAt?: true
    renewsAt?: true
    pricingModel?: true
    setupFee?: true
    yearlyFee?: true
    licenceFee?: true
    amcPercent?: true
    hostingFee?: true
    maxUsersOverride?: true
    billingName?: true
    billingAddress?: true
    gstin?: true
    billingState?: true
    appliedPlan?: true
    appliedFeatures?: true
    appliedReadOnly?: true
    appliedAt?: true
    planJobId?: true
    isDemo?: true
    publicDomain?: true
    portalDomain?: true
    apiDomain?: true
    neonProjectId?: true
    vercelWebProjectId?: true
    vercelApiProjectId?: true
    provisionedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ClinicAccountMaxAggregateInputType = {
    id?: true
    slug?: true
    name?: true
    contactName?: true
    contactEmail?: true
    contactPhone?: true
    city?: true
    notes?: true
    status?: true
    plan?: true
    monthlyFee?: true
    currency?: true
    billingCycle?: true
    startedAt?: true
    renewsAt?: true
    pricingModel?: true
    setupFee?: true
    yearlyFee?: true
    licenceFee?: true
    amcPercent?: true
    hostingFee?: true
    maxUsersOverride?: true
    billingName?: true
    billingAddress?: true
    gstin?: true
    billingState?: true
    appliedPlan?: true
    appliedFeatures?: true
    appliedReadOnly?: true
    appliedAt?: true
    planJobId?: true
    isDemo?: true
    publicDomain?: true
    portalDomain?: true
    apiDomain?: true
    neonProjectId?: true
    vercelWebProjectId?: true
    vercelApiProjectId?: true
    provisionedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ClinicAccountCountAggregateInputType = {
    id?: true
    slug?: true
    name?: true
    contactName?: true
    contactEmail?: true
    contactPhone?: true
    city?: true
    notes?: true
    status?: true
    plan?: true
    featureOverrides?: true
    monthlyFee?: true
    currency?: true
    billingCycle?: true
    startedAt?: true
    renewsAt?: true
    pricingModel?: true
    setupFee?: true
    yearlyFee?: true
    licenceFee?: true
    amcPercent?: true
    hostingFee?: true
    maxUsersOverride?: true
    billingName?: true
    billingAddress?: true
    gstin?: true
    billingState?: true
    appliedPlan?: true
    appliedFeatures?: true
    appliedReadOnly?: true
    appliedAt?: true
    planJobId?: true
    isDemo?: true
    publicDomain?: true
    portalDomain?: true
    apiDomain?: true
    neonProjectId?: true
    vercelWebProjectId?: true
    vercelApiProjectId?: true
    provisionedAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ClinicAccountAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClinicAccount to aggregate.
     */
    where?: ClinicAccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClinicAccounts to fetch.
     */
    orderBy?: ClinicAccountOrderByWithRelationInput | ClinicAccountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ClinicAccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClinicAccounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClinicAccounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ClinicAccounts
    **/
    _count?: true | ClinicAccountCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ClinicAccountAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ClinicAccountSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ClinicAccountMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ClinicAccountMaxAggregateInputType
  }

  export type GetClinicAccountAggregateType<T extends ClinicAccountAggregateArgs> = {
        [P in keyof T & keyof AggregateClinicAccount]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateClinicAccount[P]>
      : GetScalarType<T[P], AggregateClinicAccount[P]>
  }




  export type ClinicAccountGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ClinicAccountWhereInput
    orderBy?: ClinicAccountOrderByWithAggregationInput | ClinicAccountOrderByWithAggregationInput[]
    by: ClinicAccountScalarFieldEnum[] | ClinicAccountScalarFieldEnum
    having?: ClinicAccountScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ClinicAccountCountAggregateInputType | true
    _avg?: ClinicAccountAvgAggregateInputType
    _sum?: ClinicAccountSumAggregateInputType
    _min?: ClinicAccountMinAggregateInputType
    _max?: ClinicAccountMaxAggregateInputType
  }

  export type ClinicAccountGroupByOutputType = {
    id: string
    slug: string
    name: string
    contactName: string | null
    contactEmail: string | null
    contactPhone: string | null
    city: string | null
    notes: string | null
    status: $Enums.AccountStatus
    plan: $Enums.PlanTier
    featureOverrides: JsonValue | null
    monthlyFee: Decimal | null
    currency: string
    billingCycle: $Enums.BillingCycle
    startedAt: Date | null
    renewsAt: Date | null
    pricingModel: $Enums.PricingModel
    setupFee: Decimal | null
    yearlyFee: Decimal | null
    licenceFee: Decimal | null
    amcPercent: Decimal | null
    hostingFee: Decimal | null
    maxUsersOverride: number | null
    billingName: string | null
    billingAddress: string | null
    gstin: string | null
    billingState: string | null
    appliedPlan: $Enums.PlanTier | null
    appliedFeatures: string | null
    appliedReadOnly: boolean | null
    appliedAt: Date | null
    planJobId: string | null
    isDemo: boolean
    publicDomain: string | null
    portalDomain: string | null
    apiDomain: string | null
    neonProjectId: string | null
    vercelWebProjectId: string | null
    vercelApiProjectId: string | null
    provisionedAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: ClinicAccountCountAggregateOutputType | null
    _avg: ClinicAccountAvgAggregateOutputType | null
    _sum: ClinicAccountSumAggregateOutputType | null
    _min: ClinicAccountMinAggregateOutputType | null
    _max: ClinicAccountMaxAggregateOutputType | null
  }

  type GetClinicAccountGroupByPayload<T extends ClinicAccountGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ClinicAccountGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ClinicAccountGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ClinicAccountGroupByOutputType[P]>
            : GetScalarType<T[P], ClinicAccountGroupByOutputType[P]>
        }
      >
    >


  export type ClinicAccountSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    slug?: boolean
    name?: boolean
    contactName?: boolean
    contactEmail?: boolean
    contactPhone?: boolean
    city?: boolean
    notes?: boolean
    status?: boolean
    plan?: boolean
    featureOverrides?: boolean
    monthlyFee?: boolean
    currency?: boolean
    billingCycle?: boolean
    startedAt?: boolean
    renewsAt?: boolean
    pricingModel?: boolean
    setupFee?: boolean
    yearlyFee?: boolean
    licenceFee?: boolean
    amcPercent?: boolean
    hostingFee?: boolean
    maxUsersOverride?: boolean
    billingName?: boolean
    billingAddress?: boolean
    gstin?: boolean
    billingState?: boolean
    appliedPlan?: boolean
    appliedFeatures?: boolean
    appliedReadOnly?: boolean
    appliedAt?: boolean
    planJobId?: boolean
    isDemo?: boolean
    publicDomain?: boolean
    portalDomain?: boolean
    apiDomain?: boolean
    neonProjectId?: boolean
    vercelWebProjectId?: boolean
    vercelApiProjectId?: boolean
    provisionedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    steps?: boolean | ClinicAccount$stepsArgs<ExtArgs>
    activity?: boolean | ClinicAccount$activityArgs<ExtArgs>
    health?: boolean | ClinicAccount$healthArgs<ExtArgs>
    invoices?: boolean | ClinicAccount$invoicesArgs<ExtArgs>
    planChanges?: boolean | ClinicAccount$planChangesArgs<ExtArgs>
    _count?: boolean | ClinicAccountCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["clinicAccount"]>

  export type ClinicAccountSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    slug?: boolean
    name?: boolean
    contactName?: boolean
    contactEmail?: boolean
    contactPhone?: boolean
    city?: boolean
    notes?: boolean
    status?: boolean
    plan?: boolean
    featureOverrides?: boolean
    monthlyFee?: boolean
    currency?: boolean
    billingCycle?: boolean
    startedAt?: boolean
    renewsAt?: boolean
    pricingModel?: boolean
    setupFee?: boolean
    yearlyFee?: boolean
    licenceFee?: boolean
    amcPercent?: boolean
    hostingFee?: boolean
    maxUsersOverride?: boolean
    billingName?: boolean
    billingAddress?: boolean
    gstin?: boolean
    billingState?: boolean
    appliedPlan?: boolean
    appliedFeatures?: boolean
    appliedReadOnly?: boolean
    appliedAt?: boolean
    planJobId?: boolean
    isDemo?: boolean
    publicDomain?: boolean
    portalDomain?: boolean
    apiDomain?: boolean
    neonProjectId?: boolean
    vercelWebProjectId?: boolean
    vercelApiProjectId?: boolean
    provisionedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["clinicAccount"]>

  export type ClinicAccountSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    slug?: boolean
    name?: boolean
    contactName?: boolean
    contactEmail?: boolean
    contactPhone?: boolean
    city?: boolean
    notes?: boolean
    status?: boolean
    plan?: boolean
    featureOverrides?: boolean
    monthlyFee?: boolean
    currency?: boolean
    billingCycle?: boolean
    startedAt?: boolean
    renewsAt?: boolean
    pricingModel?: boolean
    setupFee?: boolean
    yearlyFee?: boolean
    licenceFee?: boolean
    amcPercent?: boolean
    hostingFee?: boolean
    maxUsersOverride?: boolean
    billingName?: boolean
    billingAddress?: boolean
    gstin?: boolean
    billingState?: boolean
    appliedPlan?: boolean
    appliedFeatures?: boolean
    appliedReadOnly?: boolean
    appliedAt?: boolean
    planJobId?: boolean
    isDemo?: boolean
    publicDomain?: boolean
    portalDomain?: boolean
    apiDomain?: boolean
    neonProjectId?: boolean
    vercelWebProjectId?: boolean
    vercelApiProjectId?: boolean
    provisionedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["clinicAccount"]>

  export type ClinicAccountSelectScalar = {
    id?: boolean
    slug?: boolean
    name?: boolean
    contactName?: boolean
    contactEmail?: boolean
    contactPhone?: boolean
    city?: boolean
    notes?: boolean
    status?: boolean
    plan?: boolean
    featureOverrides?: boolean
    monthlyFee?: boolean
    currency?: boolean
    billingCycle?: boolean
    startedAt?: boolean
    renewsAt?: boolean
    pricingModel?: boolean
    setupFee?: boolean
    yearlyFee?: boolean
    licenceFee?: boolean
    amcPercent?: boolean
    hostingFee?: boolean
    maxUsersOverride?: boolean
    billingName?: boolean
    billingAddress?: boolean
    gstin?: boolean
    billingState?: boolean
    appliedPlan?: boolean
    appliedFeatures?: boolean
    appliedReadOnly?: boolean
    appliedAt?: boolean
    planJobId?: boolean
    isDemo?: boolean
    publicDomain?: boolean
    portalDomain?: boolean
    apiDomain?: boolean
    neonProjectId?: boolean
    vercelWebProjectId?: boolean
    vercelApiProjectId?: boolean
    provisionedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ClinicAccountOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "slug" | "name" | "contactName" | "contactEmail" | "contactPhone" | "city" | "notes" | "status" | "plan" | "featureOverrides" | "monthlyFee" | "currency" | "billingCycle" | "startedAt" | "renewsAt" | "pricingModel" | "setupFee" | "yearlyFee" | "licenceFee" | "amcPercent" | "hostingFee" | "maxUsersOverride" | "billingName" | "billingAddress" | "gstin" | "billingState" | "appliedPlan" | "appliedFeatures" | "appliedReadOnly" | "appliedAt" | "planJobId" | "isDemo" | "publicDomain" | "portalDomain" | "apiDomain" | "neonProjectId" | "vercelWebProjectId" | "vercelApiProjectId" | "provisionedAt" | "createdAt" | "updatedAt", ExtArgs["result"]["clinicAccount"]>
  export type ClinicAccountInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    steps?: boolean | ClinicAccount$stepsArgs<ExtArgs>
    activity?: boolean | ClinicAccount$activityArgs<ExtArgs>
    health?: boolean | ClinicAccount$healthArgs<ExtArgs>
    invoices?: boolean | ClinicAccount$invoicesArgs<ExtArgs>
    planChanges?: boolean | ClinicAccount$planChangesArgs<ExtArgs>
    _count?: boolean | ClinicAccountCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type ClinicAccountIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type ClinicAccountIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $ClinicAccountPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ClinicAccount"
    objects: {
      steps: Prisma.$OnboardingStepPayload<ExtArgs>[]
      activity: Prisma.$ActivityLogPayload<ExtArgs>[]
      health: Prisma.$HealthCheckPayload<ExtArgs>[]
      invoices: Prisma.$InvoicePayload<ExtArgs>[]
      planChanges: Prisma.$PlanChangePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      /**
       * URL-safe identifier used for generated subdomains and project names.
       */
      slug: string
      name: string
      contactName: string | null
      contactEmail: string | null
      contactPhone: string | null
      city: string | null
      notes: string | null
      status: $Enums.AccountStatus
      plan: $Enums.PlanTier
      /**
       * Features granted beyond the plan, for a deal that includes something
       * off-tier. Merged over the plan's defaults when the .env is generated,
       * so a one-off promise made in a sales call survives as configuration
       * rather than as a note nobody reads.
       */
      featureOverrides: Prisma.JsonValue | null
      monthlyFee: Prisma.Decimal | null
      currency: string
      billingCycle: $Enums.BillingCycle
      startedAt: Date | null
      renewsAt: Date | null
      pricingModel: $Enums.PricingModel
      setupFee: Prisma.Decimal | null
      yearlyFee: Prisma.Decimal | null
      licenceFee: Prisma.Decimal | null
      amcPercent: Prisma.Decimal | null
      hostingFee: Prisma.Decimal | null
      /**
       * Extra or fewer logins than the plan, agreed in the deal. 0 = unlimited.
       */
      maxUsersOverride: number | null
      billingName: string | null
      billingAddress: string | null
      /**
       * The clinic's GSTIN, if registered. Decides the place of supply.
       */
      gstin: string | null
      /**
       * Two-digit GST state code. From the GSTIN when there is one.
       */
      billingState: string | null
      appliedPlan: $Enums.PlanTier | null
      appliedFeatures: string | null
      appliedReadOnly: boolean | null
      appliedAt: Date | null
      planJobId: string | null
      /**
       * A demonstration deployment: made-up patients, reset nightly.
       */
      isDemo: boolean
      publicDomain: string | null
      portalDomain: string | null
      apiDomain: string | null
      /**
       * Neon project reference. NOT a credential — the connection string is
       * fetched from Neon at the moment it is needed and never written here.
       */
      neonProjectId: string | null
      /**
       * Vercel project ids, so a redeploy can find them again.
       */
      vercelWebProjectId: string | null
      vercelApiProjectId: string | null
      /**
       * True once the provisioning run has completed end to end.
       */
      provisionedAt: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["clinicAccount"]>
    composites: {}
  }

  type ClinicAccountGetPayload<S extends boolean | null | undefined | ClinicAccountDefaultArgs> = $Result.GetResult<Prisma.$ClinicAccountPayload, S>

  type ClinicAccountCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ClinicAccountFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ClinicAccountCountAggregateInputType | true
    }

  export interface ClinicAccountDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ClinicAccount'], meta: { name: 'ClinicAccount' } }
    /**
     * Find zero or one ClinicAccount that matches the filter.
     * @param {ClinicAccountFindUniqueArgs} args - Arguments to find a ClinicAccount
     * @example
     * // Get one ClinicAccount
     * const clinicAccount = await prisma.clinicAccount.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ClinicAccountFindUniqueArgs>(args: SelectSubset<T, ClinicAccountFindUniqueArgs<ExtArgs>>): Prisma__ClinicAccountClient<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ClinicAccount that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ClinicAccountFindUniqueOrThrowArgs} args - Arguments to find a ClinicAccount
     * @example
     * // Get one ClinicAccount
     * const clinicAccount = await prisma.clinicAccount.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ClinicAccountFindUniqueOrThrowArgs>(args: SelectSubset<T, ClinicAccountFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ClinicAccountClient<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ClinicAccount that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClinicAccountFindFirstArgs} args - Arguments to find a ClinicAccount
     * @example
     * // Get one ClinicAccount
     * const clinicAccount = await prisma.clinicAccount.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ClinicAccountFindFirstArgs>(args?: SelectSubset<T, ClinicAccountFindFirstArgs<ExtArgs>>): Prisma__ClinicAccountClient<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ClinicAccount that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClinicAccountFindFirstOrThrowArgs} args - Arguments to find a ClinicAccount
     * @example
     * // Get one ClinicAccount
     * const clinicAccount = await prisma.clinicAccount.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ClinicAccountFindFirstOrThrowArgs>(args?: SelectSubset<T, ClinicAccountFindFirstOrThrowArgs<ExtArgs>>): Prisma__ClinicAccountClient<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ClinicAccounts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClinicAccountFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ClinicAccounts
     * const clinicAccounts = await prisma.clinicAccount.findMany()
     * 
     * // Get first 10 ClinicAccounts
     * const clinicAccounts = await prisma.clinicAccount.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const clinicAccountWithIdOnly = await prisma.clinicAccount.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ClinicAccountFindManyArgs>(args?: SelectSubset<T, ClinicAccountFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ClinicAccount.
     * @param {ClinicAccountCreateArgs} args - Arguments to create a ClinicAccount.
     * @example
     * // Create one ClinicAccount
     * const ClinicAccount = await prisma.clinicAccount.create({
     *   data: {
     *     // ... data to create a ClinicAccount
     *   }
     * })
     * 
     */
    create<T extends ClinicAccountCreateArgs>(args: SelectSubset<T, ClinicAccountCreateArgs<ExtArgs>>): Prisma__ClinicAccountClient<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ClinicAccounts.
     * @param {ClinicAccountCreateManyArgs} args - Arguments to create many ClinicAccounts.
     * @example
     * // Create many ClinicAccounts
     * const clinicAccount = await prisma.clinicAccount.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ClinicAccountCreateManyArgs>(args?: SelectSubset<T, ClinicAccountCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ClinicAccounts and returns the data saved in the database.
     * @param {ClinicAccountCreateManyAndReturnArgs} args - Arguments to create many ClinicAccounts.
     * @example
     * // Create many ClinicAccounts
     * const clinicAccount = await prisma.clinicAccount.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ClinicAccounts and only return the `id`
     * const clinicAccountWithIdOnly = await prisma.clinicAccount.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ClinicAccountCreateManyAndReturnArgs>(args?: SelectSubset<T, ClinicAccountCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ClinicAccount.
     * @param {ClinicAccountDeleteArgs} args - Arguments to delete one ClinicAccount.
     * @example
     * // Delete one ClinicAccount
     * const ClinicAccount = await prisma.clinicAccount.delete({
     *   where: {
     *     // ... filter to delete one ClinicAccount
     *   }
     * })
     * 
     */
    delete<T extends ClinicAccountDeleteArgs>(args: SelectSubset<T, ClinicAccountDeleteArgs<ExtArgs>>): Prisma__ClinicAccountClient<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ClinicAccount.
     * @param {ClinicAccountUpdateArgs} args - Arguments to update one ClinicAccount.
     * @example
     * // Update one ClinicAccount
     * const clinicAccount = await prisma.clinicAccount.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ClinicAccountUpdateArgs>(args: SelectSubset<T, ClinicAccountUpdateArgs<ExtArgs>>): Prisma__ClinicAccountClient<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ClinicAccounts.
     * @param {ClinicAccountDeleteManyArgs} args - Arguments to filter ClinicAccounts to delete.
     * @example
     * // Delete a few ClinicAccounts
     * const { count } = await prisma.clinicAccount.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ClinicAccountDeleteManyArgs>(args?: SelectSubset<T, ClinicAccountDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ClinicAccounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClinicAccountUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ClinicAccounts
     * const clinicAccount = await prisma.clinicAccount.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ClinicAccountUpdateManyArgs>(args: SelectSubset<T, ClinicAccountUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ClinicAccounts and returns the data updated in the database.
     * @param {ClinicAccountUpdateManyAndReturnArgs} args - Arguments to update many ClinicAccounts.
     * @example
     * // Update many ClinicAccounts
     * const clinicAccount = await prisma.clinicAccount.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ClinicAccounts and only return the `id`
     * const clinicAccountWithIdOnly = await prisma.clinicAccount.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ClinicAccountUpdateManyAndReturnArgs>(args: SelectSubset<T, ClinicAccountUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ClinicAccount.
     * @param {ClinicAccountUpsertArgs} args - Arguments to update or create a ClinicAccount.
     * @example
     * // Update or create a ClinicAccount
     * const clinicAccount = await prisma.clinicAccount.upsert({
     *   create: {
     *     // ... data to create a ClinicAccount
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ClinicAccount we want to update
     *   }
     * })
     */
    upsert<T extends ClinicAccountUpsertArgs>(args: SelectSubset<T, ClinicAccountUpsertArgs<ExtArgs>>): Prisma__ClinicAccountClient<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ClinicAccounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClinicAccountCountArgs} args - Arguments to filter ClinicAccounts to count.
     * @example
     * // Count the number of ClinicAccounts
     * const count = await prisma.clinicAccount.count({
     *   where: {
     *     // ... the filter for the ClinicAccounts we want to count
     *   }
     * })
    **/
    count<T extends ClinicAccountCountArgs>(
      args?: Subset<T, ClinicAccountCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ClinicAccountCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ClinicAccount.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClinicAccountAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ClinicAccountAggregateArgs>(args: Subset<T, ClinicAccountAggregateArgs>): Prisma.PrismaPromise<GetClinicAccountAggregateType<T>>

    /**
     * Group by ClinicAccount.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ClinicAccountGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ClinicAccountGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ClinicAccountGroupByArgs['orderBy'] }
        : { orderBy?: ClinicAccountGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ClinicAccountGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetClinicAccountGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ClinicAccount model
   */
  readonly fields: ClinicAccountFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ClinicAccount.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ClinicAccountClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    steps<T extends ClinicAccount$stepsArgs<ExtArgs> = {}>(args?: Subset<T, ClinicAccount$stepsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OnboardingStepPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    activity<T extends ClinicAccount$activityArgs<ExtArgs> = {}>(args?: Subset<T, ClinicAccount$activityArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ActivityLogPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    health<T extends ClinicAccount$healthArgs<ExtArgs> = {}>(args?: Subset<T, ClinicAccount$healthArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HealthCheckPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    invoices<T extends ClinicAccount$invoicesArgs<ExtArgs> = {}>(args?: Subset<T, ClinicAccount$invoicesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    planChanges<T extends ClinicAccount$planChangesArgs<ExtArgs> = {}>(args?: Subset<T, ClinicAccount$planChangesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PlanChangePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ClinicAccount model
   */
  interface ClinicAccountFieldRefs {
    readonly id: FieldRef<"ClinicAccount", 'String'>
    readonly slug: FieldRef<"ClinicAccount", 'String'>
    readonly name: FieldRef<"ClinicAccount", 'String'>
    readonly contactName: FieldRef<"ClinicAccount", 'String'>
    readonly contactEmail: FieldRef<"ClinicAccount", 'String'>
    readonly contactPhone: FieldRef<"ClinicAccount", 'String'>
    readonly city: FieldRef<"ClinicAccount", 'String'>
    readonly notes: FieldRef<"ClinicAccount", 'String'>
    readonly status: FieldRef<"ClinicAccount", 'AccountStatus'>
    readonly plan: FieldRef<"ClinicAccount", 'PlanTier'>
    readonly featureOverrides: FieldRef<"ClinicAccount", 'Json'>
    readonly monthlyFee: FieldRef<"ClinicAccount", 'Decimal'>
    readonly currency: FieldRef<"ClinicAccount", 'String'>
    readonly billingCycle: FieldRef<"ClinicAccount", 'BillingCycle'>
    readonly startedAt: FieldRef<"ClinicAccount", 'DateTime'>
    readonly renewsAt: FieldRef<"ClinicAccount", 'DateTime'>
    readonly pricingModel: FieldRef<"ClinicAccount", 'PricingModel'>
    readonly setupFee: FieldRef<"ClinicAccount", 'Decimal'>
    readonly yearlyFee: FieldRef<"ClinicAccount", 'Decimal'>
    readonly licenceFee: FieldRef<"ClinicAccount", 'Decimal'>
    readonly amcPercent: FieldRef<"ClinicAccount", 'Decimal'>
    readonly hostingFee: FieldRef<"ClinicAccount", 'Decimal'>
    readonly maxUsersOverride: FieldRef<"ClinicAccount", 'Int'>
    readonly billingName: FieldRef<"ClinicAccount", 'String'>
    readonly billingAddress: FieldRef<"ClinicAccount", 'String'>
    readonly gstin: FieldRef<"ClinicAccount", 'String'>
    readonly billingState: FieldRef<"ClinicAccount", 'String'>
    readonly appliedPlan: FieldRef<"ClinicAccount", 'PlanTier'>
    readonly appliedFeatures: FieldRef<"ClinicAccount", 'String'>
    readonly appliedReadOnly: FieldRef<"ClinicAccount", 'Boolean'>
    readonly appliedAt: FieldRef<"ClinicAccount", 'DateTime'>
    readonly planJobId: FieldRef<"ClinicAccount", 'String'>
    readonly isDemo: FieldRef<"ClinicAccount", 'Boolean'>
    readonly publicDomain: FieldRef<"ClinicAccount", 'String'>
    readonly portalDomain: FieldRef<"ClinicAccount", 'String'>
    readonly apiDomain: FieldRef<"ClinicAccount", 'String'>
    readonly neonProjectId: FieldRef<"ClinicAccount", 'String'>
    readonly vercelWebProjectId: FieldRef<"ClinicAccount", 'String'>
    readonly vercelApiProjectId: FieldRef<"ClinicAccount", 'String'>
    readonly provisionedAt: FieldRef<"ClinicAccount", 'DateTime'>
    readonly createdAt: FieldRef<"ClinicAccount", 'DateTime'>
    readonly updatedAt: FieldRef<"ClinicAccount", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ClinicAccount findUnique
   */
  export type ClinicAccountFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccount
     */
    select?: ClinicAccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClinicAccount
     */
    omit?: ClinicAccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClinicAccountInclude<ExtArgs> | null
    /**
     * Filter, which ClinicAccount to fetch.
     */
    where: ClinicAccountWhereUniqueInput
  }

  /**
   * ClinicAccount findUniqueOrThrow
   */
  export type ClinicAccountFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccount
     */
    select?: ClinicAccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClinicAccount
     */
    omit?: ClinicAccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClinicAccountInclude<ExtArgs> | null
    /**
     * Filter, which ClinicAccount to fetch.
     */
    where: ClinicAccountWhereUniqueInput
  }

  /**
   * ClinicAccount findFirst
   */
  export type ClinicAccountFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccount
     */
    select?: ClinicAccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClinicAccount
     */
    omit?: ClinicAccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClinicAccountInclude<ExtArgs> | null
    /**
     * Filter, which ClinicAccount to fetch.
     */
    where?: ClinicAccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClinicAccounts to fetch.
     */
    orderBy?: ClinicAccountOrderByWithRelationInput | ClinicAccountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClinicAccounts.
     */
    cursor?: ClinicAccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClinicAccounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClinicAccounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClinicAccounts.
     */
    distinct?: ClinicAccountScalarFieldEnum | ClinicAccountScalarFieldEnum[]
  }

  /**
   * ClinicAccount findFirstOrThrow
   */
  export type ClinicAccountFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccount
     */
    select?: ClinicAccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClinicAccount
     */
    omit?: ClinicAccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClinicAccountInclude<ExtArgs> | null
    /**
     * Filter, which ClinicAccount to fetch.
     */
    where?: ClinicAccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClinicAccounts to fetch.
     */
    orderBy?: ClinicAccountOrderByWithRelationInput | ClinicAccountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ClinicAccounts.
     */
    cursor?: ClinicAccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClinicAccounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClinicAccounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ClinicAccounts.
     */
    distinct?: ClinicAccountScalarFieldEnum | ClinicAccountScalarFieldEnum[]
  }

  /**
   * ClinicAccount findMany
   */
  export type ClinicAccountFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccount
     */
    select?: ClinicAccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClinicAccount
     */
    omit?: ClinicAccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClinicAccountInclude<ExtArgs> | null
    /**
     * Filter, which ClinicAccounts to fetch.
     */
    where?: ClinicAccountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ClinicAccounts to fetch.
     */
    orderBy?: ClinicAccountOrderByWithRelationInput | ClinicAccountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ClinicAccounts.
     */
    cursor?: ClinicAccountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ClinicAccounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ClinicAccounts.
     */
    skip?: number
    distinct?: ClinicAccountScalarFieldEnum | ClinicAccountScalarFieldEnum[]
  }

  /**
   * ClinicAccount create
   */
  export type ClinicAccountCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccount
     */
    select?: ClinicAccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClinicAccount
     */
    omit?: ClinicAccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClinicAccountInclude<ExtArgs> | null
    /**
     * The data needed to create a ClinicAccount.
     */
    data: XOR<ClinicAccountCreateInput, ClinicAccountUncheckedCreateInput>
  }

  /**
   * ClinicAccount createMany
   */
  export type ClinicAccountCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ClinicAccounts.
     */
    data: ClinicAccountCreateManyInput | ClinicAccountCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ClinicAccount createManyAndReturn
   */
  export type ClinicAccountCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccount
     */
    select?: ClinicAccountSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ClinicAccount
     */
    omit?: ClinicAccountOmit<ExtArgs> | null
    /**
     * The data used to create many ClinicAccounts.
     */
    data: ClinicAccountCreateManyInput | ClinicAccountCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ClinicAccount update
   */
  export type ClinicAccountUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccount
     */
    select?: ClinicAccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClinicAccount
     */
    omit?: ClinicAccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClinicAccountInclude<ExtArgs> | null
    /**
     * The data needed to update a ClinicAccount.
     */
    data: XOR<ClinicAccountUpdateInput, ClinicAccountUncheckedUpdateInput>
    /**
     * Choose, which ClinicAccount to update.
     */
    where: ClinicAccountWhereUniqueInput
  }

  /**
   * ClinicAccount updateMany
   */
  export type ClinicAccountUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ClinicAccounts.
     */
    data: XOR<ClinicAccountUpdateManyMutationInput, ClinicAccountUncheckedUpdateManyInput>
    /**
     * Filter which ClinicAccounts to update
     */
    where?: ClinicAccountWhereInput
    /**
     * Limit how many ClinicAccounts to update.
     */
    limit?: number
  }

  /**
   * ClinicAccount updateManyAndReturn
   */
  export type ClinicAccountUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccount
     */
    select?: ClinicAccountSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ClinicAccount
     */
    omit?: ClinicAccountOmit<ExtArgs> | null
    /**
     * The data used to update ClinicAccounts.
     */
    data: XOR<ClinicAccountUpdateManyMutationInput, ClinicAccountUncheckedUpdateManyInput>
    /**
     * Filter which ClinicAccounts to update
     */
    where?: ClinicAccountWhereInput
    /**
     * Limit how many ClinicAccounts to update.
     */
    limit?: number
  }

  /**
   * ClinicAccount upsert
   */
  export type ClinicAccountUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccount
     */
    select?: ClinicAccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClinicAccount
     */
    omit?: ClinicAccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClinicAccountInclude<ExtArgs> | null
    /**
     * The filter to search for the ClinicAccount to update in case it exists.
     */
    where: ClinicAccountWhereUniqueInput
    /**
     * In case the ClinicAccount found by the `where` argument doesn't exist, create a new ClinicAccount with this data.
     */
    create: XOR<ClinicAccountCreateInput, ClinicAccountUncheckedCreateInput>
    /**
     * In case the ClinicAccount was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ClinicAccountUpdateInput, ClinicAccountUncheckedUpdateInput>
  }

  /**
   * ClinicAccount delete
   */
  export type ClinicAccountDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccount
     */
    select?: ClinicAccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClinicAccount
     */
    omit?: ClinicAccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClinicAccountInclude<ExtArgs> | null
    /**
     * Filter which ClinicAccount to delete.
     */
    where: ClinicAccountWhereUniqueInput
  }

  /**
   * ClinicAccount deleteMany
   */
  export type ClinicAccountDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ClinicAccounts to delete
     */
    where?: ClinicAccountWhereInput
    /**
     * Limit how many ClinicAccounts to delete.
     */
    limit?: number
  }

  /**
   * ClinicAccount.steps
   */
  export type ClinicAccount$stepsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OnboardingStep
     */
    select?: OnboardingStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OnboardingStep
     */
    omit?: OnboardingStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OnboardingStepInclude<ExtArgs> | null
    where?: OnboardingStepWhereInput
    orderBy?: OnboardingStepOrderByWithRelationInput | OnboardingStepOrderByWithRelationInput[]
    cursor?: OnboardingStepWhereUniqueInput
    take?: number
    skip?: number
    distinct?: OnboardingStepScalarFieldEnum | OnboardingStepScalarFieldEnum[]
  }

  /**
   * ClinicAccount.activity
   */
  export type ClinicAccount$activityArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogInclude<ExtArgs> | null
    where?: ActivityLogWhereInput
    orderBy?: ActivityLogOrderByWithRelationInput | ActivityLogOrderByWithRelationInput[]
    cursor?: ActivityLogWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ActivityLogScalarFieldEnum | ActivityLogScalarFieldEnum[]
  }

  /**
   * ClinicAccount.health
   */
  export type ClinicAccount$healthArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HealthCheck
     */
    select?: HealthCheckSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HealthCheck
     */
    omit?: HealthCheckOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HealthCheckInclude<ExtArgs> | null
    where?: HealthCheckWhereInput
    orderBy?: HealthCheckOrderByWithRelationInput | HealthCheckOrderByWithRelationInput[]
    cursor?: HealthCheckWhereUniqueInput
    take?: number
    skip?: number
    distinct?: HealthCheckScalarFieldEnum | HealthCheckScalarFieldEnum[]
  }

  /**
   * ClinicAccount.invoices
   */
  export type ClinicAccount$invoicesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    where?: InvoiceWhereInput
    orderBy?: InvoiceOrderByWithRelationInput | InvoiceOrderByWithRelationInput[]
    cursor?: InvoiceWhereUniqueInput
    take?: number
    skip?: number
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[]
  }

  /**
   * ClinicAccount.planChanges
   */
  export type ClinicAccount$planChangesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlanChange
     */
    select?: PlanChangeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlanChange
     */
    omit?: PlanChangeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlanChangeInclude<ExtArgs> | null
    where?: PlanChangeWhereInput
    orderBy?: PlanChangeOrderByWithRelationInput | PlanChangeOrderByWithRelationInput[]
    cursor?: PlanChangeWhereUniqueInput
    take?: number
    skip?: number
    distinct?: PlanChangeScalarFieldEnum | PlanChangeScalarFieldEnum[]
  }

  /**
   * ClinicAccount without action
   */
  export type ClinicAccountDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccount
     */
    select?: ClinicAccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClinicAccount
     */
    omit?: ClinicAccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClinicAccountInclude<ExtArgs> | null
  }


  /**
   * Model OnboardingStep
   */

  export type AggregateOnboardingStep = {
    _count: OnboardingStepCountAggregateOutputType | null
    _avg: OnboardingStepAvgAggregateOutputType | null
    _sum: OnboardingStepSumAggregateOutputType | null
    _min: OnboardingStepMinAggregateOutputType | null
    _max: OnboardingStepMaxAggregateOutputType | null
  }

  export type OnboardingStepAvgAggregateOutputType = {
    sortOrder: number | null
  }

  export type OnboardingStepSumAggregateOutputType = {
    sortOrder: number | null
  }

  export type OnboardingStepMinAggregateOutputType = {
    id: string | null
    accountId: string | null
    key: string | null
    label: string | null
    automated: boolean | null
    sortOrder: number | null
    done: boolean | null
    doneAt: Date | null
    notes: string | null
  }

  export type OnboardingStepMaxAggregateOutputType = {
    id: string | null
    accountId: string | null
    key: string | null
    label: string | null
    automated: boolean | null
    sortOrder: number | null
    done: boolean | null
    doneAt: Date | null
    notes: string | null
  }

  export type OnboardingStepCountAggregateOutputType = {
    id: number
    accountId: number
    key: number
    label: number
    automated: number
    sortOrder: number
    done: number
    doneAt: number
    notes: number
    _all: number
  }


  export type OnboardingStepAvgAggregateInputType = {
    sortOrder?: true
  }

  export type OnboardingStepSumAggregateInputType = {
    sortOrder?: true
  }

  export type OnboardingStepMinAggregateInputType = {
    id?: true
    accountId?: true
    key?: true
    label?: true
    automated?: true
    sortOrder?: true
    done?: true
    doneAt?: true
    notes?: true
  }

  export type OnboardingStepMaxAggregateInputType = {
    id?: true
    accountId?: true
    key?: true
    label?: true
    automated?: true
    sortOrder?: true
    done?: true
    doneAt?: true
    notes?: true
  }

  export type OnboardingStepCountAggregateInputType = {
    id?: true
    accountId?: true
    key?: true
    label?: true
    automated?: true
    sortOrder?: true
    done?: true
    doneAt?: true
    notes?: true
    _all?: true
  }

  export type OnboardingStepAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which OnboardingStep to aggregate.
     */
    where?: OnboardingStepWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OnboardingSteps to fetch.
     */
    orderBy?: OnboardingStepOrderByWithRelationInput | OnboardingStepOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: OnboardingStepWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OnboardingSteps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OnboardingSteps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned OnboardingSteps
    **/
    _count?: true | OnboardingStepCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: OnboardingStepAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: OnboardingStepSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: OnboardingStepMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: OnboardingStepMaxAggregateInputType
  }

  export type GetOnboardingStepAggregateType<T extends OnboardingStepAggregateArgs> = {
        [P in keyof T & keyof AggregateOnboardingStep]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateOnboardingStep[P]>
      : GetScalarType<T[P], AggregateOnboardingStep[P]>
  }




  export type OnboardingStepGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: OnboardingStepWhereInput
    orderBy?: OnboardingStepOrderByWithAggregationInput | OnboardingStepOrderByWithAggregationInput[]
    by: OnboardingStepScalarFieldEnum[] | OnboardingStepScalarFieldEnum
    having?: OnboardingStepScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: OnboardingStepCountAggregateInputType | true
    _avg?: OnboardingStepAvgAggregateInputType
    _sum?: OnboardingStepSumAggregateInputType
    _min?: OnboardingStepMinAggregateInputType
    _max?: OnboardingStepMaxAggregateInputType
  }

  export type OnboardingStepGroupByOutputType = {
    id: string
    accountId: string
    key: string
    label: string
    automated: boolean
    sortOrder: number
    done: boolean
    doneAt: Date | null
    notes: string | null
    _count: OnboardingStepCountAggregateOutputType | null
    _avg: OnboardingStepAvgAggregateOutputType | null
    _sum: OnboardingStepSumAggregateOutputType | null
    _min: OnboardingStepMinAggregateOutputType | null
    _max: OnboardingStepMaxAggregateOutputType | null
  }

  type GetOnboardingStepGroupByPayload<T extends OnboardingStepGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<OnboardingStepGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof OnboardingStepGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], OnboardingStepGroupByOutputType[P]>
            : GetScalarType<T[P], OnboardingStepGroupByOutputType[P]>
        }
      >
    >


  export type OnboardingStepSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    key?: boolean
    label?: boolean
    automated?: boolean
    sortOrder?: boolean
    done?: boolean
    doneAt?: boolean
    notes?: boolean
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["onboardingStep"]>

  export type OnboardingStepSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    key?: boolean
    label?: boolean
    automated?: boolean
    sortOrder?: boolean
    done?: boolean
    doneAt?: boolean
    notes?: boolean
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["onboardingStep"]>

  export type OnboardingStepSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    key?: boolean
    label?: boolean
    automated?: boolean
    sortOrder?: boolean
    done?: boolean
    doneAt?: boolean
    notes?: boolean
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["onboardingStep"]>

  export type OnboardingStepSelectScalar = {
    id?: boolean
    accountId?: boolean
    key?: boolean
    label?: boolean
    automated?: boolean
    sortOrder?: boolean
    done?: boolean
    doneAt?: boolean
    notes?: boolean
  }

  export type OnboardingStepOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "accountId" | "key" | "label" | "automated" | "sortOrder" | "done" | "doneAt" | "notes", ExtArgs["result"]["onboardingStep"]>
  export type OnboardingStepInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }
  export type OnboardingStepIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }
  export type OnboardingStepIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }

  export type $OnboardingStepPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "OnboardingStep"
    objects: {
      account: Prisma.$ClinicAccountPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      accountId: string
      key: string
      label: string
      /**
       * Whether the console performs this step or a human does. Shown in the
       * UI so nobody waits on a button that was never going to exist.
       */
      automated: boolean
      sortOrder: number
      done: boolean
      doneAt: Date | null
      notes: string | null
    }, ExtArgs["result"]["onboardingStep"]>
    composites: {}
  }

  type OnboardingStepGetPayload<S extends boolean | null | undefined | OnboardingStepDefaultArgs> = $Result.GetResult<Prisma.$OnboardingStepPayload, S>

  type OnboardingStepCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<OnboardingStepFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: OnboardingStepCountAggregateInputType | true
    }

  export interface OnboardingStepDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['OnboardingStep'], meta: { name: 'OnboardingStep' } }
    /**
     * Find zero or one OnboardingStep that matches the filter.
     * @param {OnboardingStepFindUniqueArgs} args - Arguments to find a OnboardingStep
     * @example
     * // Get one OnboardingStep
     * const onboardingStep = await prisma.onboardingStep.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends OnboardingStepFindUniqueArgs>(args: SelectSubset<T, OnboardingStepFindUniqueArgs<ExtArgs>>): Prisma__OnboardingStepClient<$Result.GetResult<Prisma.$OnboardingStepPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one OnboardingStep that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {OnboardingStepFindUniqueOrThrowArgs} args - Arguments to find a OnboardingStep
     * @example
     * // Get one OnboardingStep
     * const onboardingStep = await prisma.onboardingStep.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends OnboardingStepFindUniqueOrThrowArgs>(args: SelectSubset<T, OnboardingStepFindUniqueOrThrowArgs<ExtArgs>>): Prisma__OnboardingStepClient<$Result.GetResult<Prisma.$OnboardingStepPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first OnboardingStep that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OnboardingStepFindFirstArgs} args - Arguments to find a OnboardingStep
     * @example
     * // Get one OnboardingStep
     * const onboardingStep = await prisma.onboardingStep.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends OnboardingStepFindFirstArgs>(args?: SelectSubset<T, OnboardingStepFindFirstArgs<ExtArgs>>): Prisma__OnboardingStepClient<$Result.GetResult<Prisma.$OnboardingStepPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first OnboardingStep that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OnboardingStepFindFirstOrThrowArgs} args - Arguments to find a OnboardingStep
     * @example
     * // Get one OnboardingStep
     * const onboardingStep = await prisma.onboardingStep.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends OnboardingStepFindFirstOrThrowArgs>(args?: SelectSubset<T, OnboardingStepFindFirstOrThrowArgs<ExtArgs>>): Prisma__OnboardingStepClient<$Result.GetResult<Prisma.$OnboardingStepPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more OnboardingSteps that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OnboardingStepFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all OnboardingSteps
     * const onboardingSteps = await prisma.onboardingStep.findMany()
     * 
     * // Get first 10 OnboardingSteps
     * const onboardingSteps = await prisma.onboardingStep.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const onboardingStepWithIdOnly = await prisma.onboardingStep.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends OnboardingStepFindManyArgs>(args?: SelectSubset<T, OnboardingStepFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OnboardingStepPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a OnboardingStep.
     * @param {OnboardingStepCreateArgs} args - Arguments to create a OnboardingStep.
     * @example
     * // Create one OnboardingStep
     * const OnboardingStep = await prisma.onboardingStep.create({
     *   data: {
     *     // ... data to create a OnboardingStep
     *   }
     * })
     * 
     */
    create<T extends OnboardingStepCreateArgs>(args: SelectSubset<T, OnboardingStepCreateArgs<ExtArgs>>): Prisma__OnboardingStepClient<$Result.GetResult<Prisma.$OnboardingStepPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many OnboardingSteps.
     * @param {OnboardingStepCreateManyArgs} args - Arguments to create many OnboardingSteps.
     * @example
     * // Create many OnboardingSteps
     * const onboardingStep = await prisma.onboardingStep.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends OnboardingStepCreateManyArgs>(args?: SelectSubset<T, OnboardingStepCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many OnboardingSteps and returns the data saved in the database.
     * @param {OnboardingStepCreateManyAndReturnArgs} args - Arguments to create many OnboardingSteps.
     * @example
     * // Create many OnboardingSteps
     * const onboardingStep = await prisma.onboardingStep.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many OnboardingSteps and only return the `id`
     * const onboardingStepWithIdOnly = await prisma.onboardingStep.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends OnboardingStepCreateManyAndReturnArgs>(args?: SelectSubset<T, OnboardingStepCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OnboardingStepPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a OnboardingStep.
     * @param {OnboardingStepDeleteArgs} args - Arguments to delete one OnboardingStep.
     * @example
     * // Delete one OnboardingStep
     * const OnboardingStep = await prisma.onboardingStep.delete({
     *   where: {
     *     // ... filter to delete one OnboardingStep
     *   }
     * })
     * 
     */
    delete<T extends OnboardingStepDeleteArgs>(args: SelectSubset<T, OnboardingStepDeleteArgs<ExtArgs>>): Prisma__OnboardingStepClient<$Result.GetResult<Prisma.$OnboardingStepPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one OnboardingStep.
     * @param {OnboardingStepUpdateArgs} args - Arguments to update one OnboardingStep.
     * @example
     * // Update one OnboardingStep
     * const onboardingStep = await prisma.onboardingStep.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends OnboardingStepUpdateArgs>(args: SelectSubset<T, OnboardingStepUpdateArgs<ExtArgs>>): Prisma__OnboardingStepClient<$Result.GetResult<Prisma.$OnboardingStepPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more OnboardingSteps.
     * @param {OnboardingStepDeleteManyArgs} args - Arguments to filter OnboardingSteps to delete.
     * @example
     * // Delete a few OnboardingSteps
     * const { count } = await prisma.onboardingStep.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends OnboardingStepDeleteManyArgs>(args?: SelectSubset<T, OnboardingStepDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more OnboardingSteps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OnboardingStepUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many OnboardingSteps
     * const onboardingStep = await prisma.onboardingStep.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends OnboardingStepUpdateManyArgs>(args: SelectSubset<T, OnboardingStepUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more OnboardingSteps and returns the data updated in the database.
     * @param {OnboardingStepUpdateManyAndReturnArgs} args - Arguments to update many OnboardingSteps.
     * @example
     * // Update many OnboardingSteps
     * const onboardingStep = await prisma.onboardingStep.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more OnboardingSteps and only return the `id`
     * const onboardingStepWithIdOnly = await prisma.onboardingStep.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends OnboardingStepUpdateManyAndReturnArgs>(args: SelectSubset<T, OnboardingStepUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$OnboardingStepPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one OnboardingStep.
     * @param {OnboardingStepUpsertArgs} args - Arguments to update or create a OnboardingStep.
     * @example
     * // Update or create a OnboardingStep
     * const onboardingStep = await prisma.onboardingStep.upsert({
     *   create: {
     *     // ... data to create a OnboardingStep
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the OnboardingStep we want to update
     *   }
     * })
     */
    upsert<T extends OnboardingStepUpsertArgs>(args: SelectSubset<T, OnboardingStepUpsertArgs<ExtArgs>>): Prisma__OnboardingStepClient<$Result.GetResult<Prisma.$OnboardingStepPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of OnboardingSteps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OnboardingStepCountArgs} args - Arguments to filter OnboardingSteps to count.
     * @example
     * // Count the number of OnboardingSteps
     * const count = await prisma.onboardingStep.count({
     *   where: {
     *     // ... the filter for the OnboardingSteps we want to count
     *   }
     * })
    **/
    count<T extends OnboardingStepCountArgs>(
      args?: Subset<T, OnboardingStepCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], OnboardingStepCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a OnboardingStep.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OnboardingStepAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends OnboardingStepAggregateArgs>(args: Subset<T, OnboardingStepAggregateArgs>): Prisma.PrismaPromise<GetOnboardingStepAggregateType<T>>

    /**
     * Group by OnboardingStep.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {OnboardingStepGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends OnboardingStepGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: OnboardingStepGroupByArgs['orderBy'] }
        : { orderBy?: OnboardingStepGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, OnboardingStepGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetOnboardingStepGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the OnboardingStep model
   */
  readonly fields: OnboardingStepFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for OnboardingStep.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__OnboardingStepClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    account<T extends ClinicAccountDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ClinicAccountDefaultArgs<ExtArgs>>): Prisma__ClinicAccountClient<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the OnboardingStep model
   */
  interface OnboardingStepFieldRefs {
    readonly id: FieldRef<"OnboardingStep", 'String'>
    readonly accountId: FieldRef<"OnboardingStep", 'String'>
    readonly key: FieldRef<"OnboardingStep", 'String'>
    readonly label: FieldRef<"OnboardingStep", 'String'>
    readonly automated: FieldRef<"OnboardingStep", 'Boolean'>
    readonly sortOrder: FieldRef<"OnboardingStep", 'Int'>
    readonly done: FieldRef<"OnboardingStep", 'Boolean'>
    readonly doneAt: FieldRef<"OnboardingStep", 'DateTime'>
    readonly notes: FieldRef<"OnboardingStep", 'String'>
  }
    

  // Custom InputTypes
  /**
   * OnboardingStep findUnique
   */
  export type OnboardingStepFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OnboardingStep
     */
    select?: OnboardingStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OnboardingStep
     */
    omit?: OnboardingStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OnboardingStepInclude<ExtArgs> | null
    /**
     * Filter, which OnboardingStep to fetch.
     */
    where: OnboardingStepWhereUniqueInput
  }

  /**
   * OnboardingStep findUniqueOrThrow
   */
  export type OnboardingStepFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OnboardingStep
     */
    select?: OnboardingStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OnboardingStep
     */
    omit?: OnboardingStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OnboardingStepInclude<ExtArgs> | null
    /**
     * Filter, which OnboardingStep to fetch.
     */
    where: OnboardingStepWhereUniqueInput
  }

  /**
   * OnboardingStep findFirst
   */
  export type OnboardingStepFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OnboardingStep
     */
    select?: OnboardingStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OnboardingStep
     */
    omit?: OnboardingStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OnboardingStepInclude<ExtArgs> | null
    /**
     * Filter, which OnboardingStep to fetch.
     */
    where?: OnboardingStepWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OnboardingSteps to fetch.
     */
    orderBy?: OnboardingStepOrderByWithRelationInput | OnboardingStepOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for OnboardingSteps.
     */
    cursor?: OnboardingStepWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OnboardingSteps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OnboardingSteps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of OnboardingSteps.
     */
    distinct?: OnboardingStepScalarFieldEnum | OnboardingStepScalarFieldEnum[]
  }

  /**
   * OnboardingStep findFirstOrThrow
   */
  export type OnboardingStepFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OnboardingStep
     */
    select?: OnboardingStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OnboardingStep
     */
    omit?: OnboardingStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OnboardingStepInclude<ExtArgs> | null
    /**
     * Filter, which OnboardingStep to fetch.
     */
    where?: OnboardingStepWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OnboardingSteps to fetch.
     */
    orderBy?: OnboardingStepOrderByWithRelationInput | OnboardingStepOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for OnboardingSteps.
     */
    cursor?: OnboardingStepWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OnboardingSteps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OnboardingSteps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of OnboardingSteps.
     */
    distinct?: OnboardingStepScalarFieldEnum | OnboardingStepScalarFieldEnum[]
  }

  /**
   * OnboardingStep findMany
   */
  export type OnboardingStepFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OnboardingStep
     */
    select?: OnboardingStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OnboardingStep
     */
    omit?: OnboardingStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OnboardingStepInclude<ExtArgs> | null
    /**
     * Filter, which OnboardingSteps to fetch.
     */
    where?: OnboardingStepWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of OnboardingSteps to fetch.
     */
    orderBy?: OnboardingStepOrderByWithRelationInput | OnboardingStepOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing OnboardingSteps.
     */
    cursor?: OnboardingStepWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` OnboardingSteps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` OnboardingSteps.
     */
    skip?: number
    distinct?: OnboardingStepScalarFieldEnum | OnboardingStepScalarFieldEnum[]
  }

  /**
   * OnboardingStep create
   */
  export type OnboardingStepCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OnboardingStep
     */
    select?: OnboardingStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OnboardingStep
     */
    omit?: OnboardingStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OnboardingStepInclude<ExtArgs> | null
    /**
     * The data needed to create a OnboardingStep.
     */
    data: XOR<OnboardingStepCreateInput, OnboardingStepUncheckedCreateInput>
  }

  /**
   * OnboardingStep createMany
   */
  export type OnboardingStepCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many OnboardingSteps.
     */
    data: OnboardingStepCreateManyInput | OnboardingStepCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * OnboardingStep createManyAndReturn
   */
  export type OnboardingStepCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OnboardingStep
     */
    select?: OnboardingStepSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the OnboardingStep
     */
    omit?: OnboardingStepOmit<ExtArgs> | null
    /**
     * The data used to create many OnboardingSteps.
     */
    data: OnboardingStepCreateManyInput | OnboardingStepCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OnboardingStepIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * OnboardingStep update
   */
  export type OnboardingStepUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OnboardingStep
     */
    select?: OnboardingStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OnboardingStep
     */
    omit?: OnboardingStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OnboardingStepInclude<ExtArgs> | null
    /**
     * The data needed to update a OnboardingStep.
     */
    data: XOR<OnboardingStepUpdateInput, OnboardingStepUncheckedUpdateInput>
    /**
     * Choose, which OnboardingStep to update.
     */
    where: OnboardingStepWhereUniqueInput
  }

  /**
   * OnboardingStep updateMany
   */
  export type OnboardingStepUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update OnboardingSteps.
     */
    data: XOR<OnboardingStepUpdateManyMutationInput, OnboardingStepUncheckedUpdateManyInput>
    /**
     * Filter which OnboardingSteps to update
     */
    where?: OnboardingStepWhereInput
    /**
     * Limit how many OnboardingSteps to update.
     */
    limit?: number
  }

  /**
   * OnboardingStep updateManyAndReturn
   */
  export type OnboardingStepUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OnboardingStep
     */
    select?: OnboardingStepSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the OnboardingStep
     */
    omit?: OnboardingStepOmit<ExtArgs> | null
    /**
     * The data used to update OnboardingSteps.
     */
    data: XOR<OnboardingStepUpdateManyMutationInput, OnboardingStepUncheckedUpdateManyInput>
    /**
     * Filter which OnboardingSteps to update
     */
    where?: OnboardingStepWhereInput
    /**
     * Limit how many OnboardingSteps to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OnboardingStepIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * OnboardingStep upsert
   */
  export type OnboardingStepUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OnboardingStep
     */
    select?: OnboardingStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OnboardingStep
     */
    omit?: OnboardingStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OnboardingStepInclude<ExtArgs> | null
    /**
     * The filter to search for the OnboardingStep to update in case it exists.
     */
    where: OnboardingStepWhereUniqueInput
    /**
     * In case the OnboardingStep found by the `where` argument doesn't exist, create a new OnboardingStep with this data.
     */
    create: XOR<OnboardingStepCreateInput, OnboardingStepUncheckedCreateInput>
    /**
     * In case the OnboardingStep was found with the provided `where` argument, update it with this data.
     */
    update: XOR<OnboardingStepUpdateInput, OnboardingStepUncheckedUpdateInput>
  }

  /**
   * OnboardingStep delete
   */
  export type OnboardingStepDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OnboardingStep
     */
    select?: OnboardingStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OnboardingStep
     */
    omit?: OnboardingStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OnboardingStepInclude<ExtArgs> | null
    /**
     * Filter which OnboardingStep to delete.
     */
    where: OnboardingStepWhereUniqueInput
  }

  /**
   * OnboardingStep deleteMany
   */
  export type OnboardingStepDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which OnboardingSteps to delete
     */
    where?: OnboardingStepWhereInput
    /**
     * Limit how many OnboardingSteps to delete.
     */
    limit?: number
  }

  /**
   * OnboardingStep without action
   */
  export type OnboardingStepDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the OnboardingStep
     */
    select?: OnboardingStepSelect<ExtArgs> | null
    /**
     * Omit specific fields from the OnboardingStep
     */
    omit?: OnboardingStepOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: OnboardingStepInclude<ExtArgs> | null
  }


  /**
   * Model ActivityLog
   */

  export type AggregateActivityLog = {
    _count: ActivityLogCountAggregateOutputType | null
    _min: ActivityLogMinAggregateOutputType | null
    _max: ActivityLogMaxAggregateOutputType | null
  }

  export type ActivityLogMinAggregateOutputType = {
    id: string | null
    accountId: string | null
    actorId: string | null
    actorName: string | null
    action: string | null
    detail: string | null
    applied: boolean | null
    at: Date | null
  }

  export type ActivityLogMaxAggregateOutputType = {
    id: string | null
    accountId: string | null
    actorId: string | null
    actorName: string | null
    action: string | null
    detail: string | null
    applied: boolean | null
    at: Date | null
  }

  export type ActivityLogCountAggregateOutputType = {
    id: number
    accountId: number
    actorId: number
    actorName: number
    action: number
    detail: number
    applied: number
    at: number
    _all: number
  }


  export type ActivityLogMinAggregateInputType = {
    id?: true
    accountId?: true
    actorId?: true
    actorName?: true
    action?: true
    detail?: true
    applied?: true
    at?: true
  }

  export type ActivityLogMaxAggregateInputType = {
    id?: true
    accountId?: true
    actorId?: true
    actorName?: true
    action?: true
    detail?: true
    applied?: true
    at?: true
  }

  export type ActivityLogCountAggregateInputType = {
    id?: true
    accountId?: true
    actorId?: true
    actorName?: true
    action?: true
    detail?: true
    applied?: true
    at?: true
    _all?: true
  }

  export type ActivityLogAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ActivityLog to aggregate.
     */
    where?: ActivityLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ActivityLogs to fetch.
     */
    orderBy?: ActivityLogOrderByWithRelationInput | ActivityLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ActivityLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ActivityLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ActivityLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ActivityLogs
    **/
    _count?: true | ActivityLogCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ActivityLogMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ActivityLogMaxAggregateInputType
  }

  export type GetActivityLogAggregateType<T extends ActivityLogAggregateArgs> = {
        [P in keyof T & keyof AggregateActivityLog]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateActivityLog[P]>
      : GetScalarType<T[P], AggregateActivityLog[P]>
  }




  export type ActivityLogGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ActivityLogWhereInput
    orderBy?: ActivityLogOrderByWithAggregationInput | ActivityLogOrderByWithAggregationInput[]
    by: ActivityLogScalarFieldEnum[] | ActivityLogScalarFieldEnum
    having?: ActivityLogScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ActivityLogCountAggregateInputType | true
    _min?: ActivityLogMinAggregateInputType
    _max?: ActivityLogMaxAggregateInputType
  }

  export type ActivityLogGroupByOutputType = {
    id: string
    accountId: string | null
    actorId: string | null
    actorName: string
    action: string
    detail: string | null
    applied: boolean
    at: Date
    _count: ActivityLogCountAggregateOutputType | null
    _min: ActivityLogMinAggregateOutputType | null
    _max: ActivityLogMaxAggregateOutputType | null
  }

  type GetActivityLogGroupByPayload<T extends ActivityLogGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ActivityLogGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ActivityLogGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ActivityLogGroupByOutputType[P]>
            : GetScalarType<T[P], ActivityLogGroupByOutputType[P]>
        }
      >
    >


  export type ActivityLogSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    actorId?: boolean
    actorName?: boolean
    action?: boolean
    detail?: boolean
    applied?: boolean
    at?: boolean
    account?: boolean | ActivityLog$accountArgs<ExtArgs>
    actor?: boolean | ActivityLog$actorArgs<ExtArgs>
  }, ExtArgs["result"]["activityLog"]>

  export type ActivityLogSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    actorId?: boolean
    actorName?: boolean
    action?: boolean
    detail?: boolean
    applied?: boolean
    at?: boolean
    account?: boolean | ActivityLog$accountArgs<ExtArgs>
    actor?: boolean | ActivityLog$actorArgs<ExtArgs>
  }, ExtArgs["result"]["activityLog"]>

  export type ActivityLogSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    actorId?: boolean
    actorName?: boolean
    action?: boolean
    detail?: boolean
    applied?: boolean
    at?: boolean
    account?: boolean | ActivityLog$accountArgs<ExtArgs>
    actor?: boolean | ActivityLog$actorArgs<ExtArgs>
  }, ExtArgs["result"]["activityLog"]>

  export type ActivityLogSelectScalar = {
    id?: boolean
    accountId?: boolean
    actorId?: boolean
    actorName?: boolean
    action?: boolean
    detail?: boolean
    applied?: boolean
    at?: boolean
  }

  export type ActivityLogOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "accountId" | "actorId" | "actorName" | "action" | "detail" | "applied" | "at", ExtArgs["result"]["activityLog"]>
  export type ActivityLogInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ActivityLog$accountArgs<ExtArgs>
    actor?: boolean | ActivityLog$actorArgs<ExtArgs>
  }
  export type ActivityLogIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ActivityLog$accountArgs<ExtArgs>
    actor?: boolean | ActivityLog$actorArgs<ExtArgs>
  }
  export type ActivityLogIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ActivityLog$accountArgs<ExtArgs>
    actor?: boolean | ActivityLog$actorArgs<ExtArgs>
  }

  export type $ActivityLogPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ActivityLog"
    objects: {
      account: Prisma.$ClinicAccountPayload<ExtArgs> | null
      actor: Prisma.$ProviderUserPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      accountId: string | null
      actorId: string | null
      /**
       * Denormalized so the entry still reads after a team member leaves.
       */
      actorName: string
      action: string
      detail: string | null
      /**
       * False when the action ran in dry-run mode, so a rehearsal is never
       * mistaken for the real thing when reading the history back.
       */
      applied: boolean
      at: Date
    }, ExtArgs["result"]["activityLog"]>
    composites: {}
  }

  type ActivityLogGetPayload<S extends boolean | null | undefined | ActivityLogDefaultArgs> = $Result.GetResult<Prisma.$ActivityLogPayload, S>

  type ActivityLogCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ActivityLogFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ActivityLogCountAggregateInputType | true
    }

  export interface ActivityLogDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ActivityLog'], meta: { name: 'ActivityLog' } }
    /**
     * Find zero or one ActivityLog that matches the filter.
     * @param {ActivityLogFindUniqueArgs} args - Arguments to find a ActivityLog
     * @example
     * // Get one ActivityLog
     * const activityLog = await prisma.activityLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ActivityLogFindUniqueArgs>(args: SelectSubset<T, ActivityLogFindUniqueArgs<ExtArgs>>): Prisma__ActivityLogClient<$Result.GetResult<Prisma.$ActivityLogPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ActivityLog that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ActivityLogFindUniqueOrThrowArgs} args - Arguments to find a ActivityLog
     * @example
     * // Get one ActivityLog
     * const activityLog = await prisma.activityLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ActivityLogFindUniqueOrThrowArgs>(args: SelectSubset<T, ActivityLogFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ActivityLogClient<$Result.GetResult<Prisma.$ActivityLogPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ActivityLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityLogFindFirstArgs} args - Arguments to find a ActivityLog
     * @example
     * // Get one ActivityLog
     * const activityLog = await prisma.activityLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ActivityLogFindFirstArgs>(args?: SelectSubset<T, ActivityLogFindFirstArgs<ExtArgs>>): Prisma__ActivityLogClient<$Result.GetResult<Prisma.$ActivityLogPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ActivityLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityLogFindFirstOrThrowArgs} args - Arguments to find a ActivityLog
     * @example
     * // Get one ActivityLog
     * const activityLog = await prisma.activityLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ActivityLogFindFirstOrThrowArgs>(args?: SelectSubset<T, ActivityLogFindFirstOrThrowArgs<ExtArgs>>): Prisma__ActivityLogClient<$Result.GetResult<Prisma.$ActivityLogPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ActivityLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ActivityLogs
     * const activityLogs = await prisma.activityLog.findMany()
     * 
     * // Get first 10 ActivityLogs
     * const activityLogs = await prisma.activityLog.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const activityLogWithIdOnly = await prisma.activityLog.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ActivityLogFindManyArgs>(args?: SelectSubset<T, ActivityLogFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ActivityLogPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ActivityLog.
     * @param {ActivityLogCreateArgs} args - Arguments to create a ActivityLog.
     * @example
     * // Create one ActivityLog
     * const ActivityLog = await prisma.activityLog.create({
     *   data: {
     *     // ... data to create a ActivityLog
     *   }
     * })
     * 
     */
    create<T extends ActivityLogCreateArgs>(args: SelectSubset<T, ActivityLogCreateArgs<ExtArgs>>): Prisma__ActivityLogClient<$Result.GetResult<Prisma.$ActivityLogPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ActivityLogs.
     * @param {ActivityLogCreateManyArgs} args - Arguments to create many ActivityLogs.
     * @example
     * // Create many ActivityLogs
     * const activityLog = await prisma.activityLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ActivityLogCreateManyArgs>(args?: SelectSubset<T, ActivityLogCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ActivityLogs and returns the data saved in the database.
     * @param {ActivityLogCreateManyAndReturnArgs} args - Arguments to create many ActivityLogs.
     * @example
     * // Create many ActivityLogs
     * const activityLog = await prisma.activityLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ActivityLogs and only return the `id`
     * const activityLogWithIdOnly = await prisma.activityLog.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ActivityLogCreateManyAndReturnArgs>(args?: SelectSubset<T, ActivityLogCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ActivityLogPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ActivityLog.
     * @param {ActivityLogDeleteArgs} args - Arguments to delete one ActivityLog.
     * @example
     * // Delete one ActivityLog
     * const ActivityLog = await prisma.activityLog.delete({
     *   where: {
     *     // ... filter to delete one ActivityLog
     *   }
     * })
     * 
     */
    delete<T extends ActivityLogDeleteArgs>(args: SelectSubset<T, ActivityLogDeleteArgs<ExtArgs>>): Prisma__ActivityLogClient<$Result.GetResult<Prisma.$ActivityLogPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ActivityLog.
     * @param {ActivityLogUpdateArgs} args - Arguments to update one ActivityLog.
     * @example
     * // Update one ActivityLog
     * const activityLog = await prisma.activityLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ActivityLogUpdateArgs>(args: SelectSubset<T, ActivityLogUpdateArgs<ExtArgs>>): Prisma__ActivityLogClient<$Result.GetResult<Prisma.$ActivityLogPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ActivityLogs.
     * @param {ActivityLogDeleteManyArgs} args - Arguments to filter ActivityLogs to delete.
     * @example
     * // Delete a few ActivityLogs
     * const { count } = await prisma.activityLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ActivityLogDeleteManyArgs>(args?: SelectSubset<T, ActivityLogDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ActivityLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ActivityLogs
     * const activityLog = await prisma.activityLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ActivityLogUpdateManyArgs>(args: SelectSubset<T, ActivityLogUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ActivityLogs and returns the data updated in the database.
     * @param {ActivityLogUpdateManyAndReturnArgs} args - Arguments to update many ActivityLogs.
     * @example
     * // Update many ActivityLogs
     * const activityLog = await prisma.activityLog.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ActivityLogs and only return the `id`
     * const activityLogWithIdOnly = await prisma.activityLog.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ActivityLogUpdateManyAndReturnArgs>(args: SelectSubset<T, ActivityLogUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ActivityLogPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ActivityLog.
     * @param {ActivityLogUpsertArgs} args - Arguments to update or create a ActivityLog.
     * @example
     * // Update or create a ActivityLog
     * const activityLog = await prisma.activityLog.upsert({
     *   create: {
     *     // ... data to create a ActivityLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ActivityLog we want to update
     *   }
     * })
     */
    upsert<T extends ActivityLogUpsertArgs>(args: SelectSubset<T, ActivityLogUpsertArgs<ExtArgs>>): Prisma__ActivityLogClient<$Result.GetResult<Prisma.$ActivityLogPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ActivityLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityLogCountArgs} args - Arguments to filter ActivityLogs to count.
     * @example
     * // Count the number of ActivityLogs
     * const count = await prisma.activityLog.count({
     *   where: {
     *     // ... the filter for the ActivityLogs we want to count
     *   }
     * })
    **/
    count<T extends ActivityLogCountArgs>(
      args?: Subset<T, ActivityLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ActivityLogCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ActivityLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ActivityLogAggregateArgs>(args: Subset<T, ActivityLogAggregateArgs>): Prisma.PrismaPromise<GetActivityLogAggregateType<T>>

    /**
     * Group by ActivityLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ActivityLogGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ActivityLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ActivityLogGroupByArgs['orderBy'] }
        : { orderBy?: ActivityLogGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ActivityLogGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetActivityLogGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ActivityLog model
   */
  readonly fields: ActivityLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ActivityLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ActivityLogClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    account<T extends ActivityLog$accountArgs<ExtArgs> = {}>(args?: Subset<T, ActivityLog$accountArgs<ExtArgs>>): Prisma__ClinicAccountClient<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    actor<T extends ActivityLog$actorArgs<ExtArgs> = {}>(args?: Subset<T, ActivityLog$actorArgs<ExtArgs>>): Prisma__ProviderUserClient<$Result.GetResult<Prisma.$ProviderUserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ActivityLog model
   */
  interface ActivityLogFieldRefs {
    readonly id: FieldRef<"ActivityLog", 'String'>
    readonly accountId: FieldRef<"ActivityLog", 'String'>
    readonly actorId: FieldRef<"ActivityLog", 'String'>
    readonly actorName: FieldRef<"ActivityLog", 'String'>
    readonly action: FieldRef<"ActivityLog", 'String'>
    readonly detail: FieldRef<"ActivityLog", 'String'>
    readonly applied: FieldRef<"ActivityLog", 'Boolean'>
    readonly at: FieldRef<"ActivityLog", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ActivityLog findUnique
   */
  export type ActivityLogFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogInclude<ExtArgs> | null
    /**
     * Filter, which ActivityLog to fetch.
     */
    where: ActivityLogWhereUniqueInput
  }

  /**
   * ActivityLog findUniqueOrThrow
   */
  export type ActivityLogFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogInclude<ExtArgs> | null
    /**
     * Filter, which ActivityLog to fetch.
     */
    where: ActivityLogWhereUniqueInput
  }

  /**
   * ActivityLog findFirst
   */
  export type ActivityLogFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogInclude<ExtArgs> | null
    /**
     * Filter, which ActivityLog to fetch.
     */
    where?: ActivityLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ActivityLogs to fetch.
     */
    orderBy?: ActivityLogOrderByWithRelationInput | ActivityLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ActivityLogs.
     */
    cursor?: ActivityLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ActivityLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ActivityLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ActivityLogs.
     */
    distinct?: ActivityLogScalarFieldEnum | ActivityLogScalarFieldEnum[]
  }

  /**
   * ActivityLog findFirstOrThrow
   */
  export type ActivityLogFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogInclude<ExtArgs> | null
    /**
     * Filter, which ActivityLog to fetch.
     */
    where?: ActivityLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ActivityLogs to fetch.
     */
    orderBy?: ActivityLogOrderByWithRelationInput | ActivityLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ActivityLogs.
     */
    cursor?: ActivityLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ActivityLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ActivityLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ActivityLogs.
     */
    distinct?: ActivityLogScalarFieldEnum | ActivityLogScalarFieldEnum[]
  }

  /**
   * ActivityLog findMany
   */
  export type ActivityLogFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogInclude<ExtArgs> | null
    /**
     * Filter, which ActivityLogs to fetch.
     */
    where?: ActivityLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ActivityLogs to fetch.
     */
    orderBy?: ActivityLogOrderByWithRelationInput | ActivityLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ActivityLogs.
     */
    cursor?: ActivityLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ActivityLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ActivityLogs.
     */
    skip?: number
    distinct?: ActivityLogScalarFieldEnum | ActivityLogScalarFieldEnum[]
  }

  /**
   * ActivityLog create
   */
  export type ActivityLogCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogInclude<ExtArgs> | null
    /**
     * The data needed to create a ActivityLog.
     */
    data: XOR<ActivityLogCreateInput, ActivityLogUncheckedCreateInput>
  }

  /**
   * ActivityLog createMany
   */
  export type ActivityLogCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ActivityLogs.
     */
    data: ActivityLogCreateManyInput | ActivityLogCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ActivityLog createManyAndReturn
   */
  export type ActivityLogCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * The data used to create many ActivityLogs.
     */
    data: ActivityLogCreateManyInput | ActivityLogCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ActivityLog update
   */
  export type ActivityLogUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogInclude<ExtArgs> | null
    /**
     * The data needed to update a ActivityLog.
     */
    data: XOR<ActivityLogUpdateInput, ActivityLogUncheckedUpdateInput>
    /**
     * Choose, which ActivityLog to update.
     */
    where: ActivityLogWhereUniqueInput
  }

  /**
   * ActivityLog updateMany
   */
  export type ActivityLogUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ActivityLogs.
     */
    data: XOR<ActivityLogUpdateManyMutationInput, ActivityLogUncheckedUpdateManyInput>
    /**
     * Filter which ActivityLogs to update
     */
    where?: ActivityLogWhereInput
    /**
     * Limit how many ActivityLogs to update.
     */
    limit?: number
  }

  /**
   * ActivityLog updateManyAndReturn
   */
  export type ActivityLogUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * The data used to update ActivityLogs.
     */
    data: XOR<ActivityLogUpdateManyMutationInput, ActivityLogUncheckedUpdateManyInput>
    /**
     * Filter which ActivityLogs to update
     */
    where?: ActivityLogWhereInput
    /**
     * Limit how many ActivityLogs to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ActivityLog upsert
   */
  export type ActivityLogUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogInclude<ExtArgs> | null
    /**
     * The filter to search for the ActivityLog to update in case it exists.
     */
    where: ActivityLogWhereUniqueInput
    /**
     * In case the ActivityLog found by the `where` argument doesn't exist, create a new ActivityLog with this data.
     */
    create: XOR<ActivityLogCreateInput, ActivityLogUncheckedCreateInput>
    /**
     * In case the ActivityLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ActivityLogUpdateInput, ActivityLogUncheckedUpdateInput>
  }

  /**
   * ActivityLog delete
   */
  export type ActivityLogDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogInclude<ExtArgs> | null
    /**
     * Filter which ActivityLog to delete.
     */
    where: ActivityLogWhereUniqueInput
  }

  /**
   * ActivityLog deleteMany
   */
  export type ActivityLogDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ActivityLogs to delete
     */
    where?: ActivityLogWhereInput
    /**
     * Limit how many ActivityLogs to delete.
     */
    limit?: number
  }

  /**
   * ActivityLog.account
   */
  export type ActivityLog$accountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ClinicAccount
     */
    select?: ClinicAccountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ClinicAccount
     */
    omit?: ClinicAccountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ClinicAccountInclude<ExtArgs> | null
    where?: ClinicAccountWhereInput
  }

  /**
   * ActivityLog.actor
   */
  export type ActivityLog$actorArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ProviderUser
     */
    select?: ProviderUserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ProviderUser
     */
    omit?: ProviderUserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ProviderUserInclude<ExtArgs> | null
    where?: ProviderUserWhereInput
  }

  /**
   * ActivityLog without action
   */
  export type ActivityLogDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ActivityLog
     */
    select?: ActivityLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ActivityLog
     */
    omit?: ActivityLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ActivityLogInclude<ExtArgs> | null
  }


  /**
   * Model HealthCheck
   */

  export type AggregateHealthCheck = {
    _count: HealthCheckCountAggregateOutputType | null
    _avg: HealthCheckAvgAggregateOutputType | null
    _sum: HealthCheckSumAggregateOutputType | null
    _min: HealthCheckMinAggregateOutputType | null
    _max: HealthCheckMaxAggregateOutputType | null
  }

  export type HealthCheckAvgAggregateOutputType = {
    statusCode: number | null
    latencyMs: number | null
  }

  export type HealthCheckSumAggregateOutputType = {
    statusCode: number | null
    latencyMs: number | null
  }

  export type HealthCheckMinAggregateOutputType = {
    id: string | null
    accountId: string | null
    ok: boolean | null
    statusCode: number | null
    latencyMs: number | null
    error: string | null
    checkedAt: Date | null
  }

  export type HealthCheckMaxAggregateOutputType = {
    id: string | null
    accountId: string | null
    ok: boolean | null
    statusCode: number | null
    latencyMs: number | null
    error: string | null
    checkedAt: Date | null
  }

  export type HealthCheckCountAggregateOutputType = {
    id: number
    accountId: number
    ok: number
    statusCode: number
    latencyMs: number
    error: number
    checkedAt: number
    _all: number
  }


  export type HealthCheckAvgAggregateInputType = {
    statusCode?: true
    latencyMs?: true
  }

  export type HealthCheckSumAggregateInputType = {
    statusCode?: true
    latencyMs?: true
  }

  export type HealthCheckMinAggregateInputType = {
    id?: true
    accountId?: true
    ok?: true
    statusCode?: true
    latencyMs?: true
    error?: true
    checkedAt?: true
  }

  export type HealthCheckMaxAggregateInputType = {
    id?: true
    accountId?: true
    ok?: true
    statusCode?: true
    latencyMs?: true
    error?: true
    checkedAt?: true
  }

  export type HealthCheckCountAggregateInputType = {
    id?: true
    accountId?: true
    ok?: true
    statusCode?: true
    latencyMs?: true
    error?: true
    checkedAt?: true
    _all?: true
  }

  export type HealthCheckAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which HealthCheck to aggregate.
     */
    where?: HealthCheckWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HealthChecks to fetch.
     */
    orderBy?: HealthCheckOrderByWithRelationInput | HealthCheckOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: HealthCheckWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HealthChecks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HealthChecks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned HealthChecks
    **/
    _count?: true | HealthCheckCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: HealthCheckAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: HealthCheckSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: HealthCheckMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: HealthCheckMaxAggregateInputType
  }

  export type GetHealthCheckAggregateType<T extends HealthCheckAggregateArgs> = {
        [P in keyof T & keyof AggregateHealthCheck]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateHealthCheck[P]>
      : GetScalarType<T[P], AggregateHealthCheck[P]>
  }




  export type HealthCheckGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: HealthCheckWhereInput
    orderBy?: HealthCheckOrderByWithAggregationInput | HealthCheckOrderByWithAggregationInput[]
    by: HealthCheckScalarFieldEnum[] | HealthCheckScalarFieldEnum
    having?: HealthCheckScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: HealthCheckCountAggregateInputType | true
    _avg?: HealthCheckAvgAggregateInputType
    _sum?: HealthCheckSumAggregateInputType
    _min?: HealthCheckMinAggregateInputType
    _max?: HealthCheckMaxAggregateInputType
  }

  export type HealthCheckGroupByOutputType = {
    id: string
    accountId: string
    ok: boolean
    statusCode: number | null
    latencyMs: number | null
    error: string | null
    checkedAt: Date
    _count: HealthCheckCountAggregateOutputType | null
    _avg: HealthCheckAvgAggregateOutputType | null
    _sum: HealthCheckSumAggregateOutputType | null
    _min: HealthCheckMinAggregateOutputType | null
    _max: HealthCheckMaxAggregateOutputType | null
  }

  type GetHealthCheckGroupByPayload<T extends HealthCheckGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<HealthCheckGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof HealthCheckGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], HealthCheckGroupByOutputType[P]>
            : GetScalarType<T[P], HealthCheckGroupByOutputType[P]>
        }
      >
    >


  export type HealthCheckSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    ok?: boolean
    statusCode?: boolean
    latencyMs?: boolean
    error?: boolean
    checkedAt?: boolean
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["healthCheck"]>

  export type HealthCheckSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    ok?: boolean
    statusCode?: boolean
    latencyMs?: boolean
    error?: boolean
    checkedAt?: boolean
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["healthCheck"]>

  export type HealthCheckSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    ok?: boolean
    statusCode?: boolean
    latencyMs?: boolean
    error?: boolean
    checkedAt?: boolean
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["healthCheck"]>

  export type HealthCheckSelectScalar = {
    id?: boolean
    accountId?: boolean
    ok?: boolean
    statusCode?: boolean
    latencyMs?: boolean
    error?: boolean
    checkedAt?: boolean
  }

  export type HealthCheckOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "accountId" | "ok" | "statusCode" | "latencyMs" | "error" | "checkedAt", ExtArgs["result"]["healthCheck"]>
  export type HealthCheckInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }
  export type HealthCheckIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }
  export type HealthCheckIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }

  export type $HealthCheckPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "HealthCheck"
    objects: {
      account: Prisma.$ClinicAccountPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      accountId: string
      ok: boolean
      statusCode: number | null
      latencyMs: number | null
      error: string | null
      checkedAt: Date
    }, ExtArgs["result"]["healthCheck"]>
    composites: {}
  }

  type HealthCheckGetPayload<S extends boolean | null | undefined | HealthCheckDefaultArgs> = $Result.GetResult<Prisma.$HealthCheckPayload, S>

  type HealthCheckCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<HealthCheckFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: HealthCheckCountAggregateInputType | true
    }

  export interface HealthCheckDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['HealthCheck'], meta: { name: 'HealthCheck' } }
    /**
     * Find zero or one HealthCheck that matches the filter.
     * @param {HealthCheckFindUniqueArgs} args - Arguments to find a HealthCheck
     * @example
     * // Get one HealthCheck
     * const healthCheck = await prisma.healthCheck.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends HealthCheckFindUniqueArgs>(args: SelectSubset<T, HealthCheckFindUniqueArgs<ExtArgs>>): Prisma__HealthCheckClient<$Result.GetResult<Prisma.$HealthCheckPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one HealthCheck that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {HealthCheckFindUniqueOrThrowArgs} args - Arguments to find a HealthCheck
     * @example
     * // Get one HealthCheck
     * const healthCheck = await prisma.healthCheck.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends HealthCheckFindUniqueOrThrowArgs>(args: SelectSubset<T, HealthCheckFindUniqueOrThrowArgs<ExtArgs>>): Prisma__HealthCheckClient<$Result.GetResult<Prisma.$HealthCheckPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first HealthCheck that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HealthCheckFindFirstArgs} args - Arguments to find a HealthCheck
     * @example
     * // Get one HealthCheck
     * const healthCheck = await prisma.healthCheck.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends HealthCheckFindFirstArgs>(args?: SelectSubset<T, HealthCheckFindFirstArgs<ExtArgs>>): Prisma__HealthCheckClient<$Result.GetResult<Prisma.$HealthCheckPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first HealthCheck that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HealthCheckFindFirstOrThrowArgs} args - Arguments to find a HealthCheck
     * @example
     * // Get one HealthCheck
     * const healthCheck = await prisma.healthCheck.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends HealthCheckFindFirstOrThrowArgs>(args?: SelectSubset<T, HealthCheckFindFirstOrThrowArgs<ExtArgs>>): Prisma__HealthCheckClient<$Result.GetResult<Prisma.$HealthCheckPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more HealthChecks that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HealthCheckFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all HealthChecks
     * const healthChecks = await prisma.healthCheck.findMany()
     * 
     * // Get first 10 HealthChecks
     * const healthChecks = await prisma.healthCheck.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const healthCheckWithIdOnly = await prisma.healthCheck.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends HealthCheckFindManyArgs>(args?: SelectSubset<T, HealthCheckFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HealthCheckPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a HealthCheck.
     * @param {HealthCheckCreateArgs} args - Arguments to create a HealthCheck.
     * @example
     * // Create one HealthCheck
     * const HealthCheck = await prisma.healthCheck.create({
     *   data: {
     *     // ... data to create a HealthCheck
     *   }
     * })
     * 
     */
    create<T extends HealthCheckCreateArgs>(args: SelectSubset<T, HealthCheckCreateArgs<ExtArgs>>): Prisma__HealthCheckClient<$Result.GetResult<Prisma.$HealthCheckPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many HealthChecks.
     * @param {HealthCheckCreateManyArgs} args - Arguments to create many HealthChecks.
     * @example
     * // Create many HealthChecks
     * const healthCheck = await prisma.healthCheck.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends HealthCheckCreateManyArgs>(args?: SelectSubset<T, HealthCheckCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many HealthChecks and returns the data saved in the database.
     * @param {HealthCheckCreateManyAndReturnArgs} args - Arguments to create many HealthChecks.
     * @example
     * // Create many HealthChecks
     * const healthCheck = await prisma.healthCheck.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many HealthChecks and only return the `id`
     * const healthCheckWithIdOnly = await prisma.healthCheck.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends HealthCheckCreateManyAndReturnArgs>(args?: SelectSubset<T, HealthCheckCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HealthCheckPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a HealthCheck.
     * @param {HealthCheckDeleteArgs} args - Arguments to delete one HealthCheck.
     * @example
     * // Delete one HealthCheck
     * const HealthCheck = await prisma.healthCheck.delete({
     *   where: {
     *     // ... filter to delete one HealthCheck
     *   }
     * })
     * 
     */
    delete<T extends HealthCheckDeleteArgs>(args: SelectSubset<T, HealthCheckDeleteArgs<ExtArgs>>): Prisma__HealthCheckClient<$Result.GetResult<Prisma.$HealthCheckPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one HealthCheck.
     * @param {HealthCheckUpdateArgs} args - Arguments to update one HealthCheck.
     * @example
     * // Update one HealthCheck
     * const healthCheck = await prisma.healthCheck.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends HealthCheckUpdateArgs>(args: SelectSubset<T, HealthCheckUpdateArgs<ExtArgs>>): Prisma__HealthCheckClient<$Result.GetResult<Prisma.$HealthCheckPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more HealthChecks.
     * @param {HealthCheckDeleteManyArgs} args - Arguments to filter HealthChecks to delete.
     * @example
     * // Delete a few HealthChecks
     * const { count } = await prisma.healthCheck.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends HealthCheckDeleteManyArgs>(args?: SelectSubset<T, HealthCheckDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more HealthChecks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HealthCheckUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many HealthChecks
     * const healthCheck = await prisma.healthCheck.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends HealthCheckUpdateManyArgs>(args: SelectSubset<T, HealthCheckUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more HealthChecks and returns the data updated in the database.
     * @param {HealthCheckUpdateManyAndReturnArgs} args - Arguments to update many HealthChecks.
     * @example
     * // Update many HealthChecks
     * const healthCheck = await prisma.healthCheck.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more HealthChecks and only return the `id`
     * const healthCheckWithIdOnly = await prisma.healthCheck.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends HealthCheckUpdateManyAndReturnArgs>(args: SelectSubset<T, HealthCheckUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$HealthCheckPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one HealthCheck.
     * @param {HealthCheckUpsertArgs} args - Arguments to update or create a HealthCheck.
     * @example
     * // Update or create a HealthCheck
     * const healthCheck = await prisma.healthCheck.upsert({
     *   create: {
     *     // ... data to create a HealthCheck
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the HealthCheck we want to update
     *   }
     * })
     */
    upsert<T extends HealthCheckUpsertArgs>(args: SelectSubset<T, HealthCheckUpsertArgs<ExtArgs>>): Prisma__HealthCheckClient<$Result.GetResult<Prisma.$HealthCheckPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of HealthChecks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HealthCheckCountArgs} args - Arguments to filter HealthChecks to count.
     * @example
     * // Count the number of HealthChecks
     * const count = await prisma.healthCheck.count({
     *   where: {
     *     // ... the filter for the HealthChecks we want to count
     *   }
     * })
    **/
    count<T extends HealthCheckCountArgs>(
      args?: Subset<T, HealthCheckCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], HealthCheckCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a HealthCheck.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HealthCheckAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends HealthCheckAggregateArgs>(args: Subset<T, HealthCheckAggregateArgs>): Prisma.PrismaPromise<GetHealthCheckAggregateType<T>>

    /**
     * Group by HealthCheck.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {HealthCheckGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends HealthCheckGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: HealthCheckGroupByArgs['orderBy'] }
        : { orderBy?: HealthCheckGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, HealthCheckGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetHealthCheckGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the HealthCheck model
   */
  readonly fields: HealthCheckFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for HealthCheck.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__HealthCheckClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    account<T extends ClinicAccountDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ClinicAccountDefaultArgs<ExtArgs>>): Prisma__ClinicAccountClient<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the HealthCheck model
   */
  interface HealthCheckFieldRefs {
    readonly id: FieldRef<"HealthCheck", 'String'>
    readonly accountId: FieldRef<"HealthCheck", 'String'>
    readonly ok: FieldRef<"HealthCheck", 'Boolean'>
    readonly statusCode: FieldRef<"HealthCheck", 'Int'>
    readonly latencyMs: FieldRef<"HealthCheck", 'Int'>
    readonly error: FieldRef<"HealthCheck", 'String'>
    readonly checkedAt: FieldRef<"HealthCheck", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * HealthCheck findUnique
   */
  export type HealthCheckFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HealthCheck
     */
    select?: HealthCheckSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HealthCheck
     */
    omit?: HealthCheckOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HealthCheckInclude<ExtArgs> | null
    /**
     * Filter, which HealthCheck to fetch.
     */
    where: HealthCheckWhereUniqueInput
  }

  /**
   * HealthCheck findUniqueOrThrow
   */
  export type HealthCheckFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HealthCheck
     */
    select?: HealthCheckSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HealthCheck
     */
    omit?: HealthCheckOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HealthCheckInclude<ExtArgs> | null
    /**
     * Filter, which HealthCheck to fetch.
     */
    where: HealthCheckWhereUniqueInput
  }

  /**
   * HealthCheck findFirst
   */
  export type HealthCheckFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HealthCheck
     */
    select?: HealthCheckSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HealthCheck
     */
    omit?: HealthCheckOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HealthCheckInclude<ExtArgs> | null
    /**
     * Filter, which HealthCheck to fetch.
     */
    where?: HealthCheckWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HealthChecks to fetch.
     */
    orderBy?: HealthCheckOrderByWithRelationInput | HealthCheckOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for HealthChecks.
     */
    cursor?: HealthCheckWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HealthChecks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HealthChecks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of HealthChecks.
     */
    distinct?: HealthCheckScalarFieldEnum | HealthCheckScalarFieldEnum[]
  }

  /**
   * HealthCheck findFirstOrThrow
   */
  export type HealthCheckFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HealthCheck
     */
    select?: HealthCheckSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HealthCheck
     */
    omit?: HealthCheckOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HealthCheckInclude<ExtArgs> | null
    /**
     * Filter, which HealthCheck to fetch.
     */
    where?: HealthCheckWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HealthChecks to fetch.
     */
    orderBy?: HealthCheckOrderByWithRelationInput | HealthCheckOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for HealthChecks.
     */
    cursor?: HealthCheckWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HealthChecks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HealthChecks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of HealthChecks.
     */
    distinct?: HealthCheckScalarFieldEnum | HealthCheckScalarFieldEnum[]
  }

  /**
   * HealthCheck findMany
   */
  export type HealthCheckFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HealthCheck
     */
    select?: HealthCheckSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HealthCheck
     */
    omit?: HealthCheckOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HealthCheckInclude<ExtArgs> | null
    /**
     * Filter, which HealthChecks to fetch.
     */
    where?: HealthCheckWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of HealthChecks to fetch.
     */
    orderBy?: HealthCheckOrderByWithRelationInput | HealthCheckOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing HealthChecks.
     */
    cursor?: HealthCheckWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` HealthChecks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` HealthChecks.
     */
    skip?: number
    distinct?: HealthCheckScalarFieldEnum | HealthCheckScalarFieldEnum[]
  }

  /**
   * HealthCheck create
   */
  export type HealthCheckCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HealthCheck
     */
    select?: HealthCheckSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HealthCheck
     */
    omit?: HealthCheckOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HealthCheckInclude<ExtArgs> | null
    /**
     * The data needed to create a HealthCheck.
     */
    data: XOR<HealthCheckCreateInput, HealthCheckUncheckedCreateInput>
  }

  /**
   * HealthCheck createMany
   */
  export type HealthCheckCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many HealthChecks.
     */
    data: HealthCheckCreateManyInput | HealthCheckCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * HealthCheck createManyAndReturn
   */
  export type HealthCheckCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HealthCheck
     */
    select?: HealthCheckSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the HealthCheck
     */
    omit?: HealthCheckOmit<ExtArgs> | null
    /**
     * The data used to create many HealthChecks.
     */
    data: HealthCheckCreateManyInput | HealthCheckCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HealthCheckIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * HealthCheck update
   */
  export type HealthCheckUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HealthCheck
     */
    select?: HealthCheckSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HealthCheck
     */
    omit?: HealthCheckOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HealthCheckInclude<ExtArgs> | null
    /**
     * The data needed to update a HealthCheck.
     */
    data: XOR<HealthCheckUpdateInput, HealthCheckUncheckedUpdateInput>
    /**
     * Choose, which HealthCheck to update.
     */
    where: HealthCheckWhereUniqueInput
  }

  /**
   * HealthCheck updateMany
   */
  export type HealthCheckUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update HealthChecks.
     */
    data: XOR<HealthCheckUpdateManyMutationInput, HealthCheckUncheckedUpdateManyInput>
    /**
     * Filter which HealthChecks to update
     */
    where?: HealthCheckWhereInput
    /**
     * Limit how many HealthChecks to update.
     */
    limit?: number
  }

  /**
   * HealthCheck updateManyAndReturn
   */
  export type HealthCheckUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HealthCheck
     */
    select?: HealthCheckSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the HealthCheck
     */
    omit?: HealthCheckOmit<ExtArgs> | null
    /**
     * The data used to update HealthChecks.
     */
    data: XOR<HealthCheckUpdateManyMutationInput, HealthCheckUncheckedUpdateManyInput>
    /**
     * Filter which HealthChecks to update
     */
    where?: HealthCheckWhereInput
    /**
     * Limit how many HealthChecks to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HealthCheckIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * HealthCheck upsert
   */
  export type HealthCheckUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HealthCheck
     */
    select?: HealthCheckSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HealthCheck
     */
    omit?: HealthCheckOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HealthCheckInclude<ExtArgs> | null
    /**
     * The filter to search for the HealthCheck to update in case it exists.
     */
    where: HealthCheckWhereUniqueInput
    /**
     * In case the HealthCheck found by the `where` argument doesn't exist, create a new HealthCheck with this data.
     */
    create: XOR<HealthCheckCreateInput, HealthCheckUncheckedCreateInput>
    /**
     * In case the HealthCheck was found with the provided `where` argument, update it with this data.
     */
    update: XOR<HealthCheckUpdateInput, HealthCheckUncheckedUpdateInput>
  }

  /**
   * HealthCheck delete
   */
  export type HealthCheckDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HealthCheck
     */
    select?: HealthCheckSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HealthCheck
     */
    omit?: HealthCheckOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HealthCheckInclude<ExtArgs> | null
    /**
     * Filter which HealthCheck to delete.
     */
    where: HealthCheckWhereUniqueInput
  }

  /**
   * HealthCheck deleteMany
   */
  export type HealthCheckDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which HealthChecks to delete
     */
    where?: HealthCheckWhereInput
    /**
     * Limit how many HealthChecks to delete.
     */
    limit?: number
  }

  /**
   * HealthCheck without action
   */
  export type HealthCheckDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the HealthCheck
     */
    select?: HealthCheckSelect<ExtArgs> | null
    /**
     * Omit specific fields from the HealthCheck
     */
    omit?: HealthCheckOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: HealthCheckInclude<ExtArgs> | null
  }


  /**
   * Model Invoice
   */

  export type AggregateInvoice = {
    _count: InvoiceCountAggregateOutputType | null
    _avg: InvoiceAvgAggregateOutputType | null
    _sum: InvoiceSumAggregateOutputType | null
    _min: InvoiceMinAggregateOutputType | null
    _max: InvoiceMaxAggregateOutputType | null
  }

  export type InvoiceAvgAggregateOutputType = {
    serial: number | null
    subtotal: Decimal | null
    cgst: Decimal | null
    sgst: Decimal | null
    igst: Decimal | null
    total: Decimal | null
  }

  export type InvoiceSumAggregateOutputType = {
    serial: number | null
    subtotal: Decimal | null
    cgst: Decimal | null
    sgst: Decimal | null
    igst: Decimal | null
    total: Decimal | null
  }

  export type InvoiceMinAggregateOutputType = {
    id: string | null
    accountId: string | null
    number: string | null
    fy: string | null
    serial: number | null
    status: $Enums.InvoiceStatus | null
    issuedAt: Date | null
    dueAt: Date | null
    periodStart: Date | null
    isFirst: boolean | null
    billingName: string | null
    billingAddress: string | null
    gstin: string | null
    placeOfSupply: string | null
    planLabel: string | null
    subtotal: Decimal | null
    cgst: Decimal | null
    sgst: Decimal | null
    igst: Decimal | null
    total: Decimal | null
    paidAt: Date | null
    paymentMode: string | null
    paymentRef: string | null
    notes: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type InvoiceMaxAggregateOutputType = {
    id: string | null
    accountId: string | null
    number: string | null
    fy: string | null
    serial: number | null
    status: $Enums.InvoiceStatus | null
    issuedAt: Date | null
    dueAt: Date | null
    periodStart: Date | null
    isFirst: boolean | null
    billingName: string | null
    billingAddress: string | null
    gstin: string | null
    placeOfSupply: string | null
    planLabel: string | null
    subtotal: Decimal | null
    cgst: Decimal | null
    sgst: Decimal | null
    igst: Decimal | null
    total: Decimal | null
    paidAt: Date | null
    paymentMode: string | null
    paymentRef: string | null
    notes: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type InvoiceCountAggregateOutputType = {
    id: number
    accountId: number
    number: number
    fy: number
    serial: number
    status: number
    issuedAt: number
    dueAt: number
    periodStart: number
    isFirst: number
    billingName: number
    billingAddress: number
    gstin: number
    placeOfSupply: number
    planLabel: number
    lines: number
    subtotal: number
    cgst: number
    sgst: number
    igst: number
    total: number
    paidAt: number
    paymentMode: number
    paymentRef: number
    notes: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type InvoiceAvgAggregateInputType = {
    serial?: true
    subtotal?: true
    cgst?: true
    sgst?: true
    igst?: true
    total?: true
  }

  export type InvoiceSumAggregateInputType = {
    serial?: true
    subtotal?: true
    cgst?: true
    sgst?: true
    igst?: true
    total?: true
  }

  export type InvoiceMinAggregateInputType = {
    id?: true
    accountId?: true
    number?: true
    fy?: true
    serial?: true
    status?: true
    issuedAt?: true
    dueAt?: true
    periodStart?: true
    isFirst?: true
    billingName?: true
    billingAddress?: true
    gstin?: true
    placeOfSupply?: true
    planLabel?: true
    subtotal?: true
    cgst?: true
    sgst?: true
    igst?: true
    total?: true
    paidAt?: true
    paymentMode?: true
    paymentRef?: true
    notes?: true
    createdAt?: true
    updatedAt?: true
  }

  export type InvoiceMaxAggregateInputType = {
    id?: true
    accountId?: true
    number?: true
    fy?: true
    serial?: true
    status?: true
    issuedAt?: true
    dueAt?: true
    periodStart?: true
    isFirst?: true
    billingName?: true
    billingAddress?: true
    gstin?: true
    placeOfSupply?: true
    planLabel?: true
    subtotal?: true
    cgst?: true
    sgst?: true
    igst?: true
    total?: true
    paidAt?: true
    paymentMode?: true
    paymentRef?: true
    notes?: true
    createdAt?: true
    updatedAt?: true
  }

  export type InvoiceCountAggregateInputType = {
    id?: true
    accountId?: true
    number?: true
    fy?: true
    serial?: true
    status?: true
    issuedAt?: true
    dueAt?: true
    periodStart?: true
    isFirst?: true
    billingName?: true
    billingAddress?: true
    gstin?: true
    placeOfSupply?: true
    planLabel?: true
    lines?: true
    subtotal?: true
    cgst?: true
    sgst?: true
    igst?: true
    total?: true
    paidAt?: true
    paymentMode?: true
    paymentRef?: true
    notes?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type InvoiceAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Invoice to aggregate.
     */
    where?: InvoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Invoices to fetch.
     */
    orderBy?: InvoiceOrderByWithRelationInput | InvoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: InvoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Invoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Invoices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Invoices
    **/
    _count?: true | InvoiceCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: InvoiceAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: InvoiceSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: InvoiceMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: InvoiceMaxAggregateInputType
  }

  export type GetInvoiceAggregateType<T extends InvoiceAggregateArgs> = {
        [P in keyof T & keyof AggregateInvoice]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateInvoice[P]>
      : GetScalarType<T[P], AggregateInvoice[P]>
  }




  export type InvoiceGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: InvoiceWhereInput
    orderBy?: InvoiceOrderByWithAggregationInput | InvoiceOrderByWithAggregationInput[]
    by: InvoiceScalarFieldEnum[] | InvoiceScalarFieldEnum
    having?: InvoiceScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: InvoiceCountAggregateInputType | true
    _avg?: InvoiceAvgAggregateInputType
    _sum?: InvoiceSumAggregateInputType
    _min?: InvoiceMinAggregateInputType
    _max?: InvoiceMaxAggregateInputType
  }

  export type InvoiceGroupByOutputType = {
    id: string
    accountId: string
    number: string | null
    fy: string | null
    serial: number | null
    status: $Enums.InvoiceStatus
    issuedAt: Date | null
    dueAt: Date | null
    periodStart: Date | null
    isFirst: boolean
    billingName: string | null
    billingAddress: string | null
    gstin: string | null
    placeOfSupply: string | null
    planLabel: string
    lines: JsonValue
    subtotal: Decimal
    cgst: Decimal
    sgst: Decimal
    igst: Decimal
    total: Decimal
    paidAt: Date | null
    paymentMode: string | null
    paymentRef: string | null
    notes: string | null
    createdAt: Date
    updatedAt: Date
    _count: InvoiceCountAggregateOutputType | null
    _avg: InvoiceAvgAggregateOutputType | null
    _sum: InvoiceSumAggregateOutputType | null
    _min: InvoiceMinAggregateOutputType | null
    _max: InvoiceMaxAggregateOutputType | null
  }

  type GetInvoiceGroupByPayload<T extends InvoiceGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<InvoiceGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof InvoiceGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], InvoiceGroupByOutputType[P]>
            : GetScalarType<T[P], InvoiceGroupByOutputType[P]>
        }
      >
    >


  export type InvoiceSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    number?: boolean
    fy?: boolean
    serial?: boolean
    status?: boolean
    issuedAt?: boolean
    dueAt?: boolean
    periodStart?: boolean
    isFirst?: boolean
    billingName?: boolean
    billingAddress?: boolean
    gstin?: boolean
    placeOfSupply?: boolean
    planLabel?: boolean
    lines?: boolean
    subtotal?: boolean
    cgst?: boolean
    sgst?: boolean
    igst?: boolean
    total?: boolean
    paidAt?: boolean
    paymentMode?: boolean
    paymentRef?: boolean
    notes?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["invoice"]>

  export type InvoiceSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    number?: boolean
    fy?: boolean
    serial?: boolean
    status?: boolean
    issuedAt?: boolean
    dueAt?: boolean
    periodStart?: boolean
    isFirst?: boolean
    billingName?: boolean
    billingAddress?: boolean
    gstin?: boolean
    placeOfSupply?: boolean
    planLabel?: boolean
    lines?: boolean
    subtotal?: boolean
    cgst?: boolean
    sgst?: boolean
    igst?: boolean
    total?: boolean
    paidAt?: boolean
    paymentMode?: boolean
    paymentRef?: boolean
    notes?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["invoice"]>

  export type InvoiceSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    number?: boolean
    fy?: boolean
    serial?: boolean
    status?: boolean
    issuedAt?: boolean
    dueAt?: boolean
    periodStart?: boolean
    isFirst?: boolean
    billingName?: boolean
    billingAddress?: boolean
    gstin?: boolean
    placeOfSupply?: boolean
    planLabel?: boolean
    lines?: boolean
    subtotal?: boolean
    cgst?: boolean
    sgst?: boolean
    igst?: boolean
    total?: boolean
    paidAt?: boolean
    paymentMode?: boolean
    paymentRef?: boolean
    notes?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["invoice"]>

  export type InvoiceSelectScalar = {
    id?: boolean
    accountId?: boolean
    number?: boolean
    fy?: boolean
    serial?: boolean
    status?: boolean
    issuedAt?: boolean
    dueAt?: boolean
    periodStart?: boolean
    isFirst?: boolean
    billingName?: boolean
    billingAddress?: boolean
    gstin?: boolean
    placeOfSupply?: boolean
    planLabel?: boolean
    lines?: boolean
    subtotal?: boolean
    cgst?: boolean
    sgst?: boolean
    igst?: boolean
    total?: boolean
    paidAt?: boolean
    paymentMode?: boolean
    paymentRef?: boolean
    notes?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type InvoiceOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "accountId" | "number" | "fy" | "serial" | "status" | "issuedAt" | "dueAt" | "periodStart" | "isFirst" | "billingName" | "billingAddress" | "gstin" | "placeOfSupply" | "planLabel" | "lines" | "subtotal" | "cgst" | "sgst" | "igst" | "total" | "paidAt" | "paymentMode" | "paymentRef" | "notes" | "createdAt" | "updatedAt", ExtArgs["result"]["invoice"]>
  export type InvoiceInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }
  export type InvoiceIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }
  export type InvoiceIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }

  export type $InvoicePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Invoice"
    objects: {
      account: Prisma.$ClinicAccountPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      accountId: string
      /**
       * PREFIX/FY/0001. Null while a draft; given on issue, consecutive
       * within the financial year, as GST requires.
       */
      number: string | null
      fy: string | null
      serial: number | null
      status: $Enums.InvoiceStatus
      issuedAt: Date | null
      dueAt: Date | null
      periodStart: Date | null
      /**
       * True for the invoice that starts the contract (carries setup/licence).
       */
      isFirst: boolean
      billingName: string | null
      billingAddress: string | null
      gstin: string | null
      placeOfSupply: string | null
      planLabel: string
      /**
       * [{ description, sac, amount }]
       */
      lines: Prisma.JsonValue
      subtotal: Prisma.Decimal
      cgst: Prisma.Decimal
      sgst: Prisma.Decimal
      igst: Prisma.Decimal
      total: Prisma.Decimal
      paidAt: Date | null
      paymentMode: string | null
      paymentRef: string | null
      notes: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["invoice"]>
    composites: {}
  }

  type InvoiceGetPayload<S extends boolean | null | undefined | InvoiceDefaultArgs> = $Result.GetResult<Prisma.$InvoicePayload, S>

  type InvoiceCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<InvoiceFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: InvoiceCountAggregateInputType | true
    }

  export interface InvoiceDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Invoice'], meta: { name: 'Invoice' } }
    /**
     * Find zero or one Invoice that matches the filter.
     * @param {InvoiceFindUniqueArgs} args - Arguments to find a Invoice
     * @example
     * // Get one Invoice
     * const invoice = await prisma.invoice.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends InvoiceFindUniqueArgs>(args: SelectSubset<T, InvoiceFindUniqueArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Invoice that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {InvoiceFindUniqueOrThrowArgs} args - Arguments to find a Invoice
     * @example
     * // Get one Invoice
     * const invoice = await prisma.invoice.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends InvoiceFindUniqueOrThrowArgs>(args: SelectSubset<T, InvoiceFindUniqueOrThrowArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Invoice that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceFindFirstArgs} args - Arguments to find a Invoice
     * @example
     * // Get one Invoice
     * const invoice = await prisma.invoice.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends InvoiceFindFirstArgs>(args?: SelectSubset<T, InvoiceFindFirstArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Invoice that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceFindFirstOrThrowArgs} args - Arguments to find a Invoice
     * @example
     * // Get one Invoice
     * const invoice = await prisma.invoice.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends InvoiceFindFirstOrThrowArgs>(args?: SelectSubset<T, InvoiceFindFirstOrThrowArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Invoices that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Invoices
     * const invoices = await prisma.invoice.findMany()
     * 
     * // Get first 10 Invoices
     * const invoices = await prisma.invoice.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const invoiceWithIdOnly = await prisma.invoice.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends InvoiceFindManyArgs>(args?: SelectSubset<T, InvoiceFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Invoice.
     * @param {InvoiceCreateArgs} args - Arguments to create a Invoice.
     * @example
     * // Create one Invoice
     * const Invoice = await prisma.invoice.create({
     *   data: {
     *     // ... data to create a Invoice
     *   }
     * })
     * 
     */
    create<T extends InvoiceCreateArgs>(args: SelectSubset<T, InvoiceCreateArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Invoices.
     * @param {InvoiceCreateManyArgs} args - Arguments to create many Invoices.
     * @example
     * // Create many Invoices
     * const invoice = await prisma.invoice.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends InvoiceCreateManyArgs>(args?: SelectSubset<T, InvoiceCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Invoices and returns the data saved in the database.
     * @param {InvoiceCreateManyAndReturnArgs} args - Arguments to create many Invoices.
     * @example
     * // Create many Invoices
     * const invoice = await prisma.invoice.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Invoices and only return the `id`
     * const invoiceWithIdOnly = await prisma.invoice.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends InvoiceCreateManyAndReturnArgs>(args?: SelectSubset<T, InvoiceCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Invoice.
     * @param {InvoiceDeleteArgs} args - Arguments to delete one Invoice.
     * @example
     * // Delete one Invoice
     * const Invoice = await prisma.invoice.delete({
     *   where: {
     *     // ... filter to delete one Invoice
     *   }
     * })
     * 
     */
    delete<T extends InvoiceDeleteArgs>(args: SelectSubset<T, InvoiceDeleteArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Invoice.
     * @param {InvoiceUpdateArgs} args - Arguments to update one Invoice.
     * @example
     * // Update one Invoice
     * const invoice = await prisma.invoice.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends InvoiceUpdateArgs>(args: SelectSubset<T, InvoiceUpdateArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Invoices.
     * @param {InvoiceDeleteManyArgs} args - Arguments to filter Invoices to delete.
     * @example
     * // Delete a few Invoices
     * const { count } = await prisma.invoice.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends InvoiceDeleteManyArgs>(args?: SelectSubset<T, InvoiceDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Invoices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Invoices
     * const invoice = await prisma.invoice.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends InvoiceUpdateManyArgs>(args: SelectSubset<T, InvoiceUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Invoices and returns the data updated in the database.
     * @param {InvoiceUpdateManyAndReturnArgs} args - Arguments to update many Invoices.
     * @example
     * // Update many Invoices
     * const invoice = await prisma.invoice.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Invoices and only return the `id`
     * const invoiceWithIdOnly = await prisma.invoice.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends InvoiceUpdateManyAndReturnArgs>(args: SelectSubset<T, InvoiceUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Invoice.
     * @param {InvoiceUpsertArgs} args - Arguments to update or create a Invoice.
     * @example
     * // Update or create a Invoice
     * const invoice = await prisma.invoice.upsert({
     *   create: {
     *     // ... data to create a Invoice
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Invoice we want to update
     *   }
     * })
     */
    upsert<T extends InvoiceUpsertArgs>(args: SelectSubset<T, InvoiceUpsertArgs<ExtArgs>>): Prisma__InvoiceClient<$Result.GetResult<Prisma.$InvoicePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Invoices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceCountArgs} args - Arguments to filter Invoices to count.
     * @example
     * // Count the number of Invoices
     * const count = await prisma.invoice.count({
     *   where: {
     *     // ... the filter for the Invoices we want to count
     *   }
     * })
    **/
    count<T extends InvoiceCountArgs>(
      args?: Subset<T, InvoiceCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], InvoiceCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Invoice.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends InvoiceAggregateArgs>(args: Subset<T, InvoiceAggregateArgs>): Prisma.PrismaPromise<GetInvoiceAggregateType<T>>

    /**
     * Group by Invoice.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends InvoiceGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: InvoiceGroupByArgs['orderBy'] }
        : { orderBy?: InvoiceGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, InvoiceGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetInvoiceGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Invoice model
   */
  readonly fields: InvoiceFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Invoice.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__InvoiceClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    account<T extends ClinicAccountDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ClinicAccountDefaultArgs<ExtArgs>>): Prisma__ClinicAccountClient<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Invoice model
   */
  interface InvoiceFieldRefs {
    readonly id: FieldRef<"Invoice", 'String'>
    readonly accountId: FieldRef<"Invoice", 'String'>
    readonly number: FieldRef<"Invoice", 'String'>
    readonly fy: FieldRef<"Invoice", 'String'>
    readonly serial: FieldRef<"Invoice", 'Int'>
    readonly status: FieldRef<"Invoice", 'InvoiceStatus'>
    readonly issuedAt: FieldRef<"Invoice", 'DateTime'>
    readonly dueAt: FieldRef<"Invoice", 'DateTime'>
    readonly periodStart: FieldRef<"Invoice", 'DateTime'>
    readonly isFirst: FieldRef<"Invoice", 'Boolean'>
    readonly billingName: FieldRef<"Invoice", 'String'>
    readonly billingAddress: FieldRef<"Invoice", 'String'>
    readonly gstin: FieldRef<"Invoice", 'String'>
    readonly placeOfSupply: FieldRef<"Invoice", 'String'>
    readonly planLabel: FieldRef<"Invoice", 'String'>
    readonly lines: FieldRef<"Invoice", 'Json'>
    readonly subtotal: FieldRef<"Invoice", 'Decimal'>
    readonly cgst: FieldRef<"Invoice", 'Decimal'>
    readonly sgst: FieldRef<"Invoice", 'Decimal'>
    readonly igst: FieldRef<"Invoice", 'Decimal'>
    readonly total: FieldRef<"Invoice", 'Decimal'>
    readonly paidAt: FieldRef<"Invoice", 'DateTime'>
    readonly paymentMode: FieldRef<"Invoice", 'String'>
    readonly paymentRef: FieldRef<"Invoice", 'String'>
    readonly notes: FieldRef<"Invoice", 'String'>
    readonly createdAt: FieldRef<"Invoice", 'DateTime'>
    readonly updatedAt: FieldRef<"Invoice", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Invoice findUnique
   */
  export type InvoiceFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * Filter, which Invoice to fetch.
     */
    where: InvoiceWhereUniqueInput
  }

  /**
   * Invoice findUniqueOrThrow
   */
  export type InvoiceFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * Filter, which Invoice to fetch.
     */
    where: InvoiceWhereUniqueInput
  }

  /**
   * Invoice findFirst
   */
  export type InvoiceFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * Filter, which Invoice to fetch.
     */
    where?: InvoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Invoices to fetch.
     */
    orderBy?: InvoiceOrderByWithRelationInput | InvoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Invoices.
     */
    cursor?: InvoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Invoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Invoices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Invoices.
     */
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[]
  }

  /**
   * Invoice findFirstOrThrow
   */
  export type InvoiceFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * Filter, which Invoice to fetch.
     */
    where?: InvoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Invoices to fetch.
     */
    orderBy?: InvoiceOrderByWithRelationInput | InvoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Invoices.
     */
    cursor?: InvoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Invoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Invoices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Invoices.
     */
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[]
  }

  /**
   * Invoice findMany
   */
  export type InvoiceFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * Filter, which Invoices to fetch.
     */
    where?: InvoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Invoices to fetch.
     */
    orderBy?: InvoiceOrderByWithRelationInput | InvoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Invoices.
     */
    cursor?: InvoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Invoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Invoices.
     */
    skip?: number
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[]
  }

  /**
   * Invoice create
   */
  export type InvoiceCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * The data needed to create a Invoice.
     */
    data: XOR<InvoiceCreateInput, InvoiceUncheckedCreateInput>
  }

  /**
   * Invoice createMany
   */
  export type InvoiceCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Invoices.
     */
    data: InvoiceCreateManyInput | InvoiceCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Invoice createManyAndReturn
   */
  export type InvoiceCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * The data used to create many Invoices.
     */
    data: InvoiceCreateManyInput | InvoiceCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Invoice update
   */
  export type InvoiceUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * The data needed to update a Invoice.
     */
    data: XOR<InvoiceUpdateInput, InvoiceUncheckedUpdateInput>
    /**
     * Choose, which Invoice to update.
     */
    where: InvoiceWhereUniqueInput
  }

  /**
   * Invoice updateMany
   */
  export type InvoiceUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Invoices.
     */
    data: XOR<InvoiceUpdateManyMutationInput, InvoiceUncheckedUpdateManyInput>
    /**
     * Filter which Invoices to update
     */
    where?: InvoiceWhereInput
    /**
     * Limit how many Invoices to update.
     */
    limit?: number
  }

  /**
   * Invoice updateManyAndReturn
   */
  export type InvoiceUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * The data used to update Invoices.
     */
    data: XOR<InvoiceUpdateManyMutationInput, InvoiceUncheckedUpdateManyInput>
    /**
     * Filter which Invoices to update
     */
    where?: InvoiceWhereInput
    /**
     * Limit how many Invoices to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Invoice upsert
   */
  export type InvoiceUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * The filter to search for the Invoice to update in case it exists.
     */
    where: InvoiceWhereUniqueInput
    /**
     * In case the Invoice found by the `where` argument doesn't exist, create a new Invoice with this data.
     */
    create: XOR<InvoiceCreateInput, InvoiceUncheckedCreateInput>
    /**
     * In case the Invoice was found with the provided `where` argument, update it with this data.
     */
    update: XOR<InvoiceUpdateInput, InvoiceUncheckedUpdateInput>
  }

  /**
   * Invoice delete
   */
  export type InvoiceDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
    /**
     * Filter which Invoice to delete.
     */
    where: InvoiceWhereUniqueInput
  }

  /**
   * Invoice deleteMany
   */
  export type InvoiceDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Invoices to delete
     */
    where?: InvoiceWhereInput
    /**
     * Limit how many Invoices to delete.
     */
    limit?: number
  }

  /**
   * Invoice without action
   */
  export type InvoiceDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Invoice
     */
    select?: InvoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Invoice
     */
    omit?: InvoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: InvoiceInclude<ExtArgs> | null
  }


  /**
   * Model PlanChange
   */

  export type AggregatePlanChange = {
    _count: PlanChangeCountAggregateOutputType | null
    _min: PlanChangeMinAggregateOutputType | null
    _max: PlanChangeMaxAggregateOutputType | null
  }

  export type PlanChangeMinAggregateOutputType = {
    id: string | null
    accountId: string | null
    fromPlan: $Enums.PlanTier | null
    toPlan: $Enums.PlanTier | null
    fromFeatures: string | null
    toFeatures: string | null
    readOnly: boolean | null
    reason: string | null
    actorName: string | null
    jobId: string | null
    at: Date | null
  }

  export type PlanChangeMaxAggregateOutputType = {
    id: string | null
    accountId: string | null
    fromPlan: $Enums.PlanTier | null
    toPlan: $Enums.PlanTier | null
    fromFeatures: string | null
    toFeatures: string | null
    readOnly: boolean | null
    reason: string | null
    actorName: string | null
    jobId: string | null
    at: Date | null
  }

  export type PlanChangeCountAggregateOutputType = {
    id: number
    accountId: number
    fromPlan: number
    toPlan: number
    fromFeatures: number
    toFeatures: number
    readOnly: number
    reason: number
    actorName: number
    jobId: number
    at: number
    _all: number
  }


  export type PlanChangeMinAggregateInputType = {
    id?: true
    accountId?: true
    fromPlan?: true
    toPlan?: true
    fromFeatures?: true
    toFeatures?: true
    readOnly?: true
    reason?: true
    actorName?: true
    jobId?: true
    at?: true
  }

  export type PlanChangeMaxAggregateInputType = {
    id?: true
    accountId?: true
    fromPlan?: true
    toPlan?: true
    fromFeatures?: true
    toFeatures?: true
    readOnly?: true
    reason?: true
    actorName?: true
    jobId?: true
    at?: true
  }

  export type PlanChangeCountAggregateInputType = {
    id?: true
    accountId?: true
    fromPlan?: true
    toPlan?: true
    fromFeatures?: true
    toFeatures?: true
    readOnly?: true
    reason?: true
    actorName?: true
    jobId?: true
    at?: true
    _all?: true
  }

  export type PlanChangeAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PlanChange to aggregate.
     */
    where?: PlanChangeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PlanChanges to fetch.
     */
    orderBy?: PlanChangeOrderByWithRelationInput | PlanChangeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: PlanChangeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PlanChanges from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PlanChanges.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned PlanChanges
    **/
    _count?: true | PlanChangeCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PlanChangeMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PlanChangeMaxAggregateInputType
  }

  export type GetPlanChangeAggregateType<T extends PlanChangeAggregateArgs> = {
        [P in keyof T & keyof AggregatePlanChange]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePlanChange[P]>
      : GetScalarType<T[P], AggregatePlanChange[P]>
  }




  export type PlanChangeGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PlanChangeWhereInput
    orderBy?: PlanChangeOrderByWithAggregationInput | PlanChangeOrderByWithAggregationInput[]
    by: PlanChangeScalarFieldEnum[] | PlanChangeScalarFieldEnum
    having?: PlanChangeScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PlanChangeCountAggregateInputType | true
    _min?: PlanChangeMinAggregateInputType
    _max?: PlanChangeMaxAggregateInputType
  }

  export type PlanChangeGroupByOutputType = {
    id: string
    accountId: string
    fromPlan: $Enums.PlanTier | null
    toPlan: $Enums.PlanTier
    fromFeatures: string | null
    toFeatures: string
    readOnly: boolean
    reason: string | null
    actorName: string
    jobId: string | null
    at: Date
    _count: PlanChangeCountAggregateOutputType | null
    _min: PlanChangeMinAggregateOutputType | null
    _max: PlanChangeMaxAggregateOutputType | null
  }

  type GetPlanChangeGroupByPayload<T extends PlanChangeGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PlanChangeGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PlanChangeGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PlanChangeGroupByOutputType[P]>
            : GetScalarType<T[P], PlanChangeGroupByOutputType[P]>
        }
      >
    >


  export type PlanChangeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    fromPlan?: boolean
    toPlan?: boolean
    fromFeatures?: boolean
    toFeatures?: boolean
    readOnly?: boolean
    reason?: boolean
    actorName?: boolean
    jobId?: boolean
    at?: boolean
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["planChange"]>

  export type PlanChangeSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    fromPlan?: boolean
    toPlan?: boolean
    fromFeatures?: boolean
    toFeatures?: boolean
    readOnly?: boolean
    reason?: boolean
    actorName?: boolean
    jobId?: boolean
    at?: boolean
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["planChange"]>

  export type PlanChangeSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    accountId?: boolean
    fromPlan?: boolean
    toPlan?: boolean
    fromFeatures?: boolean
    toFeatures?: boolean
    readOnly?: boolean
    reason?: boolean
    actorName?: boolean
    jobId?: boolean
    at?: boolean
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["planChange"]>

  export type PlanChangeSelectScalar = {
    id?: boolean
    accountId?: boolean
    fromPlan?: boolean
    toPlan?: boolean
    fromFeatures?: boolean
    toFeatures?: boolean
    readOnly?: boolean
    reason?: boolean
    actorName?: boolean
    jobId?: boolean
    at?: boolean
  }

  export type PlanChangeOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "accountId" | "fromPlan" | "toPlan" | "fromFeatures" | "toFeatures" | "readOnly" | "reason" | "actorName" | "jobId" | "at", ExtArgs["result"]["planChange"]>
  export type PlanChangeInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }
  export type PlanChangeIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }
  export type PlanChangeIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    account?: boolean | ClinicAccountDefaultArgs<ExtArgs>
  }

  export type $PlanChangePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "PlanChange"
    objects: {
      account: Prisma.$ClinicAccountPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      accountId: string
      fromPlan: $Enums.PlanTier | null
      toPlan: $Enums.PlanTier
      fromFeatures: string | null
      toFeatures: string
      readOnly: boolean
      reason: string | null
      actorName: string
      jobId: string | null
      at: Date
    }, ExtArgs["result"]["planChange"]>
    composites: {}
  }

  type PlanChangeGetPayload<S extends boolean | null | undefined | PlanChangeDefaultArgs> = $Result.GetResult<Prisma.$PlanChangePayload, S>

  type PlanChangeCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<PlanChangeFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PlanChangeCountAggregateInputType | true
    }

  export interface PlanChangeDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PlanChange'], meta: { name: 'PlanChange' } }
    /**
     * Find zero or one PlanChange that matches the filter.
     * @param {PlanChangeFindUniqueArgs} args - Arguments to find a PlanChange
     * @example
     * // Get one PlanChange
     * const planChange = await prisma.planChange.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PlanChangeFindUniqueArgs>(args: SelectSubset<T, PlanChangeFindUniqueArgs<ExtArgs>>): Prisma__PlanChangeClient<$Result.GetResult<Prisma.$PlanChangePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one PlanChange that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PlanChangeFindUniqueOrThrowArgs} args - Arguments to find a PlanChange
     * @example
     * // Get one PlanChange
     * const planChange = await prisma.planChange.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PlanChangeFindUniqueOrThrowArgs>(args: SelectSubset<T, PlanChangeFindUniqueOrThrowArgs<ExtArgs>>): Prisma__PlanChangeClient<$Result.GetResult<Prisma.$PlanChangePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PlanChange that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanChangeFindFirstArgs} args - Arguments to find a PlanChange
     * @example
     * // Get one PlanChange
     * const planChange = await prisma.planChange.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PlanChangeFindFirstArgs>(args?: SelectSubset<T, PlanChangeFindFirstArgs<ExtArgs>>): Prisma__PlanChangeClient<$Result.GetResult<Prisma.$PlanChangePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first PlanChange that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanChangeFindFirstOrThrowArgs} args - Arguments to find a PlanChange
     * @example
     * // Get one PlanChange
     * const planChange = await prisma.planChange.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PlanChangeFindFirstOrThrowArgs>(args?: SelectSubset<T, PlanChangeFindFirstOrThrowArgs<ExtArgs>>): Prisma__PlanChangeClient<$Result.GetResult<Prisma.$PlanChangePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more PlanChanges that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanChangeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PlanChanges
     * const planChanges = await prisma.planChange.findMany()
     * 
     * // Get first 10 PlanChanges
     * const planChanges = await prisma.planChange.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const planChangeWithIdOnly = await prisma.planChange.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends PlanChangeFindManyArgs>(args?: SelectSubset<T, PlanChangeFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PlanChangePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a PlanChange.
     * @param {PlanChangeCreateArgs} args - Arguments to create a PlanChange.
     * @example
     * // Create one PlanChange
     * const PlanChange = await prisma.planChange.create({
     *   data: {
     *     // ... data to create a PlanChange
     *   }
     * })
     * 
     */
    create<T extends PlanChangeCreateArgs>(args: SelectSubset<T, PlanChangeCreateArgs<ExtArgs>>): Prisma__PlanChangeClient<$Result.GetResult<Prisma.$PlanChangePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many PlanChanges.
     * @param {PlanChangeCreateManyArgs} args - Arguments to create many PlanChanges.
     * @example
     * // Create many PlanChanges
     * const planChange = await prisma.planChange.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends PlanChangeCreateManyArgs>(args?: SelectSubset<T, PlanChangeCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many PlanChanges and returns the data saved in the database.
     * @param {PlanChangeCreateManyAndReturnArgs} args - Arguments to create many PlanChanges.
     * @example
     * // Create many PlanChanges
     * const planChange = await prisma.planChange.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many PlanChanges and only return the `id`
     * const planChangeWithIdOnly = await prisma.planChange.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends PlanChangeCreateManyAndReturnArgs>(args?: SelectSubset<T, PlanChangeCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PlanChangePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a PlanChange.
     * @param {PlanChangeDeleteArgs} args - Arguments to delete one PlanChange.
     * @example
     * // Delete one PlanChange
     * const PlanChange = await prisma.planChange.delete({
     *   where: {
     *     // ... filter to delete one PlanChange
     *   }
     * })
     * 
     */
    delete<T extends PlanChangeDeleteArgs>(args: SelectSubset<T, PlanChangeDeleteArgs<ExtArgs>>): Prisma__PlanChangeClient<$Result.GetResult<Prisma.$PlanChangePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one PlanChange.
     * @param {PlanChangeUpdateArgs} args - Arguments to update one PlanChange.
     * @example
     * // Update one PlanChange
     * const planChange = await prisma.planChange.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends PlanChangeUpdateArgs>(args: SelectSubset<T, PlanChangeUpdateArgs<ExtArgs>>): Prisma__PlanChangeClient<$Result.GetResult<Prisma.$PlanChangePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more PlanChanges.
     * @param {PlanChangeDeleteManyArgs} args - Arguments to filter PlanChanges to delete.
     * @example
     * // Delete a few PlanChanges
     * const { count } = await prisma.planChange.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends PlanChangeDeleteManyArgs>(args?: SelectSubset<T, PlanChangeDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PlanChanges.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanChangeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PlanChanges
     * const planChange = await prisma.planChange.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends PlanChangeUpdateManyArgs>(args: SelectSubset<T, PlanChangeUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more PlanChanges and returns the data updated in the database.
     * @param {PlanChangeUpdateManyAndReturnArgs} args - Arguments to update many PlanChanges.
     * @example
     * // Update many PlanChanges
     * const planChange = await prisma.planChange.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more PlanChanges and only return the `id`
     * const planChangeWithIdOnly = await prisma.planChange.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends PlanChangeUpdateManyAndReturnArgs>(args: SelectSubset<T, PlanChangeUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PlanChangePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one PlanChange.
     * @param {PlanChangeUpsertArgs} args - Arguments to update or create a PlanChange.
     * @example
     * // Update or create a PlanChange
     * const planChange = await prisma.planChange.upsert({
     *   create: {
     *     // ... data to create a PlanChange
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PlanChange we want to update
     *   }
     * })
     */
    upsert<T extends PlanChangeUpsertArgs>(args: SelectSubset<T, PlanChangeUpsertArgs<ExtArgs>>): Prisma__PlanChangeClient<$Result.GetResult<Prisma.$PlanChangePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of PlanChanges.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanChangeCountArgs} args - Arguments to filter PlanChanges to count.
     * @example
     * // Count the number of PlanChanges
     * const count = await prisma.planChange.count({
     *   where: {
     *     // ... the filter for the PlanChanges we want to count
     *   }
     * })
    **/
    count<T extends PlanChangeCountArgs>(
      args?: Subset<T, PlanChangeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PlanChangeCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a PlanChange.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanChangeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends PlanChangeAggregateArgs>(args: Subset<T, PlanChangeAggregateArgs>): Prisma.PrismaPromise<GetPlanChangeAggregateType<T>>

    /**
     * Group by PlanChange.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlanChangeGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends PlanChangeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: PlanChangeGroupByArgs['orderBy'] }
        : { orderBy?: PlanChangeGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, PlanChangeGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPlanChangeGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the PlanChange model
   */
  readonly fields: PlanChangeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PlanChange.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PlanChangeClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    account<T extends ClinicAccountDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ClinicAccountDefaultArgs<ExtArgs>>): Prisma__ClinicAccountClient<$Result.GetResult<Prisma.$ClinicAccountPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the PlanChange model
   */
  interface PlanChangeFieldRefs {
    readonly id: FieldRef<"PlanChange", 'String'>
    readonly accountId: FieldRef<"PlanChange", 'String'>
    readonly fromPlan: FieldRef<"PlanChange", 'PlanTier'>
    readonly toPlan: FieldRef<"PlanChange", 'PlanTier'>
    readonly fromFeatures: FieldRef<"PlanChange", 'String'>
    readonly toFeatures: FieldRef<"PlanChange", 'String'>
    readonly readOnly: FieldRef<"PlanChange", 'Boolean'>
    readonly reason: FieldRef<"PlanChange", 'String'>
    readonly actorName: FieldRef<"PlanChange", 'String'>
    readonly jobId: FieldRef<"PlanChange", 'String'>
    readonly at: FieldRef<"PlanChange", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * PlanChange findUnique
   */
  export type PlanChangeFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlanChange
     */
    select?: PlanChangeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlanChange
     */
    omit?: PlanChangeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlanChangeInclude<ExtArgs> | null
    /**
     * Filter, which PlanChange to fetch.
     */
    where: PlanChangeWhereUniqueInput
  }

  /**
   * PlanChange findUniqueOrThrow
   */
  export type PlanChangeFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlanChange
     */
    select?: PlanChangeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlanChange
     */
    omit?: PlanChangeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlanChangeInclude<ExtArgs> | null
    /**
     * Filter, which PlanChange to fetch.
     */
    where: PlanChangeWhereUniqueInput
  }

  /**
   * PlanChange findFirst
   */
  export type PlanChangeFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlanChange
     */
    select?: PlanChangeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlanChange
     */
    omit?: PlanChangeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlanChangeInclude<ExtArgs> | null
    /**
     * Filter, which PlanChange to fetch.
     */
    where?: PlanChangeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PlanChanges to fetch.
     */
    orderBy?: PlanChangeOrderByWithRelationInput | PlanChangeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PlanChanges.
     */
    cursor?: PlanChangeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PlanChanges from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PlanChanges.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PlanChanges.
     */
    distinct?: PlanChangeScalarFieldEnum | PlanChangeScalarFieldEnum[]
  }

  /**
   * PlanChange findFirstOrThrow
   */
  export type PlanChangeFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlanChange
     */
    select?: PlanChangeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlanChange
     */
    omit?: PlanChangeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlanChangeInclude<ExtArgs> | null
    /**
     * Filter, which PlanChange to fetch.
     */
    where?: PlanChangeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PlanChanges to fetch.
     */
    orderBy?: PlanChangeOrderByWithRelationInput | PlanChangeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for PlanChanges.
     */
    cursor?: PlanChangeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PlanChanges from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PlanChanges.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of PlanChanges.
     */
    distinct?: PlanChangeScalarFieldEnum | PlanChangeScalarFieldEnum[]
  }

  /**
   * PlanChange findMany
   */
  export type PlanChangeFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlanChange
     */
    select?: PlanChangeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlanChange
     */
    omit?: PlanChangeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlanChangeInclude<ExtArgs> | null
    /**
     * Filter, which PlanChanges to fetch.
     */
    where?: PlanChangeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of PlanChanges to fetch.
     */
    orderBy?: PlanChangeOrderByWithRelationInput | PlanChangeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing PlanChanges.
     */
    cursor?: PlanChangeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` PlanChanges from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` PlanChanges.
     */
    skip?: number
    distinct?: PlanChangeScalarFieldEnum | PlanChangeScalarFieldEnum[]
  }

  /**
   * PlanChange create
   */
  export type PlanChangeCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlanChange
     */
    select?: PlanChangeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlanChange
     */
    omit?: PlanChangeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlanChangeInclude<ExtArgs> | null
    /**
     * The data needed to create a PlanChange.
     */
    data: XOR<PlanChangeCreateInput, PlanChangeUncheckedCreateInput>
  }

  /**
   * PlanChange createMany
   */
  export type PlanChangeCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PlanChanges.
     */
    data: PlanChangeCreateManyInput | PlanChangeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * PlanChange createManyAndReturn
   */
  export type PlanChangeCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlanChange
     */
    select?: PlanChangeSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PlanChange
     */
    omit?: PlanChangeOmit<ExtArgs> | null
    /**
     * The data used to create many PlanChanges.
     */
    data: PlanChangeCreateManyInput | PlanChangeCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlanChangeIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * PlanChange update
   */
  export type PlanChangeUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlanChange
     */
    select?: PlanChangeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlanChange
     */
    omit?: PlanChangeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlanChangeInclude<ExtArgs> | null
    /**
     * The data needed to update a PlanChange.
     */
    data: XOR<PlanChangeUpdateInput, PlanChangeUncheckedUpdateInput>
    /**
     * Choose, which PlanChange to update.
     */
    where: PlanChangeWhereUniqueInput
  }

  /**
   * PlanChange updateMany
   */
  export type PlanChangeUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PlanChanges.
     */
    data: XOR<PlanChangeUpdateManyMutationInput, PlanChangeUncheckedUpdateManyInput>
    /**
     * Filter which PlanChanges to update
     */
    where?: PlanChangeWhereInput
    /**
     * Limit how many PlanChanges to update.
     */
    limit?: number
  }

  /**
   * PlanChange updateManyAndReturn
   */
  export type PlanChangeUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlanChange
     */
    select?: PlanChangeSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the PlanChange
     */
    omit?: PlanChangeOmit<ExtArgs> | null
    /**
     * The data used to update PlanChanges.
     */
    data: XOR<PlanChangeUpdateManyMutationInput, PlanChangeUncheckedUpdateManyInput>
    /**
     * Filter which PlanChanges to update
     */
    where?: PlanChangeWhereInput
    /**
     * Limit how many PlanChanges to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlanChangeIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * PlanChange upsert
   */
  export type PlanChangeUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlanChange
     */
    select?: PlanChangeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlanChange
     */
    omit?: PlanChangeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlanChangeInclude<ExtArgs> | null
    /**
     * The filter to search for the PlanChange to update in case it exists.
     */
    where: PlanChangeWhereUniqueInput
    /**
     * In case the PlanChange found by the `where` argument doesn't exist, create a new PlanChange with this data.
     */
    create: XOR<PlanChangeCreateInput, PlanChangeUncheckedCreateInput>
    /**
     * In case the PlanChange was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PlanChangeUpdateInput, PlanChangeUncheckedUpdateInput>
  }

  /**
   * PlanChange delete
   */
  export type PlanChangeDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlanChange
     */
    select?: PlanChangeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlanChange
     */
    omit?: PlanChangeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlanChangeInclude<ExtArgs> | null
    /**
     * Filter which PlanChange to delete.
     */
    where: PlanChangeWhereUniqueInput
  }

  /**
   * PlanChange deleteMany
   */
  export type PlanChangeDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PlanChanges to delete
     */
    where?: PlanChangeWhereInput
    /**
     * Limit how many PlanChanges to delete.
     */
    limit?: number
  }

  /**
   * PlanChange without action
   */
  export type PlanChangeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlanChange
     */
    select?: PlanChangeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the PlanChange
     */
    omit?: PlanChangeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PlanChangeInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const ProviderUserScalarFieldEnum: {
    id: 'id',
    email: 'email',
    passwordHash: 'passwordHash',
    name: 'name',
    role: 'role',
    isActive: 'isActive',
    createdAt: 'createdAt'
  };

  export type ProviderUserScalarFieldEnum = (typeof ProviderUserScalarFieldEnum)[keyof typeof ProviderUserScalarFieldEnum]


  export const ClinicAccountScalarFieldEnum: {
    id: 'id',
    slug: 'slug',
    name: 'name',
    contactName: 'contactName',
    contactEmail: 'contactEmail',
    contactPhone: 'contactPhone',
    city: 'city',
    notes: 'notes',
    status: 'status',
    plan: 'plan',
    featureOverrides: 'featureOverrides',
    monthlyFee: 'monthlyFee',
    currency: 'currency',
    billingCycle: 'billingCycle',
    startedAt: 'startedAt',
    renewsAt: 'renewsAt',
    pricingModel: 'pricingModel',
    setupFee: 'setupFee',
    yearlyFee: 'yearlyFee',
    licenceFee: 'licenceFee',
    amcPercent: 'amcPercent',
    hostingFee: 'hostingFee',
    maxUsersOverride: 'maxUsersOverride',
    billingName: 'billingName',
    billingAddress: 'billingAddress',
    gstin: 'gstin',
    billingState: 'billingState',
    appliedPlan: 'appliedPlan',
    appliedFeatures: 'appliedFeatures',
    appliedReadOnly: 'appliedReadOnly',
    appliedAt: 'appliedAt',
    planJobId: 'planJobId',
    isDemo: 'isDemo',
    publicDomain: 'publicDomain',
    portalDomain: 'portalDomain',
    apiDomain: 'apiDomain',
    neonProjectId: 'neonProjectId',
    vercelWebProjectId: 'vercelWebProjectId',
    vercelApiProjectId: 'vercelApiProjectId',
    provisionedAt: 'provisionedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ClinicAccountScalarFieldEnum = (typeof ClinicAccountScalarFieldEnum)[keyof typeof ClinicAccountScalarFieldEnum]


  export const OnboardingStepScalarFieldEnum: {
    id: 'id',
    accountId: 'accountId',
    key: 'key',
    label: 'label',
    automated: 'automated',
    sortOrder: 'sortOrder',
    done: 'done',
    doneAt: 'doneAt',
    notes: 'notes'
  };

  export type OnboardingStepScalarFieldEnum = (typeof OnboardingStepScalarFieldEnum)[keyof typeof OnboardingStepScalarFieldEnum]


  export const ActivityLogScalarFieldEnum: {
    id: 'id',
    accountId: 'accountId',
    actorId: 'actorId',
    actorName: 'actorName',
    action: 'action',
    detail: 'detail',
    applied: 'applied',
    at: 'at'
  };

  export type ActivityLogScalarFieldEnum = (typeof ActivityLogScalarFieldEnum)[keyof typeof ActivityLogScalarFieldEnum]


  export const HealthCheckScalarFieldEnum: {
    id: 'id',
    accountId: 'accountId',
    ok: 'ok',
    statusCode: 'statusCode',
    latencyMs: 'latencyMs',
    error: 'error',
    checkedAt: 'checkedAt'
  };

  export type HealthCheckScalarFieldEnum = (typeof HealthCheckScalarFieldEnum)[keyof typeof HealthCheckScalarFieldEnum]


  export const InvoiceScalarFieldEnum: {
    id: 'id',
    accountId: 'accountId',
    number: 'number',
    fy: 'fy',
    serial: 'serial',
    status: 'status',
    issuedAt: 'issuedAt',
    dueAt: 'dueAt',
    periodStart: 'periodStart',
    isFirst: 'isFirst',
    billingName: 'billingName',
    billingAddress: 'billingAddress',
    gstin: 'gstin',
    placeOfSupply: 'placeOfSupply',
    planLabel: 'planLabel',
    lines: 'lines',
    subtotal: 'subtotal',
    cgst: 'cgst',
    sgst: 'sgst',
    igst: 'igst',
    total: 'total',
    paidAt: 'paidAt',
    paymentMode: 'paymentMode',
    paymentRef: 'paymentRef',
    notes: 'notes',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type InvoiceScalarFieldEnum = (typeof InvoiceScalarFieldEnum)[keyof typeof InvoiceScalarFieldEnum]


  export const PlanChangeScalarFieldEnum: {
    id: 'id',
    accountId: 'accountId',
    fromPlan: 'fromPlan',
    toPlan: 'toPlan',
    fromFeatures: 'fromFeatures',
    toFeatures: 'toFeatures',
    readOnly: 'readOnly',
    reason: 'reason',
    actorName: 'actorName',
    jobId: 'jobId',
    at: 'at'
  };

  export type PlanChangeScalarFieldEnum = (typeof PlanChangeScalarFieldEnum)[keyof typeof PlanChangeScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const JsonNullValueInput: {
    JsonNull: typeof JsonNull
  };

  export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'ProviderRole'
   */
  export type EnumProviderRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ProviderRole'>
    


  /**
   * Reference to a field of type 'ProviderRole[]'
   */
  export type ListEnumProviderRoleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ProviderRole[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'AccountStatus'
   */
  export type EnumAccountStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'AccountStatus'>
    


  /**
   * Reference to a field of type 'AccountStatus[]'
   */
  export type ListEnumAccountStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'AccountStatus[]'>
    


  /**
   * Reference to a field of type 'PlanTier'
   */
  export type EnumPlanTierFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PlanTier'>
    


  /**
   * Reference to a field of type 'PlanTier[]'
   */
  export type ListEnumPlanTierFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PlanTier[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    


  /**
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>
    


  /**
   * Reference to a field of type 'Decimal[]'
   */
  export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal[]'>
    


  /**
   * Reference to a field of type 'BillingCycle'
   */
  export type EnumBillingCycleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BillingCycle'>
    


  /**
   * Reference to a field of type 'BillingCycle[]'
   */
  export type ListEnumBillingCycleFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BillingCycle[]'>
    


  /**
   * Reference to a field of type 'PricingModel'
   */
  export type EnumPricingModelFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PricingModel'>
    


  /**
   * Reference to a field of type 'PricingModel[]'
   */
  export type ListEnumPricingModelFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'PricingModel[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'InvoiceStatus'
   */
  export type EnumInvoiceStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'InvoiceStatus'>
    


  /**
   * Reference to a field of type 'InvoiceStatus[]'
   */
  export type ListEnumInvoiceStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'InvoiceStatus[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type ProviderUserWhereInput = {
    AND?: ProviderUserWhereInput | ProviderUserWhereInput[]
    OR?: ProviderUserWhereInput[]
    NOT?: ProviderUserWhereInput | ProviderUserWhereInput[]
    id?: StringFilter<"ProviderUser"> | string
    email?: StringFilter<"ProviderUser"> | string
    passwordHash?: StringFilter<"ProviderUser"> | string
    name?: StringFilter<"ProviderUser"> | string
    role?: EnumProviderRoleFilter<"ProviderUser"> | $Enums.ProviderRole
    isActive?: BoolFilter<"ProviderUser"> | boolean
    createdAt?: DateTimeFilter<"ProviderUser"> | Date | string
    activity?: ActivityLogListRelationFilter
  }

  export type ProviderUserOrderByWithRelationInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    role?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    activity?: ActivityLogOrderByRelationAggregateInput
  }

  export type ProviderUserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    AND?: ProviderUserWhereInput | ProviderUserWhereInput[]
    OR?: ProviderUserWhereInput[]
    NOT?: ProviderUserWhereInput | ProviderUserWhereInput[]
    passwordHash?: StringFilter<"ProviderUser"> | string
    name?: StringFilter<"ProviderUser"> | string
    role?: EnumProviderRoleFilter<"ProviderUser"> | $Enums.ProviderRole
    isActive?: BoolFilter<"ProviderUser"> | boolean
    createdAt?: DateTimeFilter<"ProviderUser"> | Date | string
    activity?: ActivityLogListRelationFilter
  }, "id" | "email">

  export type ProviderUserOrderByWithAggregationInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    role?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
    _count?: ProviderUserCountOrderByAggregateInput
    _max?: ProviderUserMaxOrderByAggregateInput
    _min?: ProviderUserMinOrderByAggregateInput
  }

  export type ProviderUserScalarWhereWithAggregatesInput = {
    AND?: ProviderUserScalarWhereWithAggregatesInput | ProviderUserScalarWhereWithAggregatesInput[]
    OR?: ProviderUserScalarWhereWithAggregatesInput[]
    NOT?: ProviderUserScalarWhereWithAggregatesInput | ProviderUserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ProviderUser"> | string
    email?: StringWithAggregatesFilter<"ProviderUser"> | string
    passwordHash?: StringWithAggregatesFilter<"ProviderUser"> | string
    name?: StringWithAggregatesFilter<"ProviderUser"> | string
    role?: EnumProviderRoleWithAggregatesFilter<"ProviderUser"> | $Enums.ProviderRole
    isActive?: BoolWithAggregatesFilter<"ProviderUser"> | boolean
    createdAt?: DateTimeWithAggregatesFilter<"ProviderUser"> | Date | string
  }

  export type ClinicAccountWhereInput = {
    AND?: ClinicAccountWhereInput | ClinicAccountWhereInput[]
    OR?: ClinicAccountWhereInput[]
    NOT?: ClinicAccountWhereInput | ClinicAccountWhereInput[]
    id?: StringFilter<"ClinicAccount"> | string
    slug?: StringFilter<"ClinicAccount"> | string
    name?: StringFilter<"ClinicAccount"> | string
    contactName?: StringNullableFilter<"ClinicAccount"> | string | null
    contactEmail?: StringNullableFilter<"ClinicAccount"> | string | null
    contactPhone?: StringNullableFilter<"ClinicAccount"> | string | null
    city?: StringNullableFilter<"ClinicAccount"> | string | null
    notes?: StringNullableFilter<"ClinicAccount"> | string | null
    status?: EnumAccountStatusFilter<"ClinicAccount"> | $Enums.AccountStatus
    plan?: EnumPlanTierFilter<"ClinicAccount"> | $Enums.PlanTier
    featureOverrides?: JsonNullableFilter<"ClinicAccount">
    monthlyFee?: DecimalNullableFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    currency?: StringFilter<"ClinicAccount"> | string
    billingCycle?: EnumBillingCycleFilter<"ClinicAccount"> | $Enums.BillingCycle
    startedAt?: DateTimeNullableFilter<"ClinicAccount"> | Date | string | null
    renewsAt?: DateTimeNullableFilter<"ClinicAccount"> | Date | string | null
    pricingModel?: EnumPricingModelFilter<"ClinicAccount"> | $Enums.PricingModel
    setupFee?: DecimalNullableFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: DecimalNullableFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    licenceFee?: DecimalNullableFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    amcPercent?: DecimalNullableFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    hostingFee?: DecimalNullableFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: IntNullableFilter<"ClinicAccount"> | number | null
    billingName?: StringNullableFilter<"ClinicAccount"> | string | null
    billingAddress?: StringNullableFilter<"ClinicAccount"> | string | null
    gstin?: StringNullableFilter<"ClinicAccount"> | string | null
    billingState?: StringNullableFilter<"ClinicAccount"> | string | null
    appliedPlan?: EnumPlanTierNullableFilter<"ClinicAccount"> | $Enums.PlanTier | null
    appliedFeatures?: StringNullableFilter<"ClinicAccount"> | string | null
    appliedReadOnly?: BoolNullableFilter<"ClinicAccount"> | boolean | null
    appliedAt?: DateTimeNullableFilter<"ClinicAccount"> | Date | string | null
    planJobId?: StringNullableFilter<"ClinicAccount"> | string | null
    isDemo?: BoolFilter<"ClinicAccount"> | boolean
    publicDomain?: StringNullableFilter<"ClinicAccount"> | string | null
    portalDomain?: StringNullableFilter<"ClinicAccount"> | string | null
    apiDomain?: StringNullableFilter<"ClinicAccount"> | string | null
    neonProjectId?: StringNullableFilter<"ClinicAccount"> | string | null
    vercelWebProjectId?: StringNullableFilter<"ClinicAccount"> | string | null
    vercelApiProjectId?: StringNullableFilter<"ClinicAccount"> | string | null
    provisionedAt?: DateTimeNullableFilter<"ClinicAccount"> | Date | string | null
    createdAt?: DateTimeFilter<"ClinicAccount"> | Date | string
    updatedAt?: DateTimeFilter<"ClinicAccount"> | Date | string
    steps?: OnboardingStepListRelationFilter
    activity?: ActivityLogListRelationFilter
    health?: HealthCheckListRelationFilter
    invoices?: InvoiceListRelationFilter
    planChanges?: PlanChangeListRelationFilter
  }

  export type ClinicAccountOrderByWithRelationInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    contactName?: SortOrderInput | SortOrder
    contactEmail?: SortOrderInput | SortOrder
    contactPhone?: SortOrderInput | SortOrder
    city?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    status?: SortOrder
    plan?: SortOrder
    featureOverrides?: SortOrderInput | SortOrder
    monthlyFee?: SortOrderInput | SortOrder
    currency?: SortOrder
    billingCycle?: SortOrder
    startedAt?: SortOrderInput | SortOrder
    renewsAt?: SortOrderInput | SortOrder
    pricingModel?: SortOrder
    setupFee?: SortOrderInput | SortOrder
    yearlyFee?: SortOrderInput | SortOrder
    licenceFee?: SortOrderInput | SortOrder
    amcPercent?: SortOrderInput | SortOrder
    hostingFee?: SortOrderInput | SortOrder
    maxUsersOverride?: SortOrderInput | SortOrder
    billingName?: SortOrderInput | SortOrder
    billingAddress?: SortOrderInput | SortOrder
    gstin?: SortOrderInput | SortOrder
    billingState?: SortOrderInput | SortOrder
    appliedPlan?: SortOrderInput | SortOrder
    appliedFeatures?: SortOrderInput | SortOrder
    appliedReadOnly?: SortOrderInput | SortOrder
    appliedAt?: SortOrderInput | SortOrder
    planJobId?: SortOrderInput | SortOrder
    isDemo?: SortOrder
    publicDomain?: SortOrderInput | SortOrder
    portalDomain?: SortOrderInput | SortOrder
    apiDomain?: SortOrderInput | SortOrder
    neonProjectId?: SortOrderInput | SortOrder
    vercelWebProjectId?: SortOrderInput | SortOrder
    vercelApiProjectId?: SortOrderInput | SortOrder
    provisionedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    steps?: OnboardingStepOrderByRelationAggregateInput
    activity?: ActivityLogOrderByRelationAggregateInput
    health?: HealthCheckOrderByRelationAggregateInput
    invoices?: InvoiceOrderByRelationAggregateInput
    planChanges?: PlanChangeOrderByRelationAggregateInput
  }

  export type ClinicAccountWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    slug?: string
    AND?: ClinicAccountWhereInput | ClinicAccountWhereInput[]
    OR?: ClinicAccountWhereInput[]
    NOT?: ClinicAccountWhereInput | ClinicAccountWhereInput[]
    name?: StringFilter<"ClinicAccount"> | string
    contactName?: StringNullableFilter<"ClinicAccount"> | string | null
    contactEmail?: StringNullableFilter<"ClinicAccount"> | string | null
    contactPhone?: StringNullableFilter<"ClinicAccount"> | string | null
    city?: StringNullableFilter<"ClinicAccount"> | string | null
    notes?: StringNullableFilter<"ClinicAccount"> | string | null
    status?: EnumAccountStatusFilter<"ClinicAccount"> | $Enums.AccountStatus
    plan?: EnumPlanTierFilter<"ClinicAccount"> | $Enums.PlanTier
    featureOverrides?: JsonNullableFilter<"ClinicAccount">
    monthlyFee?: DecimalNullableFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    currency?: StringFilter<"ClinicAccount"> | string
    billingCycle?: EnumBillingCycleFilter<"ClinicAccount"> | $Enums.BillingCycle
    startedAt?: DateTimeNullableFilter<"ClinicAccount"> | Date | string | null
    renewsAt?: DateTimeNullableFilter<"ClinicAccount"> | Date | string | null
    pricingModel?: EnumPricingModelFilter<"ClinicAccount"> | $Enums.PricingModel
    setupFee?: DecimalNullableFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: DecimalNullableFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    licenceFee?: DecimalNullableFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    amcPercent?: DecimalNullableFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    hostingFee?: DecimalNullableFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: IntNullableFilter<"ClinicAccount"> | number | null
    billingName?: StringNullableFilter<"ClinicAccount"> | string | null
    billingAddress?: StringNullableFilter<"ClinicAccount"> | string | null
    gstin?: StringNullableFilter<"ClinicAccount"> | string | null
    billingState?: StringNullableFilter<"ClinicAccount"> | string | null
    appliedPlan?: EnumPlanTierNullableFilter<"ClinicAccount"> | $Enums.PlanTier | null
    appliedFeatures?: StringNullableFilter<"ClinicAccount"> | string | null
    appliedReadOnly?: BoolNullableFilter<"ClinicAccount"> | boolean | null
    appliedAt?: DateTimeNullableFilter<"ClinicAccount"> | Date | string | null
    planJobId?: StringNullableFilter<"ClinicAccount"> | string | null
    isDemo?: BoolFilter<"ClinicAccount"> | boolean
    publicDomain?: StringNullableFilter<"ClinicAccount"> | string | null
    portalDomain?: StringNullableFilter<"ClinicAccount"> | string | null
    apiDomain?: StringNullableFilter<"ClinicAccount"> | string | null
    neonProjectId?: StringNullableFilter<"ClinicAccount"> | string | null
    vercelWebProjectId?: StringNullableFilter<"ClinicAccount"> | string | null
    vercelApiProjectId?: StringNullableFilter<"ClinicAccount"> | string | null
    provisionedAt?: DateTimeNullableFilter<"ClinicAccount"> | Date | string | null
    createdAt?: DateTimeFilter<"ClinicAccount"> | Date | string
    updatedAt?: DateTimeFilter<"ClinicAccount"> | Date | string
    steps?: OnboardingStepListRelationFilter
    activity?: ActivityLogListRelationFilter
    health?: HealthCheckListRelationFilter
    invoices?: InvoiceListRelationFilter
    planChanges?: PlanChangeListRelationFilter
  }, "id" | "slug">

  export type ClinicAccountOrderByWithAggregationInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    contactName?: SortOrderInput | SortOrder
    contactEmail?: SortOrderInput | SortOrder
    contactPhone?: SortOrderInput | SortOrder
    city?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    status?: SortOrder
    plan?: SortOrder
    featureOverrides?: SortOrderInput | SortOrder
    monthlyFee?: SortOrderInput | SortOrder
    currency?: SortOrder
    billingCycle?: SortOrder
    startedAt?: SortOrderInput | SortOrder
    renewsAt?: SortOrderInput | SortOrder
    pricingModel?: SortOrder
    setupFee?: SortOrderInput | SortOrder
    yearlyFee?: SortOrderInput | SortOrder
    licenceFee?: SortOrderInput | SortOrder
    amcPercent?: SortOrderInput | SortOrder
    hostingFee?: SortOrderInput | SortOrder
    maxUsersOverride?: SortOrderInput | SortOrder
    billingName?: SortOrderInput | SortOrder
    billingAddress?: SortOrderInput | SortOrder
    gstin?: SortOrderInput | SortOrder
    billingState?: SortOrderInput | SortOrder
    appliedPlan?: SortOrderInput | SortOrder
    appliedFeatures?: SortOrderInput | SortOrder
    appliedReadOnly?: SortOrderInput | SortOrder
    appliedAt?: SortOrderInput | SortOrder
    planJobId?: SortOrderInput | SortOrder
    isDemo?: SortOrder
    publicDomain?: SortOrderInput | SortOrder
    portalDomain?: SortOrderInput | SortOrder
    apiDomain?: SortOrderInput | SortOrder
    neonProjectId?: SortOrderInput | SortOrder
    vercelWebProjectId?: SortOrderInput | SortOrder
    vercelApiProjectId?: SortOrderInput | SortOrder
    provisionedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ClinicAccountCountOrderByAggregateInput
    _avg?: ClinicAccountAvgOrderByAggregateInput
    _max?: ClinicAccountMaxOrderByAggregateInput
    _min?: ClinicAccountMinOrderByAggregateInput
    _sum?: ClinicAccountSumOrderByAggregateInput
  }

  export type ClinicAccountScalarWhereWithAggregatesInput = {
    AND?: ClinicAccountScalarWhereWithAggregatesInput | ClinicAccountScalarWhereWithAggregatesInput[]
    OR?: ClinicAccountScalarWhereWithAggregatesInput[]
    NOT?: ClinicAccountScalarWhereWithAggregatesInput | ClinicAccountScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ClinicAccount"> | string
    slug?: StringWithAggregatesFilter<"ClinicAccount"> | string
    name?: StringWithAggregatesFilter<"ClinicAccount"> | string
    contactName?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    contactEmail?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    contactPhone?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    city?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    notes?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    status?: EnumAccountStatusWithAggregatesFilter<"ClinicAccount"> | $Enums.AccountStatus
    plan?: EnumPlanTierWithAggregatesFilter<"ClinicAccount"> | $Enums.PlanTier
    featureOverrides?: JsonNullableWithAggregatesFilter<"ClinicAccount">
    monthlyFee?: DecimalNullableWithAggregatesFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    currency?: StringWithAggregatesFilter<"ClinicAccount"> | string
    billingCycle?: EnumBillingCycleWithAggregatesFilter<"ClinicAccount"> | $Enums.BillingCycle
    startedAt?: DateTimeNullableWithAggregatesFilter<"ClinicAccount"> | Date | string | null
    renewsAt?: DateTimeNullableWithAggregatesFilter<"ClinicAccount"> | Date | string | null
    pricingModel?: EnumPricingModelWithAggregatesFilter<"ClinicAccount"> | $Enums.PricingModel
    setupFee?: DecimalNullableWithAggregatesFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: DecimalNullableWithAggregatesFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    licenceFee?: DecimalNullableWithAggregatesFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    amcPercent?: DecimalNullableWithAggregatesFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    hostingFee?: DecimalNullableWithAggregatesFilter<"ClinicAccount"> | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: IntNullableWithAggregatesFilter<"ClinicAccount"> | number | null
    billingName?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    billingAddress?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    gstin?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    billingState?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    appliedPlan?: EnumPlanTierNullableWithAggregatesFilter<"ClinicAccount"> | $Enums.PlanTier | null
    appliedFeatures?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    appliedReadOnly?: BoolNullableWithAggregatesFilter<"ClinicAccount"> | boolean | null
    appliedAt?: DateTimeNullableWithAggregatesFilter<"ClinicAccount"> | Date | string | null
    planJobId?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    isDemo?: BoolWithAggregatesFilter<"ClinicAccount"> | boolean
    publicDomain?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    portalDomain?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    apiDomain?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    neonProjectId?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    vercelWebProjectId?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    vercelApiProjectId?: StringNullableWithAggregatesFilter<"ClinicAccount"> | string | null
    provisionedAt?: DateTimeNullableWithAggregatesFilter<"ClinicAccount"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"ClinicAccount"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ClinicAccount"> | Date | string
  }

  export type OnboardingStepWhereInput = {
    AND?: OnboardingStepWhereInput | OnboardingStepWhereInput[]
    OR?: OnboardingStepWhereInput[]
    NOT?: OnboardingStepWhereInput | OnboardingStepWhereInput[]
    id?: StringFilter<"OnboardingStep"> | string
    accountId?: StringFilter<"OnboardingStep"> | string
    key?: StringFilter<"OnboardingStep"> | string
    label?: StringFilter<"OnboardingStep"> | string
    automated?: BoolFilter<"OnboardingStep"> | boolean
    sortOrder?: IntFilter<"OnboardingStep"> | number
    done?: BoolFilter<"OnboardingStep"> | boolean
    doneAt?: DateTimeNullableFilter<"OnboardingStep"> | Date | string | null
    notes?: StringNullableFilter<"OnboardingStep"> | string | null
    account?: XOR<ClinicAccountScalarRelationFilter, ClinicAccountWhereInput>
  }

  export type OnboardingStepOrderByWithRelationInput = {
    id?: SortOrder
    accountId?: SortOrder
    key?: SortOrder
    label?: SortOrder
    automated?: SortOrder
    sortOrder?: SortOrder
    done?: SortOrder
    doneAt?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    account?: ClinicAccountOrderByWithRelationInput
  }

  export type OnboardingStepWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    accountId_key?: OnboardingStepAccountIdKeyCompoundUniqueInput
    AND?: OnboardingStepWhereInput | OnboardingStepWhereInput[]
    OR?: OnboardingStepWhereInput[]
    NOT?: OnboardingStepWhereInput | OnboardingStepWhereInput[]
    accountId?: StringFilter<"OnboardingStep"> | string
    key?: StringFilter<"OnboardingStep"> | string
    label?: StringFilter<"OnboardingStep"> | string
    automated?: BoolFilter<"OnboardingStep"> | boolean
    sortOrder?: IntFilter<"OnboardingStep"> | number
    done?: BoolFilter<"OnboardingStep"> | boolean
    doneAt?: DateTimeNullableFilter<"OnboardingStep"> | Date | string | null
    notes?: StringNullableFilter<"OnboardingStep"> | string | null
    account?: XOR<ClinicAccountScalarRelationFilter, ClinicAccountWhereInput>
  }, "id" | "accountId_key">

  export type OnboardingStepOrderByWithAggregationInput = {
    id?: SortOrder
    accountId?: SortOrder
    key?: SortOrder
    label?: SortOrder
    automated?: SortOrder
    sortOrder?: SortOrder
    done?: SortOrder
    doneAt?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    _count?: OnboardingStepCountOrderByAggregateInput
    _avg?: OnboardingStepAvgOrderByAggregateInput
    _max?: OnboardingStepMaxOrderByAggregateInput
    _min?: OnboardingStepMinOrderByAggregateInput
    _sum?: OnboardingStepSumOrderByAggregateInput
  }

  export type OnboardingStepScalarWhereWithAggregatesInput = {
    AND?: OnboardingStepScalarWhereWithAggregatesInput | OnboardingStepScalarWhereWithAggregatesInput[]
    OR?: OnboardingStepScalarWhereWithAggregatesInput[]
    NOT?: OnboardingStepScalarWhereWithAggregatesInput | OnboardingStepScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"OnboardingStep"> | string
    accountId?: StringWithAggregatesFilter<"OnboardingStep"> | string
    key?: StringWithAggregatesFilter<"OnboardingStep"> | string
    label?: StringWithAggregatesFilter<"OnboardingStep"> | string
    automated?: BoolWithAggregatesFilter<"OnboardingStep"> | boolean
    sortOrder?: IntWithAggregatesFilter<"OnboardingStep"> | number
    done?: BoolWithAggregatesFilter<"OnboardingStep"> | boolean
    doneAt?: DateTimeNullableWithAggregatesFilter<"OnboardingStep"> | Date | string | null
    notes?: StringNullableWithAggregatesFilter<"OnboardingStep"> | string | null
  }

  export type ActivityLogWhereInput = {
    AND?: ActivityLogWhereInput | ActivityLogWhereInput[]
    OR?: ActivityLogWhereInput[]
    NOT?: ActivityLogWhereInput | ActivityLogWhereInput[]
    id?: StringFilter<"ActivityLog"> | string
    accountId?: StringNullableFilter<"ActivityLog"> | string | null
    actorId?: StringNullableFilter<"ActivityLog"> | string | null
    actorName?: StringFilter<"ActivityLog"> | string
    action?: StringFilter<"ActivityLog"> | string
    detail?: StringNullableFilter<"ActivityLog"> | string | null
    applied?: BoolFilter<"ActivityLog"> | boolean
    at?: DateTimeFilter<"ActivityLog"> | Date | string
    account?: XOR<ClinicAccountNullableScalarRelationFilter, ClinicAccountWhereInput> | null
    actor?: XOR<ProviderUserNullableScalarRelationFilter, ProviderUserWhereInput> | null
  }

  export type ActivityLogOrderByWithRelationInput = {
    id?: SortOrder
    accountId?: SortOrderInput | SortOrder
    actorId?: SortOrderInput | SortOrder
    actorName?: SortOrder
    action?: SortOrder
    detail?: SortOrderInput | SortOrder
    applied?: SortOrder
    at?: SortOrder
    account?: ClinicAccountOrderByWithRelationInput
    actor?: ProviderUserOrderByWithRelationInput
  }

  export type ActivityLogWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ActivityLogWhereInput | ActivityLogWhereInput[]
    OR?: ActivityLogWhereInput[]
    NOT?: ActivityLogWhereInput | ActivityLogWhereInput[]
    accountId?: StringNullableFilter<"ActivityLog"> | string | null
    actorId?: StringNullableFilter<"ActivityLog"> | string | null
    actorName?: StringFilter<"ActivityLog"> | string
    action?: StringFilter<"ActivityLog"> | string
    detail?: StringNullableFilter<"ActivityLog"> | string | null
    applied?: BoolFilter<"ActivityLog"> | boolean
    at?: DateTimeFilter<"ActivityLog"> | Date | string
    account?: XOR<ClinicAccountNullableScalarRelationFilter, ClinicAccountWhereInput> | null
    actor?: XOR<ProviderUserNullableScalarRelationFilter, ProviderUserWhereInput> | null
  }, "id">

  export type ActivityLogOrderByWithAggregationInput = {
    id?: SortOrder
    accountId?: SortOrderInput | SortOrder
    actorId?: SortOrderInput | SortOrder
    actorName?: SortOrder
    action?: SortOrder
    detail?: SortOrderInput | SortOrder
    applied?: SortOrder
    at?: SortOrder
    _count?: ActivityLogCountOrderByAggregateInput
    _max?: ActivityLogMaxOrderByAggregateInput
    _min?: ActivityLogMinOrderByAggregateInput
  }

  export type ActivityLogScalarWhereWithAggregatesInput = {
    AND?: ActivityLogScalarWhereWithAggregatesInput | ActivityLogScalarWhereWithAggregatesInput[]
    OR?: ActivityLogScalarWhereWithAggregatesInput[]
    NOT?: ActivityLogScalarWhereWithAggregatesInput | ActivityLogScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ActivityLog"> | string
    accountId?: StringNullableWithAggregatesFilter<"ActivityLog"> | string | null
    actorId?: StringNullableWithAggregatesFilter<"ActivityLog"> | string | null
    actorName?: StringWithAggregatesFilter<"ActivityLog"> | string
    action?: StringWithAggregatesFilter<"ActivityLog"> | string
    detail?: StringNullableWithAggregatesFilter<"ActivityLog"> | string | null
    applied?: BoolWithAggregatesFilter<"ActivityLog"> | boolean
    at?: DateTimeWithAggregatesFilter<"ActivityLog"> | Date | string
  }

  export type HealthCheckWhereInput = {
    AND?: HealthCheckWhereInput | HealthCheckWhereInput[]
    OR?: HealthCheckWhereInput[]
    NOT?: HealthCheckWhereInput | HealthCheckWhereInput[]
    id?: StringFilter<"HealthCheck"> | string
    accountId?: StringFilter<"HealthCheck"> | string
    ok?: BoolFilter<"HealthCheck"> | boolean
    statusCode?: IntNullableFilter<"HealthCheck"> | number | null
    latencyMs?: IntNullableFilter<"HealthCheck"> | number | null
    error?: StringNullableFilter<"HealthCheck"> | string | null
    checkedAt?: DateTimeFilter<"HealthCheck"> | Date | string
    account?: XOR<ClinicAccountScalarRelationFilter, ClinicAccountWhereInput>
  }

  export type HealthCheckOrderByWithRelationInput = {
    id?: SortOrder
    accountId?: SortOrder
    ok?: SortOrder
    statusCode?: SortOrderInput | SortOrder
    latencyMs?: SortOrderInput | SortOrder
    error?: SortOrderInput | SortOrder
    checkedAt?: SortOrder
    account?: ClinicAccountOrderByWithRelationInput
  }

  export type HealthCheckWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: HealthCheckWhereInput | HealthCheckWhereInput[]
    OR?: HealthCheckWhereInput[]
    NOT?: HealthCheckWhereInput | HealthCheckWhereInput[]
    accountId?: StringFilter<"HealthCheck"> | string
    ok?: BoolFilter<"HealthCheck"> | boolean
    statusCode?: IntNullableFilter<"HealthCheck"> | number | null
    latencyMs?: IntNullableFilter<"HealthCheck"> | number | null
    error?: StringNullableFilter<"HealthCheck"> | string | null
    checkedAt?: DateTimeFilter<"HealthCheck"> | Date | string
    account?: XOR<ClinicAccountScalarRelationFilter, ClinicAccountWhereInput>
  }, "id">

  export type HealthCheckOrderByWithAggregationInput = {
    id?: SortOrder
    accountId?: SortOrder
    ok?: SortOrder
    statusCode?: SortOrderInput | SortOrder
    latencyMs?: SortOrderInput | SortOrder
    error?: SortOrderInput | SortOrder
    checkedAt?: SortOrder
    _count?: HealthCheckCountOrderByAggregateInput
    _avg?: HealthCheckAvgOrderByAggregateInput
    _max?: HealthCheckMaxOrderByAggregateInput
    _min?: HealthCheckMinOrderByAggregateInput
    _sum?: HealthCheckSumOrderByAggregateInput
  }

  export type HealthCheckScalarWhereWithAggregatesInput = {
    AND?: HealthCheckScalarWhereWithAggregatesInput | HealthCheckScalarWhereWithAggregatesInput[]
    OR?: HealthCheckScalarWhereWithAggregatesInput[]
    NOT?: HealthCheckScalarWhereWithAggregatesInput | HealthCheckScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"HealthCheck"> | string
    accountId?: StringWithAggregatesFilter<"HealthCheck"> | string
    ok?: BoolWithAggregatesFilter<"HealthCheck"> | boolean
    statusCode?: IntNullableWithAggregatesFilter<"HealthCheck"> | number | null
    latencyMs?: IntNullableWithAggregatesFilter<"HealthCheck"> | number | null
    error?: StringNullableWithAggregatesFilter<"HealthCheck"> | string | null
    checkedAt?: DateTimeWithAggregatesFilter<"HealthCheck"> | Date | string
  }

  export type InvoiceWhereInput = {
    AND?: InvoiceWhereInput | InvoiceWhereInput[]
    OR?: InvoiceWhereInput[]
    NOT?: InvoiceWhereInput | InvoiceWhereInput[]
    id?: StringFilter<"Invoice"> | string
    accountId?: StringFilter<"Invoice"> | string
    number?: StringNullableFilter<"Invoice"> | string | null
    fy?: StringNullableFilter<"Invoice"> | string | null
    serial?: IntNullableFilter<"Invoice"> | number | null
    status?: EnumInvoiceStatusFilter<"Invoice"> | $Enums.InvoiceStatus
    issuedAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    dueAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    periodStart?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    isFirst?: BoolFilter<"Invoice"> | boolean
    billingName?: StringNullableFilter<"Invoice"> | string | null
    billingAddress?: StringNullableFilter<"Invoice"> | string | null
    gstin?: StringNullableFilter<"Invoice"> | string | null
    placeOfSupply?: StringNullableFilter<"Invoice"> | string | null
    planLabel?: StringFilter<"Invoice"> | string
    lines?: JsonFilter<"Invoice">
    subtotal?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    cgst?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    sgst?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    igst?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    total?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    paidAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    paymentMode?: StringNullableFilter<"Invoice"> | string | null
    paymentRef?: StringNullableFilter<"Invoice"> | string | null
    notes?: StringNullableFilter<"Invoice"> | string | null
    createdAt?: DateTimeFilter<"Invoice"> | Date | string
    updatedAt?: DateTimeFilter<"Invoice"> | Date | string
    account?: XOR<ClinicAccountScalarRelationFilter, ClinicAccountWhereInput>
  }

  export type InvoiceOrderByWithRelationInput = {
    id?: SortOrder
    accountId?: SortOrder
    number?: SortOrderInput | SortOrder
    fy?: SortOrderInput | SortOrder
    serial?: SortOrderInput | SortOrder
    status?: SortOrder
    issuedAt?: SortOrderInput | SortOrder
    dueAt?: SortOrderInput | SortOrder
    periodStart?: SortOrderInput | SortOrder
    isFirst?: SortOrder
    billingName?: SortOrderInput | SortOrder
    billingAddress?: SortOrderInput | SortOrder
    gstin?: SortOrderInput | SortOrder
    placeOfSupply?: SortOrderInput | SortOrder
    planLabel?: SortOrder
    lines?: SortOrder
    subtotal?: SortOrder
    cgst?: SortOrder
    sgst?: SortOrder
    igst?: SortOrder
    total?: SortOrder
    paidAt?: SortOrderInput | SortOrder
    paymentMode?: SortOrderInput | SortOrder
    paymentRef?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    account?: ClinicAccountOrderByWithRelationInput
  }

  export type InvoiceWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    number?: string
    fy_serial?: InvoiceFySerialCompoundUniqueInput
    AND?: InvoiceWhereInput | InvoiceWhereInput[]
    OR?: InvoiceWhereInput[]
    NOT?: InvoiceWhereInput | InvoiceWhereInput[]
    accountId?: StringFilter<"Invoice"> | string
    fy?: StringNullableFilter<"Invoice"> | string | null
    serial?: IntNullableFilter<"Invoice"> | number | null
    status?: EnumInvoiceStatusFilter<"Invoice"> | $Enums.InvoiceStatus
    issuedAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    dueAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    periodStart?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    isFirst?: BoolFilter<"Invoice"> | boolean
    billingName?: StringNullableFilter<"Invoice"> | string | null
    billingAddress?: StringNullableFilter<"Invoice"> | string | null
    gstin?: StringNullableFilter<"Invoice"> | string | null
    placeOfSupply?: StringNullableFilter<"Invoice"> | string | null
    planLabel?: StringFilter<"Invoice"> | string
    lines?: JsonFilter<"Invoice">
    subtotal?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    cgst?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    sgst?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    igst?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    total?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    paidAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    paymentMode?: StringNullableFilter<"Invoice"> | string | null
    paymentRef?: StringNullableFilter<"Invoice"> | string | null
    notes?: StringNullableFilter<"Invoice"> | string | null
    createdAt?: DateTimeFilter<"Invoice"> | Date | string
    updatedAt?: DateTimeFilter<"Invoice"> | Date | string
    account?: XOR<ClinicAccountScalarRelationFilter, ClinicAccountWhereInput>
  }, "id" | "number" | "fy_serial">

  export type InvoiceOrderByWithAggregationInput = {
    id?: SortOrder
    accountId?: SortOrder
    number?: SortOrderInput | SortOrder
    fy?: SortOrderInput | SortOrder
    serial?: SortOrderInput | SortOrder
    status?: SortOrder
    issuedAt?: SortOrderInput | SortOrder
    dueAt?: SortOrderInput | SortOrder
    periodStart?: SortOrderInput | SortOrder
    isFirst?: SortOrder
    billingName?: SortOrderInput | SortOrder
    billingAddress?: SortOrderInput | SortOrder
    gstin?: SortOrderInput | SortOrder
    placeOfSupply?: SortOrderInput | SortOrder
    planLabel?: SortOrder
    lines?: SortOrder
    subtotal?: SortOrder
    cgst?: SortOrder
    sgst?: SortOrder
    igst?: SortOrder
    total?: SortOrder
    paidAt?: SortOrderInput | SortOrder
    paymentMode?: SortOrderInput | SortOrder
    paymentRef?: SortOrderInput | SortOrder
    notes?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: InvoiceCountOrderByAggregateInput
    _avg?: InvoiceAvgOrderByAggregateInput
    _max?: InvoiceMaxOrderByAggregateInput
    _min?: InvoiceMinOrderByAggregateInput
    _sum?: InvoiceSumOrderByAggregateInput
  }

  export type InvoiceScalarWhereWithAggregatesInput = {
    AND?: InvoiceScalarWhereWithAggregatesInput | InvoiceScalarWhereWithAggregatesInput[]
    OR?: InvoiceScalarWhereWithAggregatesInput[]
    NOT?: InvoiceScalarWhereWithAggregatesInput | InvoiceScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Invoice"> | string
    accountId?: StringWithAggregatesFilter<"Invoice"> | string
    number?: StringNullableWithAggregatesFilter<"Invoice"> | string | null
    fy?: StringNullableWithAggregatesFilter<"Invoice"> | string | null
    serial?: IntNullableWithAggregatesFilter<"Invoice"> | number | null
    status?: EnumInvoiceStatusWithAggregatesFilter<"Invoice"> | $Enums.InvoiceStatus
    issuedAt?: DateTimeNullableWithAggregatesFilter<"Invoice"> | Date | string | null
    dueAt?: DateTimeNullableWithAggregatesFilter<"Invoice"> | Date | string | null
    periodStart?: DateTimeNullableWithAggregatesFilter<"Invoice"> | Date | string | null
    isFirst?: BoolWithAggregatesFilter<"Invoice"> | boolean
    billingName?: StringNullableWithAggregatesFilter<"Invoice"> | string | null
    billingAddress?: StringNullableWithAggregatesFilter<"Invoice"> | string | null
    gstin?: StringNullableWithAggregatesFilter<"Invoice"> | string | null
    placeOfSupply?: StringNullableWithAggregatesFilter<"Invoice"> | string | null
    planLabel?: StringWithAggregatesFilter<"Invoice"> | string
    lines?: JsonWithAggregatesFilter<"Invoice">
    subtotal?: DecimalWithAggregatesFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    cgst?: DecimalWithAggregatesFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    sgst?: DecimalWithAggregatesFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    igst?: DecimalWithAggregatesFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    total?: DecimalWithAggregatesFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    paidAt?: DateTimeNullableWithAggregatesFilter<"Invoice"> | Date | string | null
    paymentMode?: StringNullableWithAggregatesFilter<"Invoice"> | string | null
    paymentRef?: StringNullableWithAggregatesFilter<"Invoice"> | string | null
    notes?: StringNullableWithAggregatesFilter<"Invoice"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Invoice"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Invoice"> | Date | string
  }

  export type PlanChangeWhereInput = {
    AND?: PlanChangeWhereInput | PlanChangeWhereInput[]
    OR?: PlanChangeWhereInput[]
    NOT?: PlanChangeWhereInput | PlanChangeWhereInput[]
    id?: StringFilter<"PlanChange"> | string
    accountId?: StringFilter<"PlanChange"> | string
    fromPlan?: EnumPlanTierNullableFilter<"PlanChange"> | $Enums.PlanTier | null
    toPlan?: EnumPlanTierFilter<"PlanChange"> | $Enums.PlanTier
    fromFeatures?: StringNullableFilter<"PlanChange"> | string | null
    toFeatures?: StringFilter<"PlanChange"> | string
    readOnly?: BoolFilter<"PlanChange"> | boolean
    reason?: StringNullableFilter<"PlanChange"> | string | null
    actorName?: StringFilter<"PlanChange"> | string
    jobId?: StringNullableFilter<"PlanChange"> | string | null
    at?: DateTimeFilter<"PlanChange"> | Date | string
    account?: XOR<ClinicAccountScalarRelationFilter, ClinicAccountWhereInput>
  }

  export type PlanChangeOrderByWithRelationInput = {
    id?: SortOrder
    accountId?: SortOrder
    fromPlan?: SortOrderInput | SortOrder
    toPlan?: SortOrder
    fromFeatures?: SortOrderInput | SortOrder
    toFeatures?: SortOrder
    readOnly?: SortOrder
    reason?: SortOrderInput | SortOrder
    actorName?: SortOrder
    jobId?: SortOrderInput | SortOrder
    at?: SortOrder
    account?: ClinicAccountOrderByWithRelationInput
  }

  export type PlanChangeWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: PlanChangeWhereInput | PlanChangeWhereInput[]
    OR?: PlanChangeWhereInput[]
    NOT?: PlanChangeWhereInput | PlanChangeWhereInput[]
    accountId?: StringFilter<"PlanChange"> | string
    fromPlan?: EnumPlanTierNullableFilter<"PlanChange"> | $Enums.PlanTier | null
    toPlan?: EnumPlanTierFilter<"PlanChange"> | $Enums.PlanTier
    fromFeatures?: StringNullableFilter<"PlanChange"> | string | null
    toFeatures?: StringFilter<"PlanChange"> | string
    readOnly?: BoolFilter<"PlanChange"> | boolean
    reason?: StringNullableFilter<"PlanChange"> | string | null
    actorName?: StringFilter<"PlanChange"> | string
    jobId?: StringNullableFilter<"PlanChange"> | string | null
    at?: DateTimeFilter<"PlanChange"> | Date | string
    account?: XOR<ClinicAccountScalarRelationFilter, ClinicAccountWhereInput>
  }, "id">

  export type PlanChangeOrderByWithAggregationInput = {
    id?: SortOrder
    accountId?: SortOrder
    fromPlan?: SortOrderInput | SortOrder
    toPlan?: SortOrder
    fromFeatures?: SortOrderInput | SortOrder
    toFeatures?: SortOrder
    readOnly?: SortOrder
    reason?: SortOrderInput | SortOrder
    actorName?: SortOrder
    jobId?: SortOrderInput | SortOrder
    at?: SortOrder
    _count?: PlanChangeCountOrderByAggregateInput
    _max?: PlanChangeMaxOrderByAggregateInput
    _min?: PlanChangeMinOrderByAggregateInput
  }

  export type PlanChangeScalarWhereWithAggregatesInput = {
    AND?: PlanChangeScalarWhereWithAggregatesInput | PlanChangeScalarWhereWithAggregatesInput[]
    OR?: PlanChangeScalarWhereWithAggregatesInput[]
    NOT?: PlanChangeScalarWhereWithAggregatesInput | PlanChangeScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"PlanChange"> | string
    accountId?: StringWithAggregatesFilter<"PlanChange"> | string
    fromPlan?: EnumPlanTierNullableWithAggregatesFilter<"PlanChange"> | $Enums.PlanTier | null
    toPlan?: EnumPlanTierWithAggregatesFilter<"PlanChange"> | $Enums.PlanTier
    fromFeatures?: StringNullableWithAggregatesFilter<"PlanChange"> | string | null
    toFeatures?: StringWithAggregatesFilter<"PlanChange"> | string
    readOnly?: BoolWithAggregatesFilter<"PlanChange"> | boolean
    reason?: StringNullableWithAggregatesFilter<"PlanChange"> | string | null
    actorName?: StringWithAggregatesFilter<"PlanChange"> | string
    jobId?: StringNullableWithAggregatesFilter<"PlanChange"> | string | null
    at?: DateTimeWithAggregatesFilter<"PlanChange"> | Date | string
  }

  export type ProviderUserCreateInput = {
    id?: string
    email: string
    passwordHash: string
    name: string
    role?: $Enums.ProviderRole
    isActive?: boolean
    createdAt?: Date | string
    activity?: ActivityLogCreateNestedManyWithoutActorInput
  }

  export type ProviderUserUncheckedCreateInput = {
    id?: string
    email: string
    passwordHash: string
    name: string
    role?: $Enums.ProviderRole
    isActive?: boolean
    createdAt?: Date | string
    activity?: ActivityLogUncheckedCreateNestedManyWithoutActorInput
  }

  export type ProviderUserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    role?: EnumProviderRoleFieldUpdateOperationsInput | $Enums.ProviderRole
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    activity?: ActivityLogUpdateManyWithoutActorNestedInput
  }

  export type ProviderUserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    role?: EnumProviderRoleFieldUpdateOperationsInput | $Enums.ProviderRole
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    activity?: ActivityLogUncheckedUpdateManyWithoutActorNestedInput
  }

  export type ProviderUserCreateManyInput = {
    id?: string
    email: string
    passwordHash: string
    name: string
    role?: $Enums.ProviderRole
    isActive?: boolean
    createdAt?: Date | string
  }

  export type ProviderUserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    role?: EnumProviderRoleFieldUpdateOperationsInput | $Enums.ProviderRole
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProviderUserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    role?: EnumProviderRoleFieldUpdateOperationsInput | $Enums.ProviderRole
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClinicAccountCreateInput = {
    id?: string
    slug: string
    name: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    city?: string | null
    notes?: string | null
    status?: $Enums.AccountStatus
    plan?: $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: Decimal | DecimalJsLike | number | string | null
    currency?: string
    billingCycle?: $Enums.BillingCycle
    startedAt?: Date | string | null
    renewsAt?: Date | string | null
    pricingModel?: $Enums.PricingModel
    setupFee?: Decimal | DecimalJsLike | number | string | null
    yearlyFee?: Decimal | DecimalJsLike | number | string | null
    licenceFee?: Decimal | DecimalJsLike | number | string | null
    amcPercent?: Decimal | DecimalJsLike | number | string | null
    hostingFee?: Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: number | null
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    billingState?: string | null
    appliedPlan?: $Enums.PlanTier | null
    appliedFeatures?: string | null
    appliedReadOnly?: boolean | null
    appliedAt?: Date | string | null
    planJobId?: string | null
    isDemo?: boolean
    publicDomain?: string | null
    portalDomain?: string | null
    apiDomain?: string | null
    neonProjectId?: string | null
    vercelWebProjectId?: string | null
    vercelApiProjectId?: string | null
    provisionedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: OnboardingStepCreateNestedManyWithoutAccountInput
    activity?: ActivityLogCreateNestedManyWithoutAccountInput
    health?: HealthCheckCreateNestedManyWithoutAccountInput
    invoices?: InvoiceCreateNestedManyWithoutAccountInput
    planChanges?: PlanChangeCreateNestedManyWithoutAccountInput
  }

  export type ClinicAccountUncheckedCreateInput = {
    id?: string
    slug: string
    name: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    city?: string | null
    notes?: string | null
    status?: $Enums.AccountStatus
    plan?: $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: Decimal | DecimalJsLike | number | string | null
    currency?: string
    billingCycle?: $Enums.BillingCycle
    startedAt?: Date | string | null
    renewsAt?: Date | string | null
    pricingModel?: $Enums.PricingModel
    setupFee?: Decimal | DecimalJsLike | number | string | null
    yearlyFee?: Decimal | DecimalJsLike | number | string | null
    licenceFee?: Decimal | DecimalJsLike | number | string | null
    amcPercent?: Decimal | DecimalJsLike | number | string | null
    hostingFee?: Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: number | null
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    billingState?: string | null
    appliedPlan?: $Enums.PlanTier | null
    appliedFeatures?: string | null
    appliedReadOnly?: boolean | null
    appliedAt?: Date | string | null
    planJobId?: string | null
    isDemo?: boolean
    publicDomain?: string | null
    portalDomain?: string | null
    apiDomain?: string | null
    neonProjectId?: string | null
    vercelWebProjectId?: string | null
    vercelApiProjectId?: string | null
    provisionedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: OnboardingStepUncheckedCreateNestedManyWithoutAccountInput
    activity?: ActivityLogUncheckedCreateNestedManyWithoutAccountInput
    health?: HealthCheckUncheckedCreateNestedManyWithoutAccountInput
    invoices?: InvoiceUncheckedCreateNestedManyWithoutAccountInput
    planChanges?: PlanChangeUncheckedCreateNestedManyWithoutAccountInput
  }

  export type ClinicAccountUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: OnboardingStepUpdateManyWithoutAccountNestedInput
    activity?: ActivityLogUpdateManyWithoutAccountNestedInput
    health?: HealthCheckUpdateManyWithoutAccountNestedInput
    invoices?: InvoiceUpdateManyWithoutAccountNestedInput
    planChanges?: PlanChangeUpdateManyWithoutAccountNestedInput
  }

  export type ClinicAccountUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: OnboardingStepUncheckedUpdateManyWithoutAccountNestedInput
    activity?: ActivityLogUncheckedUpdateManyWithoutAccountNestedInput
    health?: HealthCheckUncheckedUpdateManyWithoutAccountNestedInput
    invoices?: InvoiceUncheckedUpdateManyWithoutAccountNestedInput
    planChanges?: PlanChangeUncheckedUpdateManyWithoutAccountNestedInput
  }

  export type ClinicAccountCreateManyInput = {
    id?: string
    slug: string
    name: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    city?: string | null
    notes?: string | null
    status?: $Enums.AccountStatus
    plan?: $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: Decimal | DecimalJsLike | number | string | null
    currency?: string
    billingCycle?: $Enums.BillingCycle
    startedAt?: Date | string | null
    renewsAt?: Date | string | null
    pricingModel?: $Enums.PricingModel
    setupFee?: Decimal | DecimalJsLike | number | string | null
    yearlyFee?: Decimal | DecimalJsLike | number | string | null
    licenceFee?: Decimal | DecimalJsLike | number | string | null
    amcPercent?: Decimal | DecimalJsLike | number | string | null
    hostingFee?: Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: number | null
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    billingState?: string | null
    appliedPlan?: $Enums.PlanTier | null
    appliedFeatures?: string | null
    appliedReadOnly?: boolean | null
    appliedAt?: Date | string | null
    planJobId?: string | null
    isDemo?: boolean
    publicDomain?: string | null
    portalDomain?: string | null
    apiDomain?: string | null
    neonProjectId?: string | null
    vercelWebProjectId?: string | null
    vercelApiProjectId?: string | null
    provisionedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ClinicAccountUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClinicAccountUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OnboardingStepCreateInput = {
    id?: string
    key: string
    label: string
    automated?: boolean
    sortOrder?: number
    done?: boolean
    doneAt?: Date | string | null
    notes?: string | null
    account: ClinicAccountCreateNestedOneWithoutStepsInput
  }

  export type OnboardingStepUncheckedCreateInput = {
    id?: string
    accountId: string
    key: string
    label: string
    automated?: boolean
    sortOrder?: number
    done?: boolean
    doneAt?: Date | string | null
    notes?: string | null
  }

  export type OnboardingStepUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    label?: StringFieldUpdateOperationsInput | string
    automated?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    done?: BoolFieldUpdateOperationsInput | boolean
    doneAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    account?: ClinicAccountUpdateOneRequiredWithoutStepsNestedInput
  }

  export type OnboardingStepUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    label?: StringFieldUpdateOperationsInput | string
    automated?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    done?: BoolFieldUpdateOperationsInput | boolean
    doneAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type OnboardingStepCreateManyInput = {
    id?: string
    accountId: string
    key: string
    label: string
    automated?: boolean
    sortOrder?: number
    done?: boolean
    doneAt?: Date | string | null
    notes?: string | null
  }

  export type OnboardingStepUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    label?: StringFieldUpdateOperationsInput | string
    automated?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    done?: BoolFieldUpdateOperationsInput | boolean
    doneAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type OnboardingStepUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    label?: StringFieldUpdateOperationsInput | string
    automated?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    done?: BoolFieldUpdateOperationsInput | boolean
    doneAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type ActivityLogCreateInput = {
    id?: string
    actorName: string
    action: string
    detail?: string | null
    applied?: boolean
    at?: Date | string
    account?: ClinicAccountCreateNestedOneWithoutActivityInput
    actor?: ProviderUserCreateNestedOneWithoutActivityInput
  }

  export type ActivityLogUncheckedCreateInput = {
    id?: string
    accountId?: string | null
    actorId?: string | null
    actorName: string
    action: string
    detail?: string | null
    applied?: boolean
    at?: Date | string
  }

  export type ActivityLogUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    actorName?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    detail?: NullableStringFieldUpdateOperationsInput | string | null
    applied?: BoolFieldUpdateOperationsInput | boolean
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    account?: ClinicAccountUpdateOneWithoutActivityNestedInput
    actor?: ProviderUserUpdateOneWithoutActivityNestedInput
  }

  export type ActivityLogUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    actorId?: NullableStringFieldUpdateOperationsInput | string | null
    actorName?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    detail?: NullableStringFieldUpdateOperationsInput | string | null
    applied?: BoolFieldUpdateOperationsInput | boolean
    at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ActivityLogCreateManyInput = {
    id?: string
    accountId?: string | null
    actorId?: string | null
    actorName: string
    action: string
    detail?: string | null
    applied?: boolean
    at?: Date | string
  }

  export type ActivityLogUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    actorName?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    detail?: NullableStringFieldUpdateOperationsInput | string | null
    applied?: BoolFieldUpdateOperationsInput | boolean
    at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ActivityLogUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    actorId?: NullableStringFieldUpdateOperationsInput | string | null
    actorName?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    detail?: NullableStringFieldUpdateOperationsInput | string | null
    applied?: BoolFieldUpdateOperationsInput | boolean
    at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HealthCheckCreateInput = {
    id?: string
    ok: boolean
    statusCode?: number | null
    latencyMs?: number | null
    error?: string | null
    checkedAt?: Date | string
    account: ClinicAccountCreateNestedOneWithoutHealthInput
  }

  export type HealthCheckUncheckedCreateInput = {
    id?: string
    accountId: string
    ok: boolean
    statusCode?: number | null
    latencyMs?: number | null
    error?: string | null
    checkedAt?: Date | string
  }

  export type HealthCheckUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    ok?: BoolFieldUpdateOperationsInput | boolean
    statusCode?: NullableIntFieldUpdateOperationsInput | number | null
    latencyMs?: NullableIntFieldUpdateOperationsInput | number | null
    error?: NullableStringFieldUpdateOperationsInput | string | null
    checkedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    account?: ClinicAccountUpdateOneRequiredWithoutHealthNestedInput
  }

  export type HealthCheckUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    ok?: BoolFieldUpdateOperationsInput | boolean
    statusCode?: NullableIntFieldUpdateOperationsInput | number | null
    latencyMs?: NullableIntFieldUpdateOperationsInput | number | null
    error?: NullableStringFieldUpdateOperationsInput | string | null
    checkedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HealthCheckCreateManyInput = {
    id?: string
    accountId: string
    ok: boolean
    statusCode?: number | null
    latencyMs?: number | null
    error?: string | null
    checkedAt?: Date | string
  }

  export type HealthCheckUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    ok?: BoolFieldUpdateOperationsInput | boolean
    statusCode?: NullableIntFieldUpdateOperationsInput | number | null
    latencyMs?: NullableIntFieldUpdateOperationsInput | number | null
    error?: NullableStringFieldUpdateOperationsInput | string | null
    checkedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HealthCheckUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    ok?: BoolFieldUpdateOperationsInput | boolean
    statusCode?: NullableIntFieldUpdateOperationsInput | number | null
    latencyMs?: NullableIntFieldUpdateOperationsInput | number | null
    error?: NullableStringFieldUpdateOperationsInput | string | null
    checkedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type InvoiceCreateInput = {
    id?: string
    number?: string | null
    fy?: string | null
    serial?: number | null
    status?: $Enums.InvoiceStatus
    issuedAt?: Date | string | null
    dueAt?: Date | string | null
    periodStart?: Date | string | null
    isFirst?: boolean
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    placeOfSupply?: string | null
    planLabel: string
    lines: JsonNullValueInput | InputJsonValue
    subtotal: Decimal | DecimalJsLike | number | string
    cgst: Decimal | DecimalJsLike | number | string
    sgst: Decimal | DecimalJsLike | number | string
    igst: Decimal | DecimalJsLike | number | string
    total: Decimal | DecimalJsLike | number | string
    paidAt?: Date | string | null
    paymentMode?: string | null
    paymentRef?: string | null
    notes?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    account: ClinicAccountCreateNestedOneWithoutInvoicesInput
  }

  export type InvoiceUncheckedCreateInput = {
    id?: string
    accountId: string
    number?: string | null
    fy?: string | null
    serial?: number | null
    status?: $Enums.InvoiceStatus
    issuedAt?: Date | string | null
    dueAt?: Date | string | null
    periodStart?: Date | string | null
    isFirst?: boolean
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    placeOfSupply?: string | null
    planLabel: string
    lines: JsonNullValueInput | InputJsonValue
    subtotal: Decimal | DecimalJsLike | number | string
    cgst: Decimal | DecimalJsLike | number | string
    sgst: Decimal | DecimalJsLike | number | string
    igst: Decimal | DecimalJsLike | number | string
    total: Decimal | DecimalJsLike | number | string
    paidAt?: Date | string | null
    paymentMode?: string | null
    paymentRef?: string | null
    notes?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type InvoiceUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: NullableStringFieldUpdateOperationsInput | string | null
    fy?: NullableStringFieldUpdateOperationsInput | string | null
    serial?: NullableIntFieldUpdateOperationsInput | number | null
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    issuedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    dueAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    periodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isFirst?: BoolFieldUpdateOperationsInput | boolean
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    placeOfSupply?: NullableStringFieldUpdateOperationsInput | string | null
    planLabel?: StringFieldUpdateOperationsInput | string
    lines?: JsonNullValueInput | InputJsonValue
    subtotal?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    cgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    igst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMode?: NullableStringFieldUpdateOperationsInput | string | null
    paymentRef?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    account?: ClinicAccountUpdateOneRequiredWithoutInvoicesNestedInput
  }

  export type InvoiceUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    number?: NullableStringFieldUpdateOperationsInput | string | null
    fy?: NullableStringFieldUpdateOperationsInput | string | null
    serial?: NullableIntFieldUpdateOperationsInput | number | null
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    issuedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    dueAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    periodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isFirst?: BoolFieldUpdateOperationsInput | boolean
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    placeOfSupply?: NullableStringFieldUpdateOperationsInput | string | null
    planLabel?: StringFieldUpdateOperationsInput | string
    lines?: JsonNullValueInput | InputJsonValue
    subtotal?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    cgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    igst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMode?: NullableStringFieldUpdateOperationsInput | string | null
    paymentRef?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type InvoiceCreateManyInput = {
    id?: string
    accountId: string
    number?: string | null
    fy?: string | null
    serial?: number | null
    status?: $Enums.InvoiceStatus
    issuedAt?: Date | string | null
    dueAt?: Date | string | null
    periodStart?: Date | string | null
    isFirst?: boolean
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    placeOfSupply?: string | null
    planLabel: string
    lines: JsonNullValueInput | InputJsonValue
    subtotal: Decimal | DecimalJsLike | number | string
    cgst: Decimal | DecimalJsLike | number | string
    sgst: Decimal | DecimalJsLike | number | string
    igst: Decimal | DecimalJsLike | number | string
    total: Decimal | DecimalJsLike | number | string
    paidAt?: Date | string | null
    paymentMode?: string | null
    paymentRef?: string | null
    notes?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type InvoiceUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: NullableStringFieldUpdateOperationsInput | string | null
    fy?: NullableStringFieldUpdateOperationsInput | string | null
    serial?: NullableIntFieldUpdateOperationsInput | number | null
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    issuedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    dueAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    periodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isFirst?: BoolFieldUpdateOperationsInput | boolean
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    placeOfSupply?: NullableStringFieldUpdateOperationsInput | string | null
    planLabel?: StringFieldUpdateOperationsInput | string
    lines?: JsonNullValueInput | InputJsonValue
    subtotal?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    cgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    igst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMode?: NullableStringFieldUpdateOperationsInput | string | null
    paymentRef?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type InvoiceUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    number?: NullableStringFieldUpdateOperationsInput | string | null
    fy?: NullableStringFieldUpdateOperationsInput | string | null
    serial?: NullableIntFieldUpdateOperationsInput | number | null
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    issuedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    dueAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    periodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isFirst?: BoolFieldUpdateOperationsInput | boolean
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    placeOfSupply?: NullableStringFieldUpdateOperationsInput | string | null
    planLabel?: StringFieldUpdateOperationsInput | string
    lines?: JsonNullValueInput | InputJsonValue
    subtotal?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    cgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    igst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMode?: NullableStringFieldUpdateOperationsInput | string | null
    paymentRef?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PlanChangeCreateInput = {
    id?: string
    fromPlan?: $Enums.PlanTier | null
    toPlan: $Enums.PlanTier
    fromFeatures?: string | null
    toFeatures: string
    readOnly?: boolean
    reason?: string | null
    actorName: string
    jobId?: string | null
    at?: Date | string
    account: ClinicAccountCreateNestedOneWithoutPlanChangesInput
  }

  export type PlanChangeUncheckedCreateInput = {
    id?: string
    accountId: string
    fromPlan?: $Enums.PlanTier | null
    toPlan: $Enums.PlanTier
    fromFeatures?: string | null
    toFeatures: string
    readOnly?: boolean
    reason?: string | null
    actorName: string
    jobId?: string | null
    at?: Date | string
  }

  export type PlanChangeUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    fromPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    toPlan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    fromFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    toFeatures?: StringFieldUpdateOperationsInput | string
    readOnly?: BoolFieldUpdateOperationsInput | boolean
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    actorName?: StringFieldUpdateOperationsInput | string
    jobId?: NullableStringFieldUpdateOperationsInput | string | null
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    account?: ClinicAccountUpdateOneRequiredWithoutPlanChangesNestedInput
  }

  export type PlanChangeUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    fromPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    toPlan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    fromFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    toFeatures?: StringFieldUpdateOperationsInput | string
    readOnly?: BoolFieldUpdateOperationsInput | boolean
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    actorName?: StringFieldUpdateOperationsInput | string
    jobId?: NullableStringFieldUpdateOperationsInput | string | null
    at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PlanChangeCreateManyInput = {
    id?: string
    accountId: string
    fromPlan?: $Enums.PlanTier | null
    toPlan: $Enums.PlanTier
    fromFeatures?: string | null
    toFeatures: string
    readOnly?: boolean
    reason?: string | null
    actorName: string
    jobId?: string | null
    at?: Date | string
  }

  export type PlanChangeUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    fromPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    toPlan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    fromFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    toFeatures?: StringFieldUpdateOperationsInput | string
    readOnly?: BoolFieldUpdateOperationsInput | boolean
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    actorName?: StringFieldUpdateOperationsInput | string
    jobId?: NullableStringFieldUpdateOperationsInput | string | null
    at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PlanChangeUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: StringFieldUpdateOperationsInput | string
    fromPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    toPlan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    fromFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    toFeatures?: StringFieldUpdateOperationsInput | string
    readOnly?: BoolFieldUpdateOperationsInput | boolean
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    actorName?: StringFieldUpdateOperationsInput | string
    jobId?: NullableStringFieldUpdateOperationsInput | string | null
    at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type EnumProviderRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.ProviderRole | EnumProviderRoleFieldRefInput<$PrismaModel>
    in?: $Enums.ProviderRole[] | ListEnumProviderRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.ProviderRole[] | ListEnumProviderRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumProviderRoleFilter<$PrismaModel> | $Enums.ProviderRole
  }

  export type BoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type ActivityLogListRelationFilter = {
    every?: ActivityLogWhereInput
    some?: ActivityLogWhereInput
    none?: ActivityLogWhereInput
  }

  export type ActivityLogOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ProviderUserCountOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    role?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type ProviderUserMaxOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    role?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type ProviderUserMinOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    passwordHash?: SortOrder
    name?: SortOrder
    role?: SortOrder
    isActive?: SortOrder
    createdAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type EnumProviderRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ProviderRole | EnumProviderRoleFieldRefInput<$PrismaModel>
    in?: $Enums.ProviderRole[] | ListEnumProviderRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.ProviderRole[] | ListEnumProviderRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumProviderRoleWithAggregatesFilter<$PrismaModel> | $Enums.ProviderRole
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumProviderRoleFilter<$PrismaModel>
    _max?: NestedEnumProviderRoleFilter<$PrismaModel>
  }

  export type BoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type EnumAccountStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.AccountStatus | EnumAccountStatusFieldRefInput<$PrismaModel>
    in?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumAccountStatusFilter<$PrismaModel> | $Enums.AccountStatus
  }

  export type EnumPlanTierFilter<$PrismaModel = never> = {
    equals?: $Enums.PlanTier | EnumPlanTierFieldRefInput<$PrismaModel>
    in?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel>
    notIn?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel>
    not?: NestedEnumPlanTierFilter<$PrismaModel> | $Enums.PlanTier
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type DecimalNullableFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
  }

  export type EnumBillingCycleFilter<$PrismaModel = never> = {
    equals?: $Enums.BillingCycle | EnumBillingCycleFieldRefInput<$PrismaModel>
    in?: $Enums.BillingCycle[] | ListEnumBillingCycleFieldRefInput<$PrismaModel>
    notIn?: $Enums.BillingCycle[] | ListEnumBillingCycleFieldRefInput<$PrismaModel>
    not?: NestedEnumBillingCycleFilter<$PrismaModel> | $Enums.BillingCycle
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type EnumPricingModelFilter<$PrismaModel = never> = {
    equals?: $Enums.PricingModel | EnumPricingModelFieldRefInput<$PrismaModel>
    in?: $Enums.PricingModel[] | ListEnumPricingModelFieldRefInput<$PrismaModel>
    notIn?: $Enums.PricingModel[] | ListEnumPricingModelFieldRefInput<$PrismaModel>
    not?: NestedEnumPricingModelFilter<$PrismaModel> | $Enums.PricingModel
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type EnumPlanTierNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.PlanTier | EnumPlanTierFieldRefInput<$PrismaModel> | null
    in?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel> | null
    not?: NestedEnumPlanTierNullableFilter<$PrismaModel> | $Enums.PlanTier | null
  }

  export type BoolNullableFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableFilter<$PrismaModel> | boolean | null
  }

  export type OnboardingStepListRelationFilter = {
    every?: OnboardingStepWhereInput
    some?: OnboardingStepWhereInput
    none?: OnboardingStepWhereInput
  }

  export type HealthCheckListRelationFilter = {
    every?: HealthCheckWhereInput
    some?: HealthCheckWhereInput
    none?: HealthCheckWhereInput
  }

  export type InvoiceListRelationFilter = {
    every?: InvoiceWhereInput
    some?: InvoiceWhereInput
    none?: InvoiceWhereInput
  }

  export type PlanChangeListRelationFilter = {
    every?: PlanChangeWhereInput
    some?: PlanChangeWhereInput
    none?: PlanChangeWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type OnboardingStepOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type HealthCheckOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type InvoiceOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type PlanChangeOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ClinicAccountCountOrderByAggregateInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    contactName?: SortOrder
    contactEmail?: SortOrder
    contactPhone?: SortOrder
    city?: SortOrder
    notes?: SortOrder
    status?: SortOrder
    plan?: SortOrder
    featureOverrides?: SortOrder
    monthlyFee?: SortOrder
    currency?: SortOrder
    billingCycle?: SortOrder
    startedAt?: SortOrder
    renewsAt?: SortOrder
    pricingModel?: SortOrder
    setupFee?: SortOrder
    yearlyFee?: SortOrder
    licenceFee?: SortOrder
    amcPercent?: SortOrder
    hostingFee?: SortOrder
    maxUsersOverride?: SortOrder
    billingName?: SortOrder
    billingAddress?: SortOrder
    gstin?: SortOrder
    billingState?: SortOrder
    appliedPlan?: SortOrder
    appliedFeatures?: SortOrder
    appliedReadOnly?: SortOrder
    appliedAt?: SortOrder
    planJobId?: SortOrder
    isDemo?: SortOrder
    publicDomain?: SortOrder
    portalDomain?: SortOrder
    apiDomain?: SortOrder
    neonProjectId?: SortOrder
    vercelWebProjectId?: SortOrder
    vercelApiProjectId?: SortOrder
    provisionedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ClinicAccountAvgOrderByAggregateInput = {
    monthlyFee?: SortOrder
    setupFee?: SortOrder
    yearlyFee?: SortOrder
    licenceFee?: SortOrder
    amcPercent?: SortOrder
    hostingFee?: SortOrder
    maxUsersOverride?: SortOrder
  }

  export type ClinicAccountMaxOrderByAggregateInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    contactName?: SortOrder
    contactEmail?: SortOrder
    contactPhone?: SortOrder
    city?: SortOrder
    notes?: SortOrder
    status?: SortOrder
    plan?: SortOrder
    monthlyFee?: SortOrder
    currency?: SortOrder
    billingCycle?: SortOrder
    startedAt?: SortOrder
    renewsAt?: SortOrder
    pricingModel?: SortOrder
    setupFee?: SortOrder
    yearlyFee?: SortOrder
    licenceFee?: SortOrder
    amcPercent?: SortOrder
    hostingFee?: SortOrder
    maxUsersOverride?: SortOrder
    billingName?: SortOrder
    billingAddress?: SortOrder
    gstin?: SortOrder
    billingState?: SortOrder
    appliedPlan?: SortOrder
    appliedFeatures?: SortOrder
    appliedReadOnly?: SortOrder
    appliedAt?: SortOrder
    planJobId?: SortOrder
    isDemo?: SortOrder
    publicDomain?: SortOrder
    portalDomain?: SortOrder
    apiDomain?: SortOrder
    neonProjectId?: SortOrder
    vercelWebProjectId?: SortOrder
    vercelApiProjectId?: SortOrder
    provisionedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ClinicAccountMinOrderByAggregateInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    contactName?: SortOrder
    contactEmail?: SortOrder
    contactPhone?: SortOrder
    city?: SortOrder
    notes?: SortOrder
    status?: SortOrder
    plan?: SortOrder
    monthlyFee?: SortOrder
    currency?: SortOrder
    billingCycle?: SortOrder
    startedAt?: SortOrder
    renewsAt?: SortOrder
    pricingModel?: SortOrder
    setupFee?: SortOrder
    yearlyFee?: SortOrder
    licenceFee?: SortOrder
    amcPercent?: SortOrder
    hostingFee?: SortOrder
    maxUsersOverride?: SortOrder
    billingName?: SortOrder
    billingAddress?: SortOrder
    gstin?: SortOrder
    billingState?: SortOrder
    appliedPlan?: SortOrder
    appliedFeatures?: SortOrder
    appliedReadOnly?: SortOrder
    appliedAt?: SortOrder
    planJobId?: SortOrder
    isDemo?: SortOrder
    publicDomain?: SortOrder
    portalDomain?: SortOrder
    apiDomain?: SortOrder
    neonProjectId?: SortOrder
    vercelWebProjectId?: SortOrder
    vercelApiProjectId?: SortOrder
    provisionedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ClinicAccountSumOrderByAggregateInput = {
    monthlyFee?: SortOrder
    setupFee?: SortOrder
    yearlyFee?: SortOrder
    licenceFee?: SortOrder
    amcPercent?: SortOrder
    hostingFee?: SortOrder
    maxUsersOverride?: SortOrder
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type EnumAccountStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.AccountStatus | EnumAccountStatusFieldRefInput<$PrismaModel>
    in?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumAccountStatusWithAggregatesFilter<$PrismaModel> | $Enums.AccountStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumAccountStatusFilter<$PrismaModel>
    _max?: NestedEnumAccountStatusFilter<$PrismaModel>
  }

  export type EnumPlanTierWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PlanTier | EnumPlanTierFieldRefInput<$PrismaModel>
    in?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel>
    notIn?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel>
    not?: NestedEnumPlanTierWithAggregatesFilter<$PrismaModel> | $Enums.PlanTier
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPlanTierFilter<$PrismaModel>
    _max?: NestedEnumPlanTierFilter<$PrismaModel>
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type DecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedDecimalNullableFilter<$PrismaModel>
    _sum?: NestedDecimalNullableFilter<$PrismaModel>
    _min?: NestedDecimalNullableFilter<$PrismaModel>
    _max?: NestedDecimalNullableFilter<$PrismaModel>
  }

  export type EnumBillingCycleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.BillingCycle | EnumBillingCycleFieldRefInput<$PrismaModel>
    in?: $Enums.BillingCycle[] | ListEnumBillingCycleFieldRefInput<$PrismaModel>
    notIn?: $Enums.BillingCycle[] | ListEnumBillingCycleFieldRefInput<$PrismaModel>
    not?: NestedEnumBillingCycleWithAggregatesFilter<$PrismaModel> | $Enums.BillingCycle
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumBillingCycleFilter<$PrismaModel>
    _max?: NestedEnumBillingCycleFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type EnumPricingModelWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PricingModel | EnumPricingModelFieldRefInput<$PrismaModel>
    in?: $Enums.PricingModel[] | ListEnumPricingModelFieldRefInput<$PrismaModel>
    notIn?: $Enums.PricingModel[] | ListEnumPricingModelFieldRefInput<$PrismaModel>
    not?: NestedEnumPricingModelWithAggregatesFilter<$PrismaModel> | $Enums.PricingModel
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPricingModelFilter<$PrismaModel>
    _max?: NestedEnumPricingModelFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type EnumPlanTierNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PlanTier | EnumPlanTierFieldRefInput<$PrismaModel> | null
    in?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel> | null
    not?: NestedEnumPlanTierNullableWithAggregatesFilter<$PrismaModel> | $Enums.PlanTier | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumPlanTierNullableFilter<$PrismaModel>
    _max?: NestedEnumPlanTierNullableFilter<$PrismaModel>
  }

  export type BoolNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableWithAggregatesFilter<$PrismaModel> | boolean | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedBoolNullableFilter<$PrismaModel>
    _max?: NestedBoolNullableFilter<$PrismaModel>
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type ClinicAccountScalarRelationFilter = {
    is?: ClinicAccountWhereInput
    isNot?: ClinicAccountWhereInput
  }

  export type OnboardingStepAccountIdKeyCompoundUniqueInput = {
    accountId: string
    key: string
  }

  export type OnboardingStepCountOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    key?: SortOrder
    label?: SortOrder
    automated?: SortOrder
    sortOrder?: SortOrder
    done?: SortOrder
    doneAt?: SortOrder
    notes?: SortOrder
  }

  export type OnboardingStepAvgOrderByAggregateInput = {
    sortOrder?: SortOrder
  }

  export type OnboardingStepMaxOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    key?: SortOrder
    label?: SortOrder
    automated?: SortOrder
    sortOrder?: SortOrder
    done?: SortOrder
    doneAt?: SortOrder
    notes?: SortOrder
  }

  export type OnboardingStepMinOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    key?: SortOrder
    label?: SortOrder
    automated?: SortOrder
    sortOrder?: SortOrder
    done?: SortOrder
    doneAt?: SortOrder
    notes?: SortOrder
  }

  export type OnboardingStepSumOrderByAggregateInput = {
    sortOrder?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type ClinicAccountNullableScalarRelationFilter = {
    is?: ClinicAccountWhereInput | null
    isNot?: ClinicAccountWhereInput | null
  }

  export type ProviderUserNullableScalarRelationFilter = {
    is?: ProviderUserWhereInput | null
    isNot?: ProviderUserWhereInput | null
  }

  export type ActivityLogCountOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    actorId?: SortOrder
    actorName?: SortOrder
    action?: SortOrder
    detail?: SortOrder
    applied?: SortOrder
    at?: SortOrder
  }

  export type ActivityLogMaxOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    actorId?: SortOrder
    actorName?: SortOrder
    action?: SortOrder
    detail?: SortOrder
    applied?: SortOrder
    at?: SortOrder
  }

  export type ActivityLogMinOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    actorId?: SortOrder
    actorName?: SortOrder
    action?: SortOrder
    detail?: SortOrder
    applied?: SortOrder
    at?: SortOrder
  }

  export type HealthCheckCountOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    ok?: SortOrder
    statusCode?: SortOrder
    latencyMs?: SortOrder
    error?: SortOrder
    checkedAt?: SortOrder
  }

  export type HealthCheckAvgOrderByAggregateInput = {
    statusCode?: SortOrder
    latencyMs?: SortOrder
  }

  export type HealthCheckMaxOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    ok?: SortOrder
    statusCode?: SortOrder
    latencyMs?: SortOrder
    error?: SortOrder
    checkedAt?: SortOrder
  }

  export type HealthCheckMinOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    ok?: SortOrder
    statusCode?: SortOrder
    latencyMs?: SortOrder
    error?: SortOrder
    checkedAt?: SortOrder
  }

  export type HealthCheckSumOrderByAggregateInput = {
    statusCode?: SortOrder
    latencyMs?: SortOrder
  }

  export type EnumInvoiceStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.InvoiceStatus | EnumInvoiceStatusFieldRefInput<$PrismaModel>
    in?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumInvoiceStatusFilter<$PrismaModel> | $Enums.InvoiceStatus
  }
  export type JsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, 'path'>>

  export type JsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type DecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type InvoiceFySerialCompoundUniqueInput = {
    fy: string
    serial: number
  }

  export type InvoiceCountOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    number?: SortOrder
    fy?: SortOrder
    serial?: SortOrder
    status?: SortOrder
    issuedAt?: SortOrder
    dueAt?: SortOrder
    periodStart?: SortOrder
    isFirst?: SortOrder
    billingName?: SortOrder
    billingAddress?: SortOrder
    gstin?: SortOrder
    placeOfSupply?: SortOrder
    planLabel?: SortOrder
    lines?: SortOrder
    subtotal?: SortOrder
    cgst?: SortOrder
    sgst?: SortOrder
    igst?: SortOrder
    total?: SortOrder
    paidAt?: SortOrder
    paymentMode?: SortOrder
    paymentRef?: SortOrder
    notes?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type InvoiceAvgOrderByAggregateInput = {
    serial?: SortOrder
    subtotal?: SortOrder
    cgst?: SortOrder
    sgst?: SortOrder
    igst?: SortOrder
    total?: SortOrder
  }

  export type InvoiceMaxOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    number?: SortOrder
    fy?: SortOrder
    serial?: SortOrder
    status?: SortOrder
    issuedAt?: SortOrder
    dueAt?: SortOrder
    periodStart?: SortOrder
    isFirst?: SortOrder
    billingName?: SortOrder
    billingAddress?: SortOrder
    gstin?: SortOrder
    placeOfSupply?: SortOrder
    planLabel?: SortOrder
    subtotal?: SortOrder
    cgst?: SortOrder
    sgst?: SortOrder
    igst?: SortOrder
    total?: SortOrder
    paidAt?: SortOrder
    paymentMode?: SortOrder
    paymentRef?: SortOrder
    notes?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type InvoiceMinOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    number?: SortOrder
    fy?: SortOrder
    serial?: SortOrder
    status?: SortOrder
    issuedAt?: SortOrder
    dueAt?: SortOrder
    periodStart?: SortOrder
    isFirst?: SortOrder
    billingName?: SortOrder
    billingAddress?: SortOrder
    gstin?: SortOrder
    placeOfSupply?: SortOrder
    planLabel?: SortOrder
    subtotal?: SortOrder
    cgst?: SortOrder
    sgst?: SortOrder
    igst?: SortOrder
    total?: SortOrder
    paidAt?: SortOrder
    paymentMode?: SortOrder
    paymentRef?: SortOrder
    notes?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type InvoiceSumOrderByAggregateInput = {
    serial?: SortOrder
    subtotal?: SortOrder
    cgst?: SortOrder
    sgst?: SortOrder
    igst?: SortOrder
    total?: SortOrder
  }

  export type EnumInvoiceStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.InvoiceStatus | EnumInvoiceStatusFieldRefInput<$PrismaModel>
    in?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumInvoiceStatusWithAggregatesFilter<$PrismaModel> | $Enums.InvoiceStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumInvoiceStatusFilter<$PrismaModel>
    _max?: NestedEnumInvoiceStatusFilter<$PrismaModel>
  }
  export type JsonWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedJsonFilter<$PrismaModel>
    _max?: NestedJsonFilter<$PrismaModel>
  }

  export type DecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type PlanChangeCountOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    fromPlan?: SortOrder
    toPlan?: SortOrder
    fromFeatures?: SortOrder
    toFeatures?: SortOrder
    readOnly?: SortOrder
    reason?: SortOrder
    actorName?: SortOrder
    jobId?: SortOrder
    at?: SortOrder
  }

  export type PlanChangeMaxOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    fromPlan?: SortOrder
    toPlan?: SortOrder
    fromFeatures?: SortOrder
    toFeatures?: SortOrder
    readOnly?: SortOrder
    reason?: SortOrder
    actorName?: SortOrder
    jobId?: SortOrder
    at?: SortOrder
  }

  export type PlanChangeMinOrderByAggregateInput = {
    id?: SortOrder
    accountId?: SortOrder
    fromPlan?: SortOrder
    toPlan?: SortOrder
    fromFeatures?: SortOrder
    toFeatures?: SortOrder
    readOnly?: SortOrder
    reason?: SortOrder
    actorName?: SortOrder
    jobId?: SortOrder
    at?: SortOrder
  }

  export type ActivityLogCreateNestedManyWithoutActorInput = {
    create?: XOR<ActivityLogCreateWithoutActorInput, ActivityLogUncheckedCreateWithoutActorInput> | ActivityLogCreateWithoutActorInput[] | ActivityLogUncheckedCreateWithoutActorInput[]
    connectOrCreate?: ActivityLogCreateOrConnectWithoutActorInput | ActivityLogCreateOrConnectWithoutActorInput[]
    createMany?: ActivityLogCreateManyActorInputEnvelope
    connect?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
  }

  export type ActivityLogUncheckedCreateNestedManyWithoutActorInput = {
    create?: XOR<ActivityLogCreateWithoutActorInput, ActivityLogUncheckedCreateWithoutActorInput> | ActivityLogCreateWithoutActorInput[] | ActivityLogUncheckedCreateWithoutActorInput[]
    connectOrCreate?: ActivityLogCreateOrConnectWithoutActorInput | ActivityLogCreateOrConnectWithoutActorInput[]
    createMany?: ActivityLogCreateManyActorInputEnvelope
    connect?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type EnumProviderRoleFieldUpdateOperationsInput = {
    set?: $Enums.ProviderRole
  }

  export type BoolFieldUpdateOperationsInput = {
    set?: boolean
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type ActivityLogUpdateManyWithoutActorNestedInput = {
    create?: XOR<ActivityLogCreateWithoutActorInput, ActivityLogUncheckedCreateWithoutActorInput> | ActivityLogCreateWithoutActorInput[] | ActivityLogUncheckedCreateWithoutActorInput[]
    connectOrCreate?: ActivityLogCreateOrConnectWithoutActorInput | ActivityLogCreateOrConnectWithoutActorInput[]
    upsert?: ActivityLogUpsertWithWhereUniqueWithoutActorInput | ActivityLogUpsertWithWhereUniqueWithoutActorInput[]
    createMany?: ActivityLogCreateManyActorInputEnvelope
    set?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    disconnect?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    delete?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    connect?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    update?: ActivityLogUpdateWithWhereUniqueWithoutActorInput | ActivityLogUpdateWithWhereUniqueWithoutActorInput[]
    updateMany?: ActivityLogUpdateManyWithWhereWithoutActorInput | ActivityLogUpdateManyWithWhereWithoutActorInput[]
    deleteMany?: ActivityLogScalarWhereInput | ActivityLogScalarWhereInput[]
  }

  export type ActivityLogUncheckedUpdateManyWithoutActorNestedInput = {
    create?: XOR<ActivityLogCreateWithoutActorInput, ActivityLogUncheckedCreateWithoutActorInput> | ActivityLogCreateWithoutActorInput[] | ActivityLogUncheckedCreateWithoutActorInput[]
    connectOrCreate?: ActivityLogCreateOrConnectWithoutActorInput | ActivityLogCreateOrConnectWithoutActorInput[]
    upsert?: ActivityLogUpsertWithWhereUniqueWithoutActorInput | ActivityLogUpsertWithWhereUniqueWithoutActorInput[]
    createMany?: ActivityLogCreateManyActorInputEnvelope
    set?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    disconnect?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    delete?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    connect?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    update?: ActivityLogUpdateWithWhereUniqueWithoutActorInput | ActivityLogUpdateWithWhereUniqueWithoutActorInput[]
    updateMany?: ActivityLogUpdateManyWithWhereWithoutActorInput | ActivityLogUpdateManyWithWhereWithoutActorInput[]
    deleteMany?: ActivityLogScalarWhereInput | ActivityLogScalarWhereInput[]
  }

  export type OnboardingStepCreateNestedManyWithoutAccountInput = {
    create?: XOR<OnboardingStepCreateWithoutAccountInput, OnboardingStepUncheckedCreateWithoutAccountInput> | OnboardingStepCreateWithoutAccountInput[] | OnboardingStepUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: OnboardingStepCreateOrConnectWithoutAccountInput | OnboardingStepCreateOrConnectWithoutAccountInput[]
    createMany?: OnboardingStepCreateManyAccountInputEnvelope
    connect?: OnboardingStepWhereUniqueInput | OnboardingStepWhereUniqueInput[]
  }

  export type ActivityLogCreateNestedManyWithoutAccountInput = {
    create?: XOR<ActivityLogCreateWithoutAccountInput, ActivityLogUncheckedCreateWithoutAccountInput> | ActivityLogCreateWithoutAccountInput[] | ActivityLogUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: ActivityLogCreateOrConnectWithoutAccountInput | ActivityLogCreateOrConnectWithoutAccountInput[]
    createMany?: ActivityLogCreateManyAccountInputEnvelope
    connect?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
  }

  export type HealthCheckCreateNestedManyWithoutAccountInput = {
    create?: XOR<HealthCheckCreateWithoutAccountInput, HealthCheckUncheckedCreateWithoutAccountInput> | HealthCheckCreateWithoutAccountInput[] | HealthCheckUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: HealthCheckCreateOrConnectWithoutAccountInput | HealthCheckCreateOrConnectWithoutAccountInput[]
    createMany?: HealthCheckCreateManyAccountInputEnvelope
    connect?: HealthCheckWhereUniqueInput | HealthCheckWhereUniqueInput[]
  }

  export type InvoiceCreateNestedManyWithoutAccountInput = {
    create?: XOR<InvoiceCreateWithoutAccountInput, InvoiceUncheckedCreateWithoutAccountInput> | InvoiceCreateWithoutAccountInput[] | InvoiceUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: InvoiceCreateOrConnectWithoutAccountInput | InvoiceCreateOrConnectWithoutAccountInput[]
    createMany?: InvoiceCreateManyAccountInputEnvelope
    connect?: InvoiceWhereUniqueInput | InvoiceWhereUniqueInput[]
  }

  export type PlanChangeCreateNestedManyWithoutAccountInput = {
    create?: XOR<PlanChangeCreateWithoutAccountInput, PlanChangeUncheckedCreateWithoutAccountInput> | PlanChangeCreateWithoutAccountInput[] | PlanChangeUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: PlanChangeCreateOrConnectWithoutAccountInput | PlanChangeCreateOrConnectWithoutAccountInput[]
    createMany?: PlanChangeCreateManyAccountInputEnvelope
    connect?: PlanChangeWhereUniqueInput | PlanChangeWhereUniqueInput[]
  }

  export type OnboardingStepUncheckedCreateNestedManyWithoutAccountInput = {
    create?: XOR<OnboardingStepCreateWithoutAccountInput, OnboardingStepUncheckedCreateWithoutAccountInput> | OnboardingStepCreateWithoutAccountInput[] | OnboardingStepUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: OnboardingStepCreateOrConnectWithoutAccountInput | OnboardingStepCreateOrConnectWithoutAccountInput[]
    createMany?: OnboardingStepCreateManyAccountInputEnvelope
    connect?: OnboardingStepWhereUniqueInput | OnboardingStepWhereUniqueInput[]
  }

  export type ActivityLogUncheckedCreateNestedManyWithoutAccountInput = {
    create?: XOR<ActivityLogCreateWithoutAccountInput, ActivityLogUncheckedCreateWithoutAccountInput> | ActivityLogCreateWithoutAccountInput[] | ActivityLogUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: ActivityLogCreateOrConnectWithoutAccountInput | ActivityLogCreateOrConnectWithoutAccountInput[]
    createMany?: ActivityLogCreateManyAccountInputEnvelope
    connect?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
  }

  export type HealthCheckUncheckedCreateNestedManyWithoutAccountInput = {
    create?: XOR<HealthCheckCreateWithoutAccountInput, HealthCheckUncheckedCreateWithoutAccountInput> | HealthCheckCreateWithoutAccountInput[] | HealthCheckUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: HealthCheckCreateOrConnectWithoutAccountInput | HealthCheckCreateOrConnectWithoutAccountInput[]
    createMany?: HealthCheckCreateManyAccountInputEnvelope
    connect?: HealthCheckWhereUniqueInput | HealthCheckWhereUniqueInput[]
  }

  export type InvoiceUncheckedCreateNestedManyWithoutAccountInput = {
    create?: XOR<InvoiceCreateWithoutAccountInput, InvoiceUncheckedCreateWithoutAccountInput> | InvoiceCreateWithoutAccountInput[] | InvoiceUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: InvoiceCreateOrConnectWithoutAccountInput | InvoiceCreateOrConnectWithoutAccountInput[]
    createMany?: InvoiceCreateManyAccountInputEnvelope
    connect?: InvoiceWhereUniqueInput | InvoiceWhereUniqueInput[]
  }

  export type PlanChangeUncheckedCreateNestedManyWithoutAccountInput = {
    create?: XOR<PlanChangeCreateWithoutAccountInput, PlanChangeUncheckedCreateWithoutAccountInput> | PlanChangeCreateWithoutAccountInput[] | PlanChangeUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: PlanChangeCreateOrConnectWithoutAccountInput | PlanChangeCreateOrConnectWithoutAccountInput[]
    createMany?: PlanChangeCreateManyAccountInputEnvelope
    connect?: PlanChangeWhereUniqueInput | PlanChangeWhereUniqueInput[]
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type EnumAccountStatusFieldUpdateOperationsInput = {
    set?: $Enums.AccountStatus
  }

  export type EnumPlanTierFieldUpdateOperationsInput = {
    set?: $Enums.PlanTier
  }

  export type NullableDecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string | null
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type EnumBillingCycleFieldUpdateOperationsInput = {
    set?: $Enums.BillingCycle
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type EnumPricingModelFieldUpdateOperationsInput = {
    set?: $Enums.PricingModel
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableEnumPlanTierFieldUpdateOperationsInput = {
    set?: $Enums.PlanTier | null
  }

  export type NullableBoolFieldUpdateOperationsInput = {
    set?: boolean | null
  }

  export type OnboardingStepUpdateManyWithoutAccountNestedInput = {
    create?: XOR<OnboardingStepCreateWithoutAccountInput, OnboardingStepUncheckedCreateWithoutAccountInput> | OnboardingStepCreateWithoutAccountInput[] | OnboardingStepUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: OnboardingStepCreateOrConnectWithoutAccountInput | OnboardingStepCreateOrConnectWithoutAccountInput[]
    upsert?: OnboardingStepUpsertWithWhereUniqueWithoutAccountInput | OnboardingStepUpsertWithWhereUniqueWithoutAccountInput[]
    createMany?: OnboardingStepCreateManyAccountInputEnvelope
    set?: OnboardingStepWhereUniqueInput | OnboardingStepWhereUniqueInput[]
    disconnect?: OnboardingStepWhereUniqueInput | OnboardingStepWhereUniqueInput[]
    delete?: OnboardingStepWhereUniqueInput | OnboardingStepWhereUniqueInput[]
    connect?: OnboardingStepWhereUniqueInput | OnboardingStepWhereUniqueInput[]
    update?: OnboardingStepUpdateWithWhereUniqueWithoutAccountInput | OnboardingStepUpdateWithWhereUniqueWithoutAccountInput[]
    updateMany?: OnboardingStepUpdateManyWithWhereWithoutAccountInput | OnboardingStepUpdateManyWithWhereWithoutAccountInput[]
    deleteMany?: OnboardingStepScalarWhereInput | OnboardingStepScalarWhereInput[]
  }

  export type ActivityLogUpdateManyWithoutAccountNestedInput = {
    create?: XOR<ActivityLogCreateWithoutAccountInput, ActivityLogUncheckedCreateWithoutAccountInput> | ActivityLogCreateWithoutAccountInput[] | ActivityLogUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: ActivityLogCreateOrConnectWithoutAccountInput | ActivityLogCreateOrConnectWithoutAccountInput[]
    upsert?: ActivityLogUpsertWithWhereUniqueWithoutAccountInput | ActivityLogUpsertWithWhereUniqueWithoutAccountInput[]
    createMany?: ActivityLogCreateManyAccountInputEnvelope
    set?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    disconnect?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    delete?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    connect?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    update?: ActivityLogUpdateWithWhereUniqueWithoutAccountInput | ActivityLogUpdateWithWhereUniqueWithoutAccountInput[]
    updateMany?: ActivityLogUpdateManyWithWhereWithoutAccountInput | ActivityLogUpdateManyWithWhereWithoutAccountInput[]
    deleteMany?: ActivityLogScalarWhereInput | ActivityLogScalarWhereInput[]
  }

  export type HealthCheckUpdateManyWithoutAccountNestedInput = {
    create?: XOR<HealthCheckCreateWithoutAccountInput, HealthCheckUncheckedCreateWithoutAccountInput> | HealthCheckCreateWithoutAccountInput[] | HealthCheckUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: HealthCheckCreateOrConnectWithoutAccountInput | HealthCheckCreateOrConnectWithoutAccountInput[]
    upsert?: HealthCheckUpsertWithWhereUniqueWithoutAccountInput | HealthCheckUpsertWithWhereUniqueWithoutAccountInput[]
    createMany?: HealthCheckCreateManyAccountInputEnvelope
    set?: HealthCheckWhereUniqueInput | HealthCheckWhereUniqueInput[]
    disconnect?: HealthCheckWhereUniqueInput | HealthCheckWhereUniqueInput[]
    delete?: HealthCheckWhereUniqueInput | HealthCheckWhereUniqueInput[]
    connect?: HealthCheckWhereUniqueInput | HealthCheckWhereUniqueInput[]
    update?: HealthCheckUpdateWithWhereUniqueWithoutAccountInput | HealthCheckUpdateWithWhereUniqueWithoutAccountInput[]
    updateMany?: HealthCheckUpdateManyWithWhereWithoutAccountInput | HealthCheckUpdateManyWithWhereWithoutAccountInput[]
    deleteMany?: HealthCheckScalarWhereInput | HealthCheckScalarWhereInput[]
  }

  export type InvoiceUpdateManyWithoutAccountNestedInput = {
    create?: XOR<InvoiceCreateWithoutAccountInput, InvoiceUncheckedCreateWithoutAccountInput> | InvoiceCreateWithoutAccountInput[] | InvoiceUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: InvoiceCreateOrConnectWithoutAccountInput | InvoiceCreateOrConnectWithoutAccountInput[]
    upsert?: InvoiceUpsertWithWhereUniqueWithoutAccountInput | InvoiceUpsertWithWhereUniqueWithoutAccountInput[]
    createMany?: InvoiceCreateManyAccountInputEnvelope
    set?: InvoiceWhereUniqueInput | InvoiceWhereUniqueInput[]
    disconnect?: InvoiceWhereUniqueInput | InvoiceWhereUniqueInput[]
    delete?: InvoiceWhereUniqueInput | InvoiceWhereUniqueInput[]
    connect?: InvoiceWhereUniqueInput | InvoiceWhereUniqueInput[]
    update?: InvoiceUpdateWithWhereUniqueWithoutAccountInput | InvoiceUpdateWithWhereUniqueWithoutAccountInput[]
    updateMany?: InvoiceUpdateManyWithWhereWithoutAccountInput | InvoiceUpdateManyWithWhereWithoutAccountInput[]
    deleteMany?: InvoiceScalarWhereInput | InvoiceScalarWhereInput[]
  }

  export type PlanChangeUpdateManyWithoutAccountNestedInput = {
    create?: XOR<PlanChangeCreateWithoutAccountInput, PlanChangeUncheckedCreateWithoutAccountInput> | PlanChangeCreateWithoutAccountInput[] | PlanChangeUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: PlanChangeCreateOrConnectWithoutAccountInput | PlanChangeCreateOrConnectWithoutAccountInput[]
    upsert?: PlanChangeUpsertWithWhereUniqueWithoutAccountInput | PlanChangeUpsertWithWhereUniqueWithoutAccountInput[]
    createMany?: PlanChangeCreateManyAccountInputEnvelope
    set?: PlanChangeWhereUniqueInput | PlanChangeWhereUniqueInput[]
    disconnect?: PlanChangeWhereUniqueInput | PlanChangeWhereUniqueInput[]
    delete?: PlanChangeWhereUniqueInput | PlanChangeWhereUniqueInput[]
    connect?: PlanChangeWhereUniqueInput | PlanChangeWhereUniqueInput[]
    update?: PlanChangeUpdateWithWhereUniqueWithoutAccountInput | PlanChangeUpdateWithWhereUniqueWithoutAccountInput[]
    updateMany?: PlanChangeUpdateManyWithWhereWithoutAccountInput | PlanChangeUpdateManyWithWhereWithoutAccountInput[]
    deleteMany?: PlanChangeScalarWhereInput | PlanChangeScalarWhereInput[]
  }

  export type OnboardingStepUncheckedUpdateManyWithoutAccountNestedInput = {
    create?: XOR<OnboardingStepCreateWithoutAccountInput, OnboardingStepUncheckedCreateWithoutAccountInput> | OnboardingStepCreateWithoutAccountInput[] | OnboardingStepUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: OnboardingStepCreateOrConnectWithoutAccountInput | OnboardingStepCreateOrConnectWithoutAccountInput[]
    upsert?: OnboardingStepUpsertWithWhereUniqueWithoutAccountInput | OnboardingStepUpsertWithWhereUniqueWithoutAccountInput[]
    createMany?: OnboardingStepCreateManyAccountInputEnvelope
    set?: OnboardingStepWhereUniqueInput | OnboardingStepWhereUniqueInput[]
    disconnect?: OnboardingStepWhereUniqueInput | OnboardingStepWhereUniqueInput[]
    delete?: OnboardingStepWhereUniqueInput | OnboardingStepWhereUniqueInput[]
    connect?: OnboardingStepWhereUniqueInput | OnboardingStepWhereUniqueInput[]
    update?: OnboardingStepUpdateWithWhereUniqueWithoutAccountInput | OnboardingStepUpdateWithWhereUniqueWithoutAccountInput[]
    updateMany?: OnboardingStepUpdateManyWithWhereWithoutAccountInput | OnboardingStepUpdateManyWithWhereWithoutAccountInput[]
    deleteMany?: OnboardingStepScalarWhereInput | OnboardingStepScalarWhereInput[]
  }

  export type ActivityLogUncheckedUpdateManyWithoutAccountNestedInput = {
    create?: XOR<ActivityLogCreateWithoutAccountInput, ActivityLogUncheckedCreateWithoutAccountInput> | ActivityLogCreateWithoutAccountInput[] | ActivityLogUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: ActivityLogCreateOrConnectWithoutAccountInput | ActivityLogCreateOrConnectWithoutAccountInput[]
    upsert?: ActivityLogUpsertWithWhereUniqueWithoutAccountInput | ActivityLogUpsertWithWhereUniqueWithoutAccountInput[]
    createMany?: ActivityLogCreateManyAccountInputEnvelope
    set?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    disconnect?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    delete?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    connect?: ActivityLogWhereUniqueInput | ActivityLogWhereUniqueInput[]
    update?: ActivityLogUpdateWithWhereUniqueWithoutAccountInput | ActivityLogUpdateWithWhereUniqueWithoutAccountInput[]
    updateMany?: ActivityLogUpdateManyWithWhereWithoutAccountInput | ActivityLogUpdateManyWithWhereWithoutAccountInput[]
    deleteMany?: ActivityLogScalarWhereInput | ActivityLogScalarWhereInput[]
  }

  export type HealthCheckUncheckedUpdateManyWithoutAccountNestedInput = {
    create?: XOR<HealthCheckCreateWithoutAccountInput, HealthCheckUncheckedCreateWithoutAccountInput> | HealthCheckCreateWithoutAccountInput[] | HealthCheckUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: HealthCheckCreateOrConnectWithoutAccountInput | HealthCheckCreateOrConnectWithoutAccountInput[]
    upsert?: HealthCheckUpsertWithWhereUniqueWithoutAccountInput | HealthCheckUpsertWithWhereUniqueWithoutAccountInput[]
    createMany?: HealthCheckCreateManyAccountInputEnvelope
    set?: HealthCheckWhereUniqueInput | HealthCheckWhereUniqueInput[]
    disconnect?: HealthCheckWhereUniqueInput | HealthCheckWhereUniqueInput[]
    delete?: HealthCheckWhereUniqueInput | HealthCheckWhereUniqueInput[]
    connect?: HealthCheckWhereUniqueInput | HealthCheckWhereUniqueInput[]
    update?: HealthCheckUpdateWithWhereUniqueWithoutAccountInput | HealthCheckUpdateWithWhereUniqueWithoutAccountInput[]
    updateMany?: HealthCheckUpdateManyWithWhereWithoutAccountInput | HealthCheckUpdateManyWithWhereWithoutAccountInput[]
    deleteMany?: HealthCheckScalarWhereInput | HealthCheckScalarWhereInput[]
  }

  export type InvoiceUncheckedUpdateManyWithoutAccountNestedInput = {
    create?: XOR<InvoiceCreateWithoutAccountInput, InvoiceUncheckedCreateWithoutAccountInput> | InvoiceCreateWithoutAccountInput[] | InvoiceUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: InvoiceCreateOrConnectWithoutAccountInput | InvoiceCreateOrConnectWithoutAccountInput[]
    upsert?: InvoiceUpsertWithWhereUniqueWithoutAccountInput | InvoiceUpsertWithWhereUniqueWithoutAccountInput[]
    createMany?: InvoiceCreateManyAccountInputEnvelope
    set?: InvoiceWhereUniqueInput | InvoiceWhereUniqueInput[]
    disconnect?: InvoiceWhereUniqueInput | InvoiceWhereUniqueInput[]
    delete?: InvoiceWhereUniqueInput | InvoiceWhereUniqueInput[]
    connect?: InvoiceWhereUniqueInput | InvoiceWhereUniqueInput[]
    update?: InvoiceUpdateWithWhereUniqueWithoutAccountInput | InvoiceUpdateWithWhereUniqueWithoutAccountInput[]
    updateMany?: InvoiceUpdateManyWithWhereWithoutAccountInput | InvoiceUpdateManyWithWhereWithoutAccountInput[]
    deleteMany?: InvoiceScalarWhereInput | InvoiceScalarWhereInput[]
  }

  export type PlanChangeUncheckedUpdateManyWithoutAccountNestedInput = {
    create?: XOR<PlanChangeCreateWithoutAccountInput, PlanChangeUncheckedCreateWithoutAccountInput> | PlanChangeCreateWithoutAccountInput[] | PlanChangeUncheckedCreateWithoutAccountInput[]
    connectOrCreate?: PlanChangeCreateOrConnectWithoutAccountInput | PlanChangeCreateOrConnectWithoutAccountInput[]
    upsert?: PlanChangeUpsertWithWhereUniqueWithoutAccountInput | PlanChangeUpsertWithWhereUniqueWithoutAccountInput[]
    createMany?: PlanChangeCreateManyAccountInputEnvelope
    set?: PlanChangeWhereUniqueInput | PlanChangeWhereUniqueInput[]
    disconnect?: PlanChangeWhereUniqueInput | PlanChangeWhereUniqueInput[]
    delete?: PlanChangeWhereUniqueInput | PlanChangeWhereUniqueInput[]
    connect?: PlanChangeWhereUniqueInput | PlanChangeWhereUniqueInput[]
    update?: PlanChangeUpdateWithWhereUniqueWithoutAccountInput | PlanChangeUpdateWithWhereUniqueWithoutAccountInput[]
    updateMany?: PlanChangeUpdateManyWithWhereWithoutAccountInput | PlanChangeUpdateManyWithWhereWithoutAccountInput[]
    deleteMany?: PlanChangeScalarWhereInput | PlanChangeScalarWhereInput[]
  }

  export type ClinicAccountCreateNestedOneWithoutStepsInput = {
    create?: XOR<ClinicAccountCreateWithoutStepsInput, ClinicAccountUncheckedCreateWithoutStepsInput>
    connectOrCreate?: ClinicAccountCreateOrConnectWithoutStepsInput
    connect?: ClinicAccountWhereUniqueInput
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type ClinicAccountUpdateOneRequiredWithoutStepsNestedInput = {
    create?: XOR<ClinicAccountCreateWithoutStepsInput, ClinicAccountUncheckedCreateWithoutStepsInput>
    connectOrCreate?: ClinicAccountCreateOrConnectWithoutStepsInput
    upsert?: ClinicAccountUpsertWithoutStepsInput
    connect?: ClinicAccountWhereUniqueInput
    update?: XOR<XOR<ClinicAccountUpdateToOneWithWhereWithoutStepsInput, ClinicAccountUpdateWithoutStepsInput>, ClinicAccountUncheckedUpdateWithoutStepsInput>
  }

  export type ClinicAccountCreateNestedOneWithoutActivityInput = {
    create?: XOR<ClinicAccountCreateWithoutActivityInput, ClinicAccountUncheckedCreateWithoutActivityInput>
    connectOrCreate?: ClinicAccountCreateOrConnectWithoutActivityInput
    connect?: ClinicAccountWhereUniqueInput
  }

  export type ProviderUserCreateNestedOneWithoutActivityInput = {
    create?: XOR<ProviderUserCreateWithoutActivityInput, ProviderUserUncheckedCreateWithoutActivityInput>
    connectOrCreate?: ProviderUserCreateOrConnectWithoutActivityInput
    connect?: ProviderUserWhereUniqueInput
  }

  export type ClinicAccountUpdateOneWithoutActivityNestedInput = {
    create?: XOR<ClinicAccountCreateWithoutActivityInput, ClinicAccountUncheckedCreateWithoutActivityInput>
    connectOrCreate?: ClinicAccountCreateOrConnectWithoutActivityInput
    upsert?: ClinicAccountUpsertWithoutActivityInput
    disconnect?: ClinicAccountWhereInput | boolean
    delete?: ClinicAccountWhereInput | boolean
    connect?: ClinicAccountWhereUniqueInput
    update?: XOR<XOR<ClinicAccountUpdateToOneWithWhereWithoutActivityInput, ClinicAccountUpdateWithoutActivityInput>, ClinicAccountUncheckedUpdateWithoutActivityInput>
  }

  export type ProviderUserUpdateOneWithoutActivityNestedInput = {
    create?: XOR<ProviderUserCreateWithoutActivityInput, ProviderUserUncheckedCreateWithoutActivityInput>
    connectOrCreate?: ProviderUserCreateOrConnectWithoutActivityInput
    upsert?: ProviderUserUpsertWithoutActivityInput
    disconnect?: ProviderUserWhereInput | boolean
    delete?: ProviderUserWhereInput | boolean
    connect?: ProviderUserWhereUniqueInput
    update?: XOR<XOR<ProviderUserUpdateToOneWithWhereWithoutActivityInput, ProviderUserUpdateWithoutActivityInput>, ProviderUserUncheckedUpdateWithoutActivityInput>
  }

  export type ClinicAccountCreateNestedOneWithoutHealthInput = {
    create?: XOR<ClinicAccountCreateWithoutHealthInput, ClinicAccountUncheckedCreateWithoutHealthInput>
    connectOrCreate?: ClinicAccountCreateOrConnectWithoutHealthInput
    connect?: ClinicAccountWhereUniqueInput
  }

  export type ClinicAccountUpdateOneRequiredWithoutHealthNestedInput = {
    create?: XOR<ClinicAccountCreateWithoutHealthInput, ClinicAccountUncheckedCreateWithoutHealthInput>
    connectOrCreate?: ClinicAccountCreateOrConnectWithoutHealthInput
    upsert?: ClinicAccountUpsertWithoutHealthInput
    connect?: ClinicAccountWhereUniqueInput
    update?: XOR<XOR<ClinicAccountUpdateToOneWithWhereWithoutHealthInput, ClinicAccountUpdateWithoutHealthInput>, ClinicAccountUncheckedUpdateWithoutHealthInput>
  }

  export type ClinicAccountCreateNestedOneWithoutInvoicesInput = {
    create?: XOR<ClinicAccountCreateWithoutInvoicesInput, ClinicAccountUncheckedCreateWithoutInvoicesInput>
    connectOrCreate?: ClinicAccountCreateOrConnectWithoutInvoicesInput
    connect?: ClinicAccountWhereUniqueInput
  }

  export type EnumInvoiceStatusFieldUpdateOperationsInput = {
    set?: $Enums.InvoiceStatus
  }

  export type DecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type ClinicAccountUpdateOneRequiredWithoutInvoicesNestedInput = {
    create?: XOR<ClinicAccountCreateWithoutInvoicesInput, ClinicAccountUncheckedCreateWithoutInvoicesInput>
    connectOrCreate?: ClinicAccountCreateOrConnectWithoutInvoicesInput
    upsert?: ClinicAccountUpsertWithoutInvoicesInput
    connect?: ClinicAccountWhereUniqueInput
    update?: XOR<XOR<ClinicAccountUpdateToOneWithWhereWithoutInvoicesInput, ClinicAccountUpdateWithoutInvoicesInput>, ClinicAccountUncheckedUpdateWithoutInvoicesInput>
  }

  export type ClinicAccountCreateNestedOneWithoutPlanChangesInput = {
    create?: XOR<ClinicAccountCreateWithoutPlanChangesInput, ClinicAccountUncheckedCreateWithoutPlanChangesInput>
    connectOrCreate?: ClinicAccountCreateOrConnectWithoutPlanChangesInput
    connect?: ClinicAccountWhereUniqueInput
  }

  export type ClinicAccountUpdateOneRequiredWithoutPlanChangesNestedInput = {
    create?: XOR<ClinicAccountCreateWithoutPlanChangesInput, ClinicAccountUncheckedCreateWithoutPlanChangesInput>
    connectOrCreate?: ClinicAccountCreateOrConnectWithoutPlanChangesInput
    upsert?: ClinicAccountUpsertWithoutPlanChangesInput
    connect?: ClinicAccountWhereUniqueInput
    update?: XOR<XOR<ClinicAccountUpdateToOneWithWhereWithoutPlanChangesInput, ClinicAccountUpdateWithoutPlanChangesInput>, ClinicAccountUncheckedUpdateWithoutPlanChangesInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedEnumProviderRoleFilter<$PrismaModel = never> = {
    equals?: $Enums.ProviderRole | EnumProviderRoleFieldRefInput<$PrismaModel>
    in?: $Enums.ProviderRole[] | ListEnumProviderRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.ProviderRole[] | ListEnumProviderRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumProviderRoleFilter<$PrismaModel> | $Enums.ProviderRole
  }

  export type NestedBoolFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolFilter<$PrismaModel> | boolean
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedEnumProviderRoleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.ProviderRole | EnumProviderRoleFieldRefInput<$PrismaModel>
    in?: $Enums.ProviderRole[] | ListEnumProviderRoleFieldRefInput<$PrismaModel>
    notIn?: $Enums.ProviderRole[] | ListEnumProviderRoleFieldRefInput<$PrismaModel>
    not?: NestedEnumProviderRoleWithAggregatesFilter<$PrismaModel> | $Enums.ProviderRole
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumProviderRoleFilter<$PrismaModel>
    _max?: NestedEnumProviderRoleFilter<$PrismaModel>
  }

  export type NestedBoolWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel>
    not?: NestedBoolWithAggregatesFilter<$PrismaModel> | boolean
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedBoolFilter<$PrismaModel>
    _max?: NestedBoolFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedEnumAccountStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.AccountStatus | EnumAccountStatusFieldRefInput<$PrismaModel>
    in?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumAccountStatusFilter<$PrismaModel> | $Enums.AccountStatus
  }

  export type NestedEnumPlanTierFilter<$PrismaModel = never> = {
    equals?: $Enums.PlanTier | EnumPlanTierFieldRefInput<$PrismaModel>
    in?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel>
    notIn?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel>
    not?: NestedEnumPlanTierFilter<$PrismaModel> | $Enums.PlanTier
  }

  export type NestedDecimalNullableFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
  }

  export type NestedEnumBillingCycleFilter<$PrismaModel = never> = {
    equals?: $Enums.BillingCycle | EnumBillingCycleFieldRefInput<$PrismaModel>
    in?: $Enums.BillingCycle[] | ListEnumBillingCycleFieldRefInput<$PrismaModel>
    notIn?: $Enums.BillingCycle[] | ListEnumBillingCycleFieldRefInput<$PrismaModel>
    not?: NestedEnumBillingCycleFilter<$PrismaModel> | $Enums.BillingCycle
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedEnumPricingModelFilter<$PrismaModel = never> = {
    equals?: $Enums.PricingModel | EnumPricingModelFieldRefInput<$PrismaModel>
    in?: $Enums.PricingModel[] | ListEnumPricingModelFieldRefInput<$PrismaModel>
    notIn?: $Enums.PricingModel[] | ListEnumPricingModelFieldRefInput<$PrismaModel>
    not?: NestedEnumPricingModelFilter<$PrismaModel> | $Enums.PricingModel
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedEnumPlanTierNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.PlanTier | EnumPlanTierFieldRefInput<$PrismaModel> | null
    in?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel> | null
    not?: NestedEnumPlanTierNullableFilter<$PrismaModel> | $Enums.PlanTier | null
  }

  export type NestedBoolNullableFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableFilter<$PrismaModel> | boolean | null
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedEnumAccountStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.AccountStatus | EnumAccountStatusFieldRefInput<$PrismaModel>
    in?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.AccountStatus[] | ListEnumAccountStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumAccountStatusWithAggregatesFilter<$PrismaModel> | $Enums.AccountStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumAccountStatusFilter<$PrismaModel>
    _max?: NestedEnumAccountStatusFilter<$PrismaModel>
  }

  export type NestedEnumPlanTierWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PlanTier | EnumPlanTierFieldRefInput<$PrismaModel>
    in?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel>
    notIn?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel>
    not?: NestedEnumPlanTierWithAggregatesFilter<$PrismaModel> | $Enums.PlanTier
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPlanTierFilter<$PrismaModel>
    _max?: NestedEnumPlanTierFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedDecimalNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel> | null
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel> | null
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalNullableWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedDecimalNullableFilter<$PrismaModel>
    _sum?: NestedDecimalNullableFilter<$PrismaModel>
    _min?: NestedDecimalNullableFilter<$PrismaModel>
    _max?: NestedDecimalNullableFilter<$PrismaModel>
  }

  export type NestedEnumBillingCycleWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.BillingCycle | EnumBillingCycleFieldRefInput<$PrismaModel>
    in?: $Enums.BillingCycle[] | ListEnumBillingCycleFieldRefInput<$PrismaModel>
    notIn?: $Enums.BillingCycle[] | ListEnumBillingCycleFieldRefInput<$PrismaModel>
    not?: NestedEnumBillingCycleWithAggregatesFilter<$PrismaModel> | $Enums.BillingCycle
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumBillingCycleFilter<$PrismaModel>
    _max?: NestedEnumBillingCycleFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedEnumPricingModelWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PricingModel | EnumPricingModelFieldRefInput<$PrismaModel>
    in?: $Enums.PricingModel[] | ListEnumPricingModelFieldRefInput<$PrismaModel>
    notIn?: $Enums.PricingModel[] | ListEnumPricingModelFieldRefInput<$PrismaModel>
    not?: NestedEnumPricingModelWithAggregatesFilter<$PrismaModel> | $Enums.PricingModel
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumPricingModelFilter<$PrismaModel>
    _max?: NestedEnumPricingModelFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedEnumPlanTierNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.PlanTier | EnumPlanTierFieldRefInput<$PrismaModel> | null
    in?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.PlanTier[] | ListEnumPlanTierFieldRefInput<$PrismaModel> | null
    not?: NestedEnumPlanTierNullableWithAggregatesFilter<$PrismaModel> | $Enums.PlanTier | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumPlanTierNullableFilter<$PrismaModel>
    _max?: NestedEnumPlanTierNullableFilter<$PrismaModel>
  }

  export type NestedBoolNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableWithAggregatesFilter<$PrismaModel> | boolean | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedBoolNullableFilter<$PrismaModel>
    _max?: NestedBoolNullableFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedEnumInvoiceStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.InvoiceStatus | EnumInvoiceStatusFieldRefInput<$PrismaModel>
    in?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumInvoiceStatusFilter<$PrismaModel> | $Enums.InvoiceStatus
  }

  export type NestedDecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type NestedEnumInvoiceStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.InvoiceStatus | EnumInvoiceStatusFieldRefInput<$PrismaModel>
    in?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.InvoiceStatus[] | ListEnumInvoiceStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumInvoiceStatusWithAggregatesFilter<$PrismaModel> | $Enums.InvoiceStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumInvoiceStatusFilter<$PrismaModel>
    _max?: NestedEnumInvoiceStatusFilter<$PrismaModel>
  }
  export type NestedJsonFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedDecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type ActivityLogCreateWithoutActorInput = {
    id?: string
    actorName: string
    action: string
    detail?: string | null
    applied?: boolean
    at?: Date | string
    account?: ClinicAccountCreateNestedOneWithoutActivityInput
  }

  export type ActivityLogUncheckedCreateWithoutActorInput = {
    id?: string
    accountId?: string | null
    actorName: string
    action: string
    detail?: string | null
    applied?: boolean
    at?: Date | string
  }

  export type ActivityLogCreateOrConnectWithoutActorInput = {
    where: ActivityLogWhereUniqueInput
    create: XOR<ActivityLogCreateWithoutActorInput, ActivityLogUncheckedCreateWithoutActorInput>
  }

  export type ActivityLogCreateManyActorInputEnvelope = {
    data: ActivityLogCreateManyActorInput | ActivityLogCreateManyActorInput[]
    skipDuplicates?: boolean
  }

  export type ActivityLogUpsertWithWhereUniqueWithoutActorInput = {
    where: ActivityLogWhereUniqueInput
    update: XOR<ActivityLogUpdateWithoutActorInput, ActivityLogUncheckedUpdateWithoutActorInput>
    create: XOR<ActivityLogCreateWithoutActorInput, ActivityLogUncheckedCreateWithoutActorInput>
  }

  export type ActivityLogUpdateWithWhereUniqueWithoutActorInput = {
    where: ActivityLogWhereUniqueInput
    data: XOR<ActivityLogUpdateWithoutActorInput, ActivityLogUncheckedUpdateWithoutActorInput>
  }

  export type ActivityLogUpdateManyWithWhereWithoutActorInput = {
    where: ActivityLogScalarWhereInput
    data: XOR<ActivityLogUpdateManyMutationInput, ActivityLogUncheckedUpdateManyWithoutActorInput>
  }

  export type ActivityLogScalarWhereInput = {
    AND?: ActivityLogScalarWhereInput | ActivityLogScalarWhereInput[]
    OR?: ActivityLogScalarWhereInput[]
    NOT?: ActivityLogScalarWhereInput | ActivityLogScalarWhereInput[]
    id?: StringFilter<"ActivityLog"> | string
    accountId?: StringNullableFilter<"ActivityLog"> | string | null
    actorId?: StringNullableFilter<"ActivityLog"> | string | null
    actorName?: StringFilter<"ActivityLog"> | string
    action?: StringFilter<"ActivityLog"> | string
    detail?: StringNullableFilter<"ActivityLog"> | string | null
    applied?: BoolFilter<"ActivityLog"> | boolean
    at?: DateTimeFilter<"ActivityLog"> | Date | string
  }

  export type OnboardingStepCreateWithoutAccountInput = {
    id?: string
    key: string
    label: string
    automated?: boolean
    sortOrder?: number
    done?: boolean
    doneAt?: Date | string | null
    notes?: string | null
  }

  export type OnboardingStepUncheckedCreateWithoutAccountInput = {
    id?: string
    key: string
    label: string
    automated?: boolean
    sortOrder?: number
    done?: boolean
    doneAt?: Date | string | null
    notes?: string | null
  }

  export type OnboardingStepCreateOrConnectWithoutAccountInput = {
    where: OnboardingStepWhereUniqueInput
    create: XOR<OnboardingStepCreateWithoutAccountInput, OnboardingStepUncheckedCreateWithoutAccountInput>
  }

  export type OnboardingStepCreateManyAccountInputEnvelope = {
    data: OnboardingStepCreateManyAccountInput | OnboardingStepCreateManyAccountInput[]
    skipDuplicates?: boolean
  }

  export type ActivityLogCreateWithoutAccountInput = {
    id?: string
    actorName: string
    action: string
    detail?: string | null
    applied?: boolean
    at?: Date | string
    actor?: ProviderUserCreateNestedOneWithoutActivityInput
  }

  export type ActivityLogUncheckedCreateWithoutAccountInput = {
    id?: string
    actorId?: string | null
    actorName: string
    action: string
    detail?: string | null
    applied?: boolean
    at?: Date | string
  }

  export type ActivityLogCreateOrConnectWithoutAccountInput = {
    where: ActivityLogWhereUniqueInput
    create: XOR<ActivityLogCreateWithoutAccountInput, ActivityLogUncheckedCreateWithoutAccountInput>
  }

  export type ActivityLogCreateManyAccountInputEnvelope = {
    data: ActivityLogCreateManyAccountInput | ActivityLogCreateManyAccountInput[]
    skipDuplicates?: boolean
  }

  export type HealthCheckCreateWithoutAccountInput = {
    id?: string
    ok: boolean
    statusCode?: number | null
    latencyMs?: number | null
    error?: string | null
    checkedAt?: Date | string
  }

  export type HealthCheckUncheckedCreateWithoutAccountInput = {
    id?: string
    ok: boolean
    statusCode?: number | null
    latencyMs?: number | null
    error?: string | null
    checkedAt?: Date | string
  }

  export type HealthCheckCreateOrConnectWithoutAccountInput = {
    where: HealthCheckWhereUniqueInput
    create: XOR<HealthCheckCreateWithoutAccountInput, HealthCheckUncheckedCreateWithoutAccountInput>
  }

  export type HealthCheckCreateManyAccountInputEnvelope = {
    data: HealthCheckCreateManyAccountInput | HealthCheckCreateManyAccountInput[]
    skipDuplicates?: boolean
  }

  export type InvoiceCreateWithoutAccountInput = {
    id?: string
    number?: string | null
    fy?: string | null
    serial?: number | null
    status?: $Enums.InvoiceStatus
    issuedAt?: Date | string | null
    dueAt?: Date | string | null
    periodStart?: Date | string | null
    isFirst?: boolean
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    placeOfSupply?: string | null
    planLabel: string
    lines: JsonNullValueInput | InputJsonValue
    subtotal: Decimal | DecimalJsLike | number | string
    cgst: Decimal | DecimalJsLike | number | string
    sgst: Decimal | DecimalJsLike | number | string
    igst: Decimal | DecimalJsLike | number | string
    total: Decimal | DecimalJsLike | number | string
    paidAt?: Date | string | null
    paymentMode?: string | null
    paymentRef?: string | null
    notes?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type InvoiceUncheckedCreateWithoutAccountInput = {
    id?: string
    number?: string | null
    fy?: string | null
    serial?: number | null
    status?: $Enums.InvoiceStatus
    issuedAt?: Date | string | null
    dueAt?: Date | string | null
    periodStart?: Date | string | null
    isFirst?: boolean
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    placeOfSupply?: string | null
    planLabel: string
    lines: JsonNullValueInput | InputJsonValue
    subtotal: Decimal | DecimalJsLike | number | string
    cgst: Decimal | DecimalJsLike | number | string
    sgst: Decimal | DecimalJsLike | number | string
    igst: Decimal | DecimalJsLike | number | string
    total: Decimal | DecimalJsLike | number | string
    paidAt?: Date | string | null
    paymentMode?: string | null
    paymentRef?: string | null
    notes?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type InvoiceCreateOrConnectWithoutAccountInput = {
    where: InvoiceWhereUniqueInput
    create: XOR<InvoiceCreateWithoutAccountInput, InvoiceUncheckedCreateWithoutAccountInput>
  }

  export type InvoiceCreateManyAccountInputEnvelope = {
    data: InvoiceCreateManyAccountInput | InvoiceCreateManyAccountInput[]
    skipDuplicates?: boolean
  }

  export type PlanChangeCreateWithoutAccountInput = {
    id?: string
    fromPlan?: $Enums.PlanTier | null
    toPlan: $Enums.PlanTier
    fromFeatures?: string | null
    toFeatures: string
    readOnly?: boolean
    reason?: string | null
    actorName: string
    jobId?: string | null
    at?: Date | string
  }

  export type PlanChangeUncheckedCreateWithoutAccountInput = {
    id?: string
    fromPlan?: $Enums.PlanTier | null
    toPlan: $Enums.PlanTier
    fromFeatures?: string | null
    toFeatures: string
    readOnly?: boolean
    reason?: string | null
    actorName: string
    jobId?: string | null
    at?: Date | string
  }

  export type PlanChangeCreateOrConnectWithoutAccountInput = {
    where: PlanChangeWhereUniqueInput
    create: XOR<PlanChangeCreateWithoutAccountInput, PlanChangeUncheckedCreateWithoutAccountInput>
  }

  export type PlanChangeCreateManyAccountInputEnvelope = {
    data: PlanChangeCreateManyAccountInput | PlanChangeCreateManyAccountInput[]
    skipDuplicates?: boolean
  }

  export type OnboardingStepUpsertWithWhereUniqueWithoutAccountInput = {
    where: OnboardingStepWhereUniqueInput
    update: XOR<OnboardingStepUpdateWithoutAccountInput, OnboardingStepUncheckedUpdateWithoutAccountInput>
    create: XOR<OnboardingStepCreateWithoutAccountInput, OnboardingStepUncheckedCreateWithoutAccountInput>
  }

  export type OnboardingStepUpdateWithWhereUniqueWithoutAccountInput = {
    where: OnboardingStepWhereUniqueInput
    data: XOR<OnboardingStepUpdateWithoutAccountInput, OnboardingStepUncheckedUpdateWithoutAccountInput>
  }

  export type OnboardingStepUpdateManyWithWhereWithoutAccountInput = {
    where: OnboardingStepScalarWhereInput
    data: XOR<OnboardingStepUpdateManyMutationInput, OnboardingStepUncheckedUpdateManyWithoutAccountInput>
  }

  export type OnboardingStepScalarWhereInput = {
    AND?: OnboardingStepScalarWhereInput | OnboardingStepScalarWhereInput[]
    OR?: OnboardingStepScalarWhereInput[]
    NOT?: OnboardingStepScalarWhereInput | OnboardingStepScalarWhereInput[]
    id?: StringFilter<"OnboardingStep"> | string
    accountId?: StringFilter<"OnboardingStep"> | string
    key?: StringFilter<"OnboardingStep"> | string
    label?: StringFilter<"OnboardingStep"> | string
    automated?: BoolFilter<"OnboardingStep"> | boolean
    sortOrder?: IntFilter<"OnboardingStep"> | number
    done?: BoolFilter<"OnboardingStep"> | boolean
    doneAt?: DateTimeNullableFilter<"OnboardingStep"> | Date | string | null
    notes?: StringNullableFilter<"OnboardingStep"> | string | null
  }

  export type ActivityLogUpsertWithWhereUniqueWithoutAccountInput = {
    where: ActivityLogWhereUniqueInput
    update: XOR<ActivityLogUpdateWithoutAccountInput, ActivityLogUncheckedUpdateWithoutAccountInput>
    create: XOR<ActivityLogCreateWithoutAccountInput, ActivityLogUncheckedCreateWithoutAccountInput>
  }

  export type ActivityLogUpdateWithWhereUniqueWithoutAccountInput = {
    where: ActivityLogWhereUniqueInput
    data: XOR<ActivityLogUpdateWithoutAccountInput, ActivityLogUncheckedUpdateWithoutAccountInput>
  }

  export type ActivityLogUpdateManyWithWhereWithoutAccountInput = {
    where: ActivityLogScalarWhereInput
    data: XOR<ActivityLogUpdateManyMutationInput, ActivityLogUncheckedUpdateManyWithoutAccountInput>
  }

  export type HealthCheckUpsertWithWhereUniqueWithoutAccountInput = {
    where: HealthCheckWhereUniqueInput
    update: XOR<HealthCheckUpdateWithoutAccountInput, HealthCheckUncheckedUpdateWithoutAccountInput>
    create: XOR<HealthCheckCreateWithoutAccountInput, HealthCheckUncheckedCreateWithoutAccountInput>
  }

  export type HealthCheckUpdateWithWhereUniqueWithoutAccountInput = {
    where: HealthCheckWhereUniqueInput
    data: XOR<HealthCheckUpdateWithoutAccountInput, HealthCheckUncheckedUpdateWithoutAccountInput>
  }

  export type HealthCheckUpdateManyWithWhereWithoutAccountInput = {
    where: HealthCheckScalarWhereInput
    data: XOR<HealthCheckUpdateManyMutationInput, HealthCheckUncheckedUpdateManyWithoutAccountInput>
  }

  export type HealthCheckScalarWhereInput = {
    AND?: HealthCheckScalarWhereInput | HealthCheckScalarWhereInput[]
    OR?: HealthCheckScalarWhereInput[]
    NOT?: HealthCheckScalarWhereInput | HealthCheckScalarWhereInput[]
    id?: StringFilter<"HealthCheck"> | string
    accountId?: StringFilter<"HealthCheck"> | string
    ok?: BoolFilter<"HealthCheck"> | boolean
    statusCode?: IntNullableFilter<"HealthCheck"> | number | null
    latencyMs?: IntNullableFilter<"HealthCheck"> | number | null
    error?: StringNullableFilter<"HealthCheck"> | string | null
    checkedAt?: DateTimeFilter<"HealthCheck"> | Date | string
  }

  export type InvoiceUpsertWithWhereUniqueWithoutAccountInput = {
    where: InvoiceWhereUniqueInput
    update: XOR<InvoiceUpdateWithoutAccountInput, InvoiceUncheckedUpdateWithoutAccountInput>
    create: XOR<InvoiceCreateWithoutAccountInput, InvoiceUncheckedCreateWithoutAccountInput>
  }

  export type InvoiceUpdateWithWhereUniqueWithoutAccountInput = {
    where: InvoiceWhereUniqueInput
    data: XOR<InvoiceUpdateWithoutAccountInput, InvoiceUncheckedUpdateWithoutAccountInput>
  }

  export type InvoiceUpdateManyWithWhereWithoutAccountInput = {
    where: InvoiceScalarWhereInput
    data: XOR<InvoiceUpdateManyMutationInput, InvoiceUncheckedUpdateManyWithoutAccountInput>
  }

  export type InvoiceScalarWhereInput = {
    AND?: InvoiceScalarWhereInput | InvoiceScalarWhereInput[]
    OR?: InvoiceScalarWhereInput[]
    NOT?: InvoiceScalarWhereInput | InvoiceScalarWhereInput[]
    id?: StringFilter<"Invoice"> | string
    accountId?: StringFilter<"Invoice"> | string
    number?: StringNullableFilter<"Invoice"> | string | null
    fy?: StringNullableFilter<"Invoice"> | string | null
    serial?: IntNullableFilter<"Invoice"> | number | null
    status?: EnumInvoiceStatusFilter<"Invoice"> | $Enums.InvoiceStatus
    issuedAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    dueAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    periodStart?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    isFirst?: BoolFilter<"Invoice"> | boolean
    billingName?: StringNullableFilter<"Invoice"> | string | null
    billingAddress?: StringNullableFilter<"Invoice"> | string | null
    gstin?: StringNullableFilter<"Invoice"> | string | null
    placeOfSupply?: StringNullableFilter<"Invoice"> | string | null
    planLabel?: StringFilter<"Invoice"> | string
    lines?: JsonFilter<"Invoice">
    subtotal?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    cgst?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    sgst?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    igst?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    total?: DecimalFilter<"Invoice"> | Decimal | DecimalJsLike | number | string
    paidAt?: DateTimeNullableFilter<"Invoice"> | Date | string | null
    paymentMode?: StringNullableFilter<"Invoice"> | string | null
    paymentRef?: StringNullableFilter<"Invoice"> | string | null
    notes?: StringNullableFilter<"Invoice"> | string | null
    createdAt?: DateTimeFilter<"Invoice"> | Date | string
    updatedAt?: DateTimeFilter<"Invoice"> | Date | string
  }

  export type PlanChangeUpsertWithWhereUniqueWithoutAccountInput = {
    where: PlanChangeWhereUniqueInput
    update: XOR<PlanChangeUpdateWithoutAccountInput, PlanChangeUncheckedUpdateWithoutAccountInput>
    create: XOR<PlanChangeCreateWithoutAccountInput, PlanChangeUncheckedCreateWithoutAccountInput>
  }

  export type PlanChangeUpdateWithWhereUniqueWithoutAccountInput = {
    where: PlanChangeWhereUniqueInput
    data: XOR<PlanChangeUpdateWithoutAccountInput, PlanChangeUncheckedUpdateWithoutAccountInput>
  }

  export type PlanChangeUpdateManyWithWhereWithoutAccountInput = {
    where: PlanChangeScalarWhereInput
    data: XOR<PlanChangeUpdateManyMutationInput, PlanChangeUncheckedUpdateManyWithoutAccountInput>
  }

  export type PlanChangeScalarWhereInput = {
    AND?: PlanChangeScalarWhereInput | PlanChangeScalarWhereInput[]
    OR?: PlanChangeScalarWhereInput[]
    NOT?: PlanChangeScalarWhereInput | PlanChangeScalarWhereInput[]
    id?: StringFilter<"PlanChange"> | string
    accountId?: StringFilter<"PlanChange"> | string
    fromPlan?: EnumPlanTierNullableFilter<"PlanChange"> | $Enums.PlanTier | null
    toPlan?: EnumPlanTierFilter<"PlanChange"> | $Enums.PlanTier
    fromFeatures?: StringNullableFilter<"PlanChange"> | string | null
    toFeatures?: StringFilter<"PlanChange"> | string
    readOnly?: BoolFilter<"PlanChange"> | boolean
    reason?: StringNullableFilter<"PlanChange"> | string | null
    actorName?: StringFilter<"PlanChange"> | string
    jobId?: StringNullableFilter<"PlanChange"> | string | null
    at?: DateTimeFilter<"PlanChange"> | Date | string
  }

  export type ClinicAccountCreateWithoutStepsInput = {
    id?: string
    slug: string
    name: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    city?: string | null
    notes?: string | null
    status?: $Enums.AccountStatus
    plan?: $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: Decimal | DecimalJsLike | number | string | null
    currency?: string
    billingCycle?: $Enums.BillingCycle
    startedAt?: Date | string | null
    renewsAt?: Date | string | null
    pricingModel?: $Enums.PricingModel
    setupFee?: Decimal | DecimalJsLike | number | string | null
    yearlyFee?: Decimal | DecimalJsLike | number | string | null
    licenceFee?: Decimal | DecimalJsLike | number | string | null
    amcPercent?: Decimal | DecimalJsLike | number | string | null
    hostingFee?: Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: number | null
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    billingState?: string | null
    appliedPlan?: $Enums.PlanTier | null
    appliedFeatures?: string | null
    appliedReadOnly?: boolean | null
    appliedAt?: Date | string | null
    planJobId?: string | null
    isDemo?: boolean
    publicDomain?: string | null
    portalDomain?: string | null
    apiDomain?: string | null
    neonProjectId?: string | null
    vercelWebProjectId?: string | null
    vercelApiProjectId?: string | null
    provisionedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    activity?: ActivityLogCreateNestedManyWithoutAccountInput
    health?: HealthCheckCreateNestedManyWithoutAccountInput
    invoices?: InvoiceCreateNestedManyWithoutAccountInput
    planChanges?: PlanChangeCreateNestedManyWithoutAccountInput
  }

  export type ClinicAccountUncheckedCreateWithoutStepsInput = {
    id?: string
    slug: string
    name: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    city?: string | null
    notes?: string | null
    status?: $Enums.AccountStatus
    plan?: $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: Decimal | DecimalJsLike | number | string | null
    currency?: string
    billingCycle?: $Enums.BillingCycle
    startedAt?: Date | string | null
    renewsAt?: Date | string | null
    pricingModel?: $Enums.PricingModel
    setupFee?: Decimal | DecimalJsLike | number | string | null
    yearlyFee?: Decimal | DecimalJsLike | number | string | null
    licenceFee?: Decimal | DecimalJsLike | number | string | null
    amcPercent?: Decimal | DecimalJsLike | number | string | null
    hostingFee?: Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: number | null
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    billingState?: string | null
    appliedPlan?: $Enums.PlanTier | null
    appliedFeatures?: string | null
    appliedReadOnly?: boolean | null
    appliedAt?: Date | string | null
    planJobId?: string | null
    isDemo?: boolean
    publicDomain?: string | null
    portalDomain?: string | null
    apiDomain?: string | null
    neonProjectId?: string | null
    vercelWebProjectId?: string | null
    vercelApiProjectId?: string | null
    provisionedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    activity?: ActivityLogUncheckedCreateNestedManyWithoutAccountInput
    health?: HealthCheckUncheckedCreateNestedManyWithoutAccountInput
    invoices?: InvoiceUncheckedCreateNestedManyWithoutAccountInput
    planChanges?: PlanChangeUncheckedCreateNestedManyWithoutAccountInput
  }

  export type ClinicAccountCreateOrConnectWithoutStepsInput = {
    where: ClinicAccountWhereUniqueInput
    create: XOR<ClinicAccountCreateWithoutStepsInput, ClinicAccountUncheckedCreateWithoutStepsInput>
  }

  export type ClinicAccountUpsertWithoutStepsInput = {
    update: XOR<ClinicAccountUpdateWithoutStepsInput, ClinicAccountUncheckedUpdateWithoutStepsInput>
    create: XOR<ClinicAccountCreateWithoutStepsInput, ClinicAccountUncheckedCreateWithoutStepsInput>
    where?: ClinicAccountWhereInput
  }

  export type ClinicAccountUpdateToOneWithWhereWithoutStepsInput = {
    where?: ClinicAccountWhereInput
    data: XOR<ClinicAccountUpdateWithoutStepsInput, ClinicAccountUncheckedUpdateWithoutStepsInput>
  }

  export type ClinicAccountUpdateWithoutStepsInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    activity?: ActivityLogUpdateManyWithoutAccountNestedInput
    health?: HealthCheckUpdateManyWithoutAccountNestedInput
    invoices?: InvoiceUpdateManyWithoutAccountNestedInput
    planChanges?: PlanChangeUpdateManyWithoutAccountNestedInput
  }

  export type ClinicAccountUncheckedUpdateWithoutStepsInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    activity?: ActivityLogUncheckedUpdateManyWithoutAccountNestedInput
    health?: HealthCheckUncheckedUpdateManyWithoutAccountNestedInput
    invoices?: InvoiceUncheckedUpdateManyWithoutAccountNestedInput
    planChanges?: PlanChangeUncheckedUpdateManyWithoutAccountNestedInput
  }

  export type ClinicAccountCreateWithoutActivityInput = {
    id?: string
    slug: string
    name: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    city?: string | null
    notes?: string | null
    status?: $Enums.AccountStatus
    plan?: $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: Decimal | DecimalJsLike | number | string | null
    currency?: string
    billingCycle?: $Enums.BillingCycle
    startedAt?: Date | string | null
    renewsAt?: Date | string | null
    pricingModel?: $Enums.PricingModel
    setupFee?: Decimal | DecimalJsLike | number | string | null
    yearlyFee?: Decimal | DecimalJsLike | number | string | null
    licenceFee?: Decimal | DecimalJsLike | number | string | null
    amcPercent?: Decimal | DecimalJsLike | number | string | null
    hostingFee?: Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: number | null
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    billingState?: string | null
    appliedPlan?: $Enums.PlanTier | null
    appliedFeatures?: string | null
    appliedReadOnly?: boolean | null
    appliedAt?: Date | string | null
    planJobId?: string | null
    isDemo?: boolean
    publicDomain?: string | null
    portalDomain?: string | null
    apiDomain?: string | null
    neonProjectId?: string | null
    vercelWebProjectId?: string | null
    vercelApiProjectId?: string | null
    provisionedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: OnboardingStepCreateNestedManyWithoutAccountInput
    health?: HealthCheckCreateNestedManyWithoutAccountInput
    invoices?: InvoiceCreateNestedManyWithoutAccountInput
    planChanges?: PlanChangeCreateNestedManyWithoutAccountInput
  }

  export type ClinicAccountUncheckedCreateWithoutActivityInput = {
    id?: string
    slug: string
    name: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    city?: string | null
    notes?: string | null
    status?: $Enums.AccountStatus
    plan?: $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: Decimal | DecimalJsLike | number | string | null
    currency?: string
    billingCycle?: $Enums.BillingCycle
    startedAt?: Date | string | null
    renewsAt?: Date | string | null
    pricingModel?: $Enums.PricingModel
    setupFee?: Decimal | DecimalJsLike | number | string | null
    yearlyFee?: Decimal | DecimalJsLike | number | string | null
    licenceFee?: Decimal | DecimalJsLike | number | string | null
    amcPercent?: Decimal | DecimalJsLike | number | string | null
    hostingFee?: Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: number | null
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    billingState?: string | null
    appliedPlan?: $Enums.PlanTier | null
    appliedFeatures?: string | null
    appliedReadOnly?: boolean | null
    appliedAt?: Date | string | null
    planJobId?: string | null
    isDemo?: boolean
    publicDomain?: string | null
    portalDomain?: string | null
    apiDomain?: string | null
    neonProjectId?: string | null
    vercelWebProjectId?: string | null
    vercelApiProjectId?: string | null
    provisionedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: OnboardingStepUncheckedCreateNestedManyWithoutAccountInput
    health?: HealthCheckUncheckedCreateNestedManyWithoutAccountInput
    invoices?: InvoiceUncheckedCreateNestedManyWithoutAccountInput
    planChanges?: PlanChangeUncheckedCreateNestedManyWithoutAccountInput
  }

  export type ClinicAccountCreateOrConnectWithoutActivityInput = {
    where: ClinicAccountWhereUniqueInput
    create: XOR<ClinicAccountCreateWithoutActivityInput, ClinicAccountUncheckedCreateWithoutActivityInput>
  }

  export type ProviderUserCreateWithoutActivityInput = {
    id?: string
    email: string
    passwordHash: string
    name: string
    role?: $Enums.ProviderRole
    isActive?: boolean
    createdAt?: Date | string
  }

  export type ProviderUserUncheckedCreateWithoutActivityInput = {
    id?: string
    email: string
    passwordHash: string
    name: string
    role?: $Enums.ProviderRole
    isActive?: boolean
    createdAt?: Date | string
  }

  export type ProviderUserCreateOrConnectWithoutActivityInput = {
    where: ProviderUserWhereUniqueInput
    create: XOR<ProviderUserCreateWithoutActivityInput, ProviderUserUncheckedCreateWithoutActivityInput>
  }

  export type ClinicAccountUpsertWithoutActivityInput = {
    update: XOR<ClinicAccountUpdateWithoutActivityInput, ClinicAccountUncheckedUpdateWithoutActivityInput>
    create: XOR<ClinicAccountCreateWithoutActivityInput, ClinicAccountUncheckedCreateWithoutActivityInput>
    where?: ClinicAccountWhereInput
  }

  export type ClinicAccountUpdateToOneWithWhereWithoutActivityInput = {
    where?: ClinicAccountWhereInput
    data: XOR<ClinicAccountUpdateWithoutActivityInput, ClinicAccountUncheckedUpdateWithoutActivityInput>
  }

  export type ClinicAccountUpdateWithoutActivityInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: OnboardingStepUpdateManyWithoutAccountNestedInput
    health?: HealthCheckUpdateManyWithoutAccountNestedInput
    invoices?: InvoiceUpdateManyWithoutAccountNestedInput
    planChanges?: PlanChangeUpdateManyWithoutAccountNestedInput
  }

  export type ClinicAccountUncheckedUpdateWithoutActivityInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: OnboardingStepUncheckedUpdateManyWithoutAccountNestedInput
    health?: HealthCheckUncheckedUpdateManyWithoutAccountNestedInput
    invoices?: InvoiceUncheckedUpdateManyWithoutAccountNestedInput
    planChanges?: PlanChangeUncheckedUpdateManyWithoutAccountNestedInput
  }

  export type ProviderUserUpsertWithoutActivityInput = {
    update: XOR<ProviderUserUpdateWithoutActivityInput, ProviderUserUncheckedUpdateWithoutActivityInput>
    create: XOR<ProviderUserCreateWithoutActivityInput, ProviderUserUncheckedCreateWithoutActivityInput>
    where?: ProviderUserWhereInput
  }

  export type ProviderUserUpdateToOneWithWhereWithoutActivityInput = {
    where?: ProviderUserWhereInput
    data: XOR<ProviderUserUpdateWithoutActivityInput, ProviderUserUncheckedUpdateWithoutActivityInput>
  }

  export type ProviderUserUpdateWithoutActivityInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    role?: EnumProviderRoleFieldUpdateOperationsInput | $Enums.ProviderRole
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ProviderUserUncheckedUpdateWithoutActivityInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    passwordHash?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    role?: EnumProviderRoleFieldUpdateOperationsInput | $Enums.ProviderRole
    isActive?: BoolFieldUpdateOperationsInput | boolean
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ClinicAccountCreateWithoutHealthInput = {
    id?: string
    slug: string
    name: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    city?: string | null
    notes?: string | null
    status?: $Enums.AccountStatus
    plan?: $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: Decimal | DecimalJsLike | number | string | null
    currency?: string
    billingCycle?: $Enums.BillingCycle
    startedAt?: Date | string | null
    renewsAt?: Date | string | null
    pricingModel?: $Enums.PricingModel
    setupFee?: Decimal | DecimalJsLike | number | string | null
    yearlyFee?: Decimal | DecimalJsLike | number | string | null
    licenceFee?: Decimal | DecimalJsLike | number | string | null
    amcPercent?: Decimal | DecimalJsLike | number | string | null
    hostingFee?: Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: number | null
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    billingState?: string | null
    appliedPlan?: $Enums.PlanTier | null
    appliedFeatures?: string | null
    appliedReadOnly?: boolean | null
    appliedAt?: Date | string | null
    planJobId?: string | null
    isDemo?: boolean
    publicDomain?: string | null
    portalDomain?: string | null
    apiDomain?: string | null
    neonProjectId?: string | null
    vercelWebProjectId?: string | null
    vercelApiProjectId?: string | null
    provisionedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: OnboardingStepCreateNestedManyWithoutAccountInput
    activity?: ActivityLogCreateNestedManyWithoutAccountInput
    invoices?: InvoiceCreateNestedManyWithoutAccountInput
    planChanges?: PlanChangeCreateNestedManyWithoutAccountInput
  }

  export type ClinicAccountUncheckedCreateWithoutHealthInput = {
    id?: string
    slug: string
    name: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    city?: string | null
    notes?: string | null
    status?: $Enums.AccountStatus
    plan?: $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: Decimal | DecimalJsLike | number | string | null
    currency?: string
    billingCycle?: $Enums.BillingCycle
    startedAt?: Date | string | null
    renewsAt?: Date | string | null
    pricingModel?: $Enums.PricingModel
    setupFee?: Decimal | DecimalJsLike | number | string | null
    yearlyFee?: Decimal | DecimalJsLike | number | string | null
    licenceFee?: Decimal | DecimalJsLike | number | string | null
    amcPercent?: Decimal | DecimalJsLike | number | string | null
    hostingFee?: Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: number | null
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    billingState?: string | null
    appliedPlan?: $Enums.PlanTier | null
    appliedFeatures?: string | null
    appliedReadOnly?: boolean | null
    appliedAt?: Date | string | null
    planJobId?: string | null
    isDemo?: boolean
    publicDomain?: string | null
    portalDomain?: string | null
    apiDomain?: string | null
    neonProjectId?: string | null
    vercelWebProjectId?: string | null
    vercelApiProjectId?: string | null
    provisionedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: OnboardingStepUncheckedCreateNestedManyWithoutAccountInput
    activity?: ActivityLogUncheckedCreateNestedManyWithoutAccountInput
    invoices?: InvoiceUncheckedCreateNestedManyWithoutAccountInput
    planChanges?: PlanChangeUncheckedCreateNestedManyWithoutAccountInput
  }

  export type ClinicAccountCreateOrConnectWithoutHealthInput = {
    where: ClinicAccountWhereUniqueInput
    create: XOR<ClinicAccountCreateWithoutHealthInput, ClinicAccountUncheckedCreateWithoutHealthInput>
  }

  export type ClinicAccountUpsertWithoutHealthInput = {
    update: XOR<ClinicAccountUpdateWithoutHealthInput, ClinicAccountUncheckedUpdateWithoutHealthInput>
    create: XOR<ClinicAccountCreateWithoutHealthInput, ClinicAccountUncheckedCreateWithoutHealthInput>
    where?: ClinicAccountWhereInput
  }

  export type ClinicAccountUpdateToOneWithWhereWithoutHealthInput = {
    where?: ClinicAccountWhereInput
    data: XOR<ClinicAccountUpdateWithoutHealthInput, ClinicAccountUncheckedUpdateWithoutHealthInput>
  }

  export type ClinicAccountUpdateWithoutHealthInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: OnboardingStepUpdateManyWithoutAccountNestedInput
    activity?: ActivityLogUpdateManyWithoutAccountNestedInput
    invoices?: InvoiceUpdateManyWithoutAccountNestedInput
    planChanges?: PlanChangeUpdateManyWithoutAccountNestedInput
  }

  export type ClinicAccountUncheckedUpdateWithoutHealthInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: OnboardingStepUncheckedUpdateManyWithoutAccountNestedInput
    activity?: ActivityLogUncheckedUpdateManyWithoutAccountNestedInput
    invoices?: InvoiceUncheckedUpdateManyWithoutAccountNestedInput
    planChanges?: PlanChangeUncheckedUpdateManyWithoutAccountNestedInput
  }

  export type ClinicAccountCreateWithoutInvoicesInput = {
    id?: string
    slug: string
    name: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    city?: string | null
    notes?: string | null
    status?: $Enums.AccountStatus
    plan?: $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: Decimal | DecimalJsLike | number | string | null
    currency?: string
    billingCycle?: $Enums.BillingCycle
    startedAt?: Date | string | null
    renewsAt?: Date | string | null
    pricingModel?: $Enums.PricingModel
    setupFee?: Decimal | DecimalJsLike | number | string | null
    yearlyFee?: Decimal | DecimalJsLike | number | string | null
    licenceFee?: Decimal | DecimalJsLike | number | string | null
    amcPercent?: Decimal | DecimalJsLike | number | string | null
    hostingFee?: Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: number | null
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    billingState?: string | null
    appliedPlan?: $Enums.PlanTier | null
    appliedFeatures?: string | null
    appliedReadOnly?: boolean | null
    appliedAt?: Date | string | null
    planJobId?: string | null
    isDemo?: boolean
    publicDomain?: string | null
    portalDomain?: string | null
    apiDomain?: string | null
    neonProjectId?: string | null
    vercelWebProjectId?: string | null
    vercelApiProjectId?: string | null
    provisionedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: OnboardingStepCreateNestedManyWithoutAccountInput
    activity?: ActivityLogCreateNestedManyWithoutAccountInput
    health?: HealthCheckCreateNestedManyWithoutAccountInput
    planChanges?: PlanChangeCreateNestedManyWithoutAccountInput
  }

  export type ClinicAccountUncheckedCreateWithoutInvoicesInput = {
    id?: string
    slug: string
    name: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    city?: string | null
    notes?: string | null
    status?: $Enums.AccountStatus
    plan?: $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: Decimal | DecimalJsLike | number | string | null
    currency?: string
    billingCycle?: $Enums.BillingCycle
    startedAt?: Date | string | null
    renewsAt?: Date | string | null
    pricingModel?: $Enums.PricingModel
    setupFee?: Decimal | DecimalJsLike | number | string | null
    yearlyFee?: Decimal | DecimalJsLike | number | string | null
    licenceFee?: Decimal | DecimalJsLike | number | string | null
    amcPercent?: Decimal | DecimalJsLike | number | string | null
    hostingFee?: Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: number | null
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    billingState?: string | null
    appliedPlan?: $Enums.PlanTier | null
    appliedFeatures?: string | null
    appliedReadOnly?: boolean | null
    appliedAt?: Date | string | null
    planJobId?: string | null
    isDemo?: boolean
    publicDomain?: string | null
    portalDomain?: string | null
    apiDomain?: string | null
    neonProjectId?: string | null
    vercelWebProjectId?: string | null
    vercelApiProjectId?: string | null
    provisionedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: OnboardingStepUncheckedCreateNestedManyWithoutAccountInput
    activity?: ActivityLogUncheckedCreateNestedManyWithoutAccountInput
    health?: HealthCheckUncheckedCreateNestedManyWithoutAccountInput
    planChanges?: PlanChangeUncheckedCreateNestedManyWithoutAccountInput
  }

  export type ClinicAccountCreateOrConnectWithoutInvoicesInput = {
    where: ClinicAccountWhereUniqueInput
    create: XOR<ClinicAccountCreateWithoutInvoicesInput, ClinicAccountUncheckedCreateWithoutInvoicesInput>
  }

  export type ClinicAccountUpsertWithoutInvoicesInput = {
    update: XOR<ClinicAccountUpdateWithoutInvoicesInput, ClinicAccountUncheckedUpdateWithoutInvoicesInput>
    create: XOR<ClinicAccountCreateWithoutInvoicesInput, ClinicAccountUncheckedCreateWithoutInvoicesInput>
    where?: ClinicAccountWhereInput
  }

  export type ClinicAccountUpdateToOneWithWhereWithoutInvoicesInput = {
    where?: ClinicAccountWhereInput
    data: XOR<ClinicAccountUpdateWithoutInvoicesInput, ClinicAccountUncheckedUpdateWithoutInvoicesInput>
  }

  export type ClinicAccountUpdateWithoutInvoicesInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: OnboardingStepUpdateManyWithoutAccountNestedInput
    activity?: ActivityLogUpdateManyWithoutAccountNestedInput
    health?: HealthCheckUpdateManyWithoutAccountNestedInput
    planChanges?: PlanChangeUpdateManyWithoutAccountNestedInput
  }

  export type ClinicAccountUncheckedUpdateWithoutInvoicesInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: OnboardingStepUncheckedUpdateManyWithoutAccountNestedInput
    activity?: ActivityLogUncheckedUpdateManyWithoutAccountNestedInput
    health?: HealthCheckUncheckedUpdateManyWithoutAccountNestedInput
    planChanges?: PlanChangeUncheckedUpdateManyWithoutAccountNestedInput
  }

  export type ClinicAccountCreateWithoutPlanChangesInput = {
    id?: string
    slug: string
    name: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    city?: string | null
    notes?: string | null
    status?: $Enums.AccountStatus
    plan?: $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: Decimal | DecimalJsLike | number | string | null
    currency?: string
    billingCycle?: $Enums.BillingCycle
    startedAt?: Date | string | null
    renewsAt?: Date | string | null
    pricingModel?: $Enums.PricingModel
    setupFee?: Decimal | DecimalJsLike | number | string | null
    yearlyFee?: Decimal | DecimalJsLike | number | string | null
    licenceFee?: Decimal | DecimalJsLike | number | string | null
    amcPercent?: Decimal | DecimalJsLike | number | string | null
    hostingFee?: Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: number | null
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    billingState?: string | null
    appliedPlan?: $Enums.PlanTier | null
    appliedFeatures?: string | null
    appliedReadOnly?: boolean | null
    appliedAt?: Date | string | null
    planJobId?: string | null
    isDemo?: boolean
    publicDomain?: string | null
    portalDomain?: string | null
    apiDomain?: string | null
    neonProjectId?: string | null
    vercelWebProjectId?: string | null
    vercelApiProjectId?: string | null
    provisionedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: OnboardingStepCreateNestedManyWithoutAccountInput
    activity?: ActivityLogCreateNestedManyWithoutAccountInput
    health?: HealthCheckCreateNestedManyWithoutAccountInput
    invoices?: InvoiceCreateNestedManyWithoutAccountInput
  }

  export type ClinicAccountUncheckedCreateWithoutPlanChangesInput = {
    id?: string
    slug: string
    name: string
    contactName?: string | null
    contactEmail?: string | null
    contactPhone?: string | null
    city?: string | null
    notes?: string | null
    status?: $Enums.AccountStatus
    plan?: $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: Decimal | DecimalJsLike | number | string | null
    currency?: string
    billingCycle?: $Enums.BillingCycle
    startedAt?: Date | string | null
    renewsAt?: Date | string | null
    pricingModel?: $Enums.PricingModel
    setupFee?: Decimal | DecimalJsLike | number | string | null
    yearlyFee?: Decimal | DecimalJsLike | number | string | null
    licenceFee?: Decimal | DecimalJsLike | number | string | null
    amcPercent?: Decimal | DecimalJsLike | number | string | null
    hostingFee?: Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: number | null
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    billingState?: string | null
    appliedPlan?: $Enums.PlanTier | null
    appliedFeatures?: string | null
    appliedReadOnly?: boolean | null
    appliedAt?: Date | string | null
    planJobId?: string | null
    isDemo?: boolean
    publicDomain?: string | null
    portalDomain?: string | null
    apiDomain?: string | null
    neonProjectId?: string | null
    vercelWebProjectId?: string | null
    vercelApiProjectId?: string | null
    provisionedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    steps?: OnboardingStepUncheckedCreateNestedManyWithoutAccountInput
    activity?: ActivityLogUncheckedCreateNestedManyWithoutAccountInput
    health?: HealthCheckUncheckedCreateNestedManyWithoutAccountInput
    invoices?: InvoiceUncheckedCreateNestedManyWithoutAccountInput
  }

  export type ClinicAccountCreateOrConnectWithoutPlanChangesInput = {
    where: ClinicAccountWhereUniqueInput
    create: XOR<ClinicAccountCreateWithoutPlanChangesInput, ClinicAccountUncheckedCreateWithoutPlanChangesInput>
  }

  export type ClinicAccountUpsertWithoutPlanChangesInput = {
    update: XOR<ClinicAccountUpdateWithoutPlanChangesInput, ClinicAccountUncheckedUpdateWithoutPlanChangesInput>
    create: XOR<ClinicAccountCreateWithoutPlanChangesInput, ClinicAccountUncheckedCreateWithoutPlanChangesInput>
    where?: ClinicAccountWhereInput
  }

  export type ClinicAccountUpdateToOneWithWhereWithoutPlanChangesInput = {
    where?: ClinicAccountWhereInput
    data: XOR<ClinicAccountUpdateWithoutPlanChangesInput, ClinicAccountUncheckedUpdateWithoutPlanChangesInput>
  }

  export type ClinicAccountUpdateWithoutPlanChangesInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: OnboardingStepUpdateManyWithoutAccountNestedInput
    activity?: ActivityLogUpdateManyWithoutAccountNestedInput
    health?: HealthCheckUpdateManyWithoutAccountNestedInput
    invoices?: InvoiceUpdateManyWithoutAccountNestedInput
  }

  export type ClinicAccountUncheckedUpdateWithoutPlanChangesInput = {
    id?: StringFieldUpdateOperationsInput | string
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    contactName?: NullableStringFieldUpdateOperationsInput | string | null
    contactEmail?: NullableStringFieldUpdateOperationsInput | string | null
    contactPhone?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumAccountStatusFieldUpdateOperationsInput | $Enums.AccountStatus
    plan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    featureOverrides?: NullableJsonNullValueInput | InputJsonValue
    monthlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    currency?: StringFieldUpdateOperationsInput | string
    billingCycle?: EnumBillingCycleFieldUpdateOperationsInput | $Enums.BillingCycle
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    renewsAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    pricingModel?: EnumPricingModelFieldUpdateOperationsInput | $Enums.PricingModel
    setupFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    yearlyFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    licenceFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    amcPercent?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    hostingFee?: NullableDecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string | null
    maxUsersOverride?: NullableIntFieldUpdateOperationsInput | number | null
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    billingState?: NullableStringFieldUpdateOperationsInput | string | null
    appliedPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    appliedFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    appliedReadOnly?: NullableBoolFieldUpdateOperationsInput | boolean | null
    appliedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    planJobId?: NullableStringFieldUpdateOperationsInput | string | null
    isDemo?: BoolFieldUpdateOperationsInput | boolean
    publicDomain?: NullableStringFieldUpdateOperationsInput | string | null
    portalDomain?: NullableStringFieldUpdateOperationsInput | string | null
    apiDomain?: NullableStringFieldUpdateOperationsInput | string | null
    neonProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelWebProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    vercelApiProjectId?: NullableStringFieldUpdateOperationsInput | string | null
    provisionedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    steps?: OnboardingStepUncheckedUpdateManyWithoutAccountNestedInput
    activity?: ActivityLogUncheckedUpdateManyWithoutAccountNestedInput
    health?: HealthCheckUncheckedUpdateManyWithoutAccountNestedInput
    invoices?: InvoiceUncheckedUpdateManyWithoutAccountNestedInput
  }

  export type ActivityLogCreateManyActorInput = {
    id?: string
    accountId?: string | null
    actorName: string
    action: string
    detail?: string | null
    applied?: boolean
    at?: Date | string
  }

  export type ActivityLogUpdateWithoutActorInput = {
    id?: StringFieldUpdateOperationsInput | string
    actorName?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    detail?: NullableStringFieldUpdateOperationsInput | string | null
    applied?: BoolFieldUpdateOperationsInput | boolean
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    account?: ClinicAccountUpdateOneWithoutActivityNestedInput
  }

  export type ActivityLogUncheckedUpdateWithoutActorInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    actorName?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    detail?: NullableStringFieldUpdateOperationsInput | string | null
    applied?: BoolFieldUpdateOperationsInput | boolean
    at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ActivityLogUncheckedUpdateManyWithoutActorInput = {
    id?: StringFieldUpdateOperationsInput | string
    accountId?: NullableStringFieldUpdateOperationsInput | string | null
    actorName?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    detail?: NullableStringFieldUpdateOperationsInput | string | null
    applied?: BoolFieldUpdateOperationsInput | boolean
    at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type OnboardingStepCreateManyAccountInput = {
    id?: string
    key: string
    label: string
    automated?: boolean
    sortOrder?: number
    done?: boolean
    doneAt?: Date | string | null
    notes?: string | null
  }

  export type ActivityLogCreateManyAccountInput = {
    id?: string
    actorId?: string | null
    actorName: string
    action: string
    detail?: string | null
    applied?: boolean
    at?: Date | string
  }

  export type HealthCheckCreateManyAccountInput = {
    id?: string
    ok: boolean
    statusCode?: number | null
    latencyMs?: number | null
    error?: string | null
    checkedAt?: Date | string
  }

  export type InvoiceCreateManyAccountInput = {
    id?: string
    number?: string | null
    fy?: string | null
    serial?: number | null
    status?: $Enums.InvoiceStatus
    issuedAt?: Date | string | null
    dueAt?: Date | string | null
    periodStart?: Date | string | null
    isFirst?: boolean
    billingName?: string | null
    billingAddress?: string | null
    gstin?: string | null
    placeOfSupply?: string | null
    planLabel: string
    lines: JsonNullValueInput | InputJsonValue
    subtotal: Decimal | DecimalJsLike | number | string
    cgst: Decimal | DecimalJsLike | number | string
    sgst: Decimal | DecimalJsLike | number | string
    igst: Decimal | DecimalJsLike | number | string
    total: Decimal | DecimalJsLike | number | string
    paidAt?: Date | string | null
    paymentMode?: string | null
    paymentRef?: string | null
    notes?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type PlanChangeCreateManyAccountInput = {
    id?: string
    fromPlan?: $Enums.PlanTier | null
    toPlan: $Enums.PlanTier
    fromFeatures?: string | null
    toFeatures: string
    readOnly?: boolean
    reason?: string | null
    actorName: string
    jobId?: string | null
    at?: Date | string
  }

  export type OnboardingStepUpdateWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    label?: StringFieldUpdateOperationsInput | string
    automated?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    done?: BoolFieldUpdateOperationsInput | boolean
    doneAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type OnboardingStepUncheckedUpdateWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    label?: StringFieldUpdateOperationsInput | string
    automated?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    done?: BoolFieldUpdateOperationsInput | boolean
    doneAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type OnboardingStepUncheckedUpdateManyWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    label?: StringFieldUpdateOperationsInput | string
    automated?: BoolFieldUpdateOperationsInput | boolean
    sortOrder?: IntFieldUpdateOperationsInput | number
    done?: BoolFieldUpdateOperationsInput | boolean
    doneAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type ActivityLogUpdateWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    actorName?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    detail?: NullableStringFieldUpdateOperationsInput | string | null
    applied?: BoolFieldUpdateOperationsInput | boolean
    at?: DateTimeFieldUpdateOperationsInput | Date | string
    actor?: ProviderUserUpdateOneWithoutActivityNestedInput
  }

  export type ActivityLogUncheckedUpdateWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    actorId?: NullableStringFieldUpdateOperationsInput | string | null
    actorName?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    detail?: NullableStringFieldUpdateOperationsInput | string | null
    applied?: BoolFieldUpdateOperationsInput | boolean
    at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ActivityLogUncheckedUpdateManyWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    actorId?: NullableStringFieldUpdateOperationsInput | string | null
    actorName?: StringFieldUpdateOperationsInput | string
    action?: StringFieldUpdateOperationsInput | string
    detail?: NullableStringFieldUpdateOperationsInput | string | null
    applied?: BoolFieldUpdateOperationsInput | boolean
    at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HealthCheckUpdateWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    ok?: BoolFieldUpdateOperationsInput | boolean
    statusCode?: NullableIntFieldUpdateOperationsInput | number | null
    latencyMs?: NullableIntFieldUpdateOperationsInput | number | null
    error?: NullableStringFieldUpdateOperationsInput | string | null
    checkedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HealthCheckUncheckedUpdateWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    ok?: BoolFieldUpdateOperationsInput | boolean
    statusCode?: NullableIntFieldUpdateOperationsInput | number | null
    latencyMs?: NullableIntFieldUpdateOperationsInput | number | null
    error?: NullableStringFieldUpdateOperationsInput | string | null
    checkedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type HealthCheckUncheckedUpdateManyWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    ok?: BoolFieldUpdateOperationsInput | boolean
    statusCode?: NullableIntFieldUpdateOperationsInput | number | null
    latencyMs?: NullableIntFieldUpdateOperationsInput | number | null
    error?: NullableStringFieldUpdateOperationsInput | string | null
    checkedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type InvoiceUpdateWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: NullableStringFieldUpdateOperationsInput | string | null
    fy?: NullableStringFieldUpdateOperationsInput | string | null
    serial?: NullableIntFieldUpdateOperationsInput | number | null
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    issuedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    dueAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    periodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isFirst?: BoolFieldUpdateOperationsInput | boolean
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    placeOfSupply?: NullableStringFieldUpdateOperationsInput | string | null
    planLabel?: StringFieldUpdateOperationsInput | string
    lines?: JsonNullValueInput | InputJsonValue
    subtotal?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    cgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    igst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMode?: NullableStringFieldUpdateOperationsInput | string | null
    paymentRef?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type InvoiceUncheckedUpdateWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: NullableStringFieldUpdateOperationsInput | string | null
    fy?: NullableStringFieldUpdateOperationsInput | string | null
    serial?: NullableIntFieldUpdateOperationsInput | number | null
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    issuedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    dueAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    periodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isFirst?: BoolFieldUpdateOperationsInput | boolean
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    placeOfSupply?: NullableStringFieldUpdateOperationsInput | string | null
    planLabel?: StringFieldUpdateOperationsInput | string
    lines?: JsonNullValueInput | InputJsonValue
    subtotal?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    cgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    igst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMode?: NullableStringFieldUpdateOperationsInput | string | null
    paymentRef?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type InvoiceUncheckedUpdateManyWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    number?: NullableStringFieldUpdateOperationsInput | string | null
    fy?: NullableStringFieldUpdateOperationsInput | string | null
    serial?: NullableIntFieldUpdateOperationsInput | number | null
    status?: EnumInvoiceStatusFieldUpdateOperationsInput | $Enums.InvoiceStatus
    issuedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    dueAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    periodStart?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    isFirst?: BoolFieldUpdateOperationsInput | boolean
    billingName?: NullableStringFieldUpdateOperationsInput | string | null
    billingAddress?: NullableStringFieldUpdateOperationsInput | string | null
    gstin?: NullableStringFieldUpdateOperationsInput | string | null
    placeOfSupply?: NullableStringFieldUpdateOperationsInput | string | null
    planLabel?: StringFieldUpdateOperationsInput | string
    lines?: JsonNullValueInput | InputJsonValue
    subtotal?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    cgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    sgst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    igst?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    paidAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    paymentMode?: NullableStringFieldUpdateOperationsInput | string | null
    paymentRef?: NullableStringFieldUpdateOperationsInput | string | null
    notes?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PlanChangeUpdateWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    fromPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    toPlan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    fromFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    toFeatures?: StringFieldUpdateOperationsInput | string
    readOnly?: BoolFieldUpdateOperationsInput | boolean
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    actorName?: StringFieldUpdateOperationsInput | string
    jobId?: NullableStringFieldUpdateOperationsInput | string | null
    at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PlanChangeUncheckedUpdateWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    fromPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    toPlan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    fromFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    toFeatures?: StringFieldUpdateOperationsInput | string
    readOnly?: BoolFieldUpdateOperationsInput | boolean
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    actorName?: StringFieldUpdateOperationsInput | string
    jobId?: NullableStringFieldUpdateOperationsInput | string | null
    at?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type PlanChangeUncheckedUpdateManyWithoutAccountInput = {
    id?: StringFieldUpdateOperationsInput | string
    fromPlan?: NullableEnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier | null
    toPlan?: EnumPlanTierFieldUpdateOperationsInput | $Enums.PlanTier
    fromFeatures?: NullableStringFieldUpdateOperationsInput | string | null
    toFeatures?: StringFieldUpdateOperationsInput | string
    readOnly?: BoolFieldUpdateOperationsInput | boolean
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    actorName?: StringFieldUpdateOperationsInput | string
    jobId?: NullableStringFieldUpdateOperationsInput | string | null
    at?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}