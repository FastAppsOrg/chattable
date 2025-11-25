import React from 'react'

/**
 * Advanced TypeScript utility types for enhanced type safety
 */

// Make all properties in T optional recursively
export type DeepPartial<T> = T extends object
  ? {
    [P in keyof T]?: DeepPartial<T[P]>
  }
  : T

// Make all properties in T readonly recursively
export type DeepReadonly<T> = T extends object
  ? {
    readonly [P in keyof T]: DeepReadonly<T[P]>
  }
  : T

// Make all properties in T required recursively
export type DeepRequired<T> = T extends object
  ? {
    [P in keyof T]-?: DeepRequired<T[P]>
  }
  : T

// Make all properties in T nullable
export type Nullable<T> = {
  [P in keyof T]: T[P] | null
}

// Make specific properties optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Make specific properties required
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

// Extract non-nullable types
export type NonNullableKeys<T> = {
  [K in keyof T]: T[K] extends null | undefined ? never : K
}[keyof T]

// Get the type of a Promise
export type Awaited<T> = T extends Promise<infer U> ? U : T

// Extract the return type of an async function
export type AsyncReturnType<T extends (...args: any[]) => Promise<any>> =
  T extends (...args: any[]) => Promise<infer R> ? R : never

// Union to intersection
export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

// Get union type of all values in an object
export type ValueOf<T> = T[keyof T]

// Strict Extract - ensures K exists in T
export type StrictExtract<T, K extends T> = K

// XOR type - either A or B but not both
export type XOR<T, U> = T | U extends object
  ? (T & { [K in Exclude<keyof U, keyof T>]?: never }) |
  (U & { [K in Exclude<keyof T, keyof U>]?: never })
  : T | U

// Get keys of T that extend type U
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never
}[keyof T]

// Mutable - remove readonly from all properties
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}

// Pick properties by value type
export type PickByType<T, V> = Pick<T, KeysOfType<T, V>>

// Omit properties by value type
export type OmitByType<T, V> = Omit<T, KeysOfType<T, V>>

// Function type with better inference
export type Fn<P extends any[] = any[], R = any> = (...args: P) => R

// Async function type
export type AsyncFn<P extends any[] = any[], R = any> = (...args: P) => Promise<R>

// Constructor type
export type Constructor<T = {}> = new (...args: any[]) => T

// Get component props type
export type ComponentProps<T extends keyof React.JSX.IntrinsicElements | React.ComponentType<any>> =
  T extends keyof React.JSX.IntrinsicElements
  ? React.JSX.IntrinsicElements[T]
  : T extends React.ComponentType<infer P>
  ? P
  : never

// Ensure at least one property is present
export type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>>
}[keyof T]

// Ensure exactly one property is present
export type RequireOnlyOne<T> = RequireAtLeastOne<T> &
  Partial<Record<keyof T, undefined>>

// Path type for nested object access
export type Path<T> = T extends object
  ? {
    [K in keyof T]: K extends string
    ? T[K] extends object
    ? K | `${K}.${Path<T[K]>}`
    : K
    : never
  }[keyof T]
  : never

// Get type at path in nested object
export type PathValue<T, P extends Path<T>> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
  ? Rest extends Path<T[K]>
  ? PathValue<T[K], Rest>
  : never
  : never
  : P extends keyof T
  ? T[P]
  : never

// Branded types for nominal typing
export type Brand<T, B> = T & { __brand: B }

// Common branded types
export type UUID = Brand<string, 'UUID'>
export type Email = Brand<string, 'Email'>
export type URL = Brand<string, 'URL'>
export type Timestamp = Brand<number, 'Timestamp'>
export type PositiveNumber = Brand<number, 'PositiveNumber'>

// Type guards
export const isUUID = (value: string): value is UUID => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

export const isEmail = (value: string): value is Email => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

export const isURL = (value: string): value is URL => {
  try {
    new globalThis.URL(value)
    return true
  } catch {
    return false
  }
}

// Tuple utilities
export type Head<T extends readonly any[]> = T extends readonly [infer H, ...any[]] ? H : never
export type Tail<T extends readonly any[]> = T extends readonly [any, ...infer Rest] ? Rest : []
export type Last<T extends readonly any[]> = T extends readonly [...any[], infer L] ? L : never

// String literal utilities
export type Uppercase<S extends string> = S extends `${infer T}` ? T extends string ? Uppercase<T> : S : S
export type Lowercase<S extends string> = S extends `${infer T}` ? T extends string ? Lowercase<T> : S : S
export type Capitalize<S extends string> = S extends `${infer F}${infer R}` ? `${Uppercase<F>}${R}` : S

// JSON types
export type JSONPrimitive = string | number | boolean | null
export type JSONObject = { [key: string]: JSONValue }
export type JSONArray = JSONValue[]
export type JSONValue = JSONPrimitive | JSONObject | JSONArray

// API Response types
export interface ApiResponse<T = any> {
  data?: T
  error?: string
  status: number
  success: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// React specific utilities
export type PropsWithClassName<P = {}> = P & {
  className?: string
}

export type PropsWithChildren<P = {}> = P & {
  children?: React.ReactNode
}

export type PropsWithStyle<P = {}> = P & {
  style?: React.CSSProperties
}

// Event handler types
export type ChangeHandler<T = HTMLInputElement> = React.ChangeEventHandler<T>
export type ClickHandler<T = HTMLElement> = React.MouseEventHandler<T>
export type SubmitHandler = React.FormEventHandler<HTMLFormElement>
export type KeyHandler<T = HTMLElement> = React.KeyboardEventHandler<T>

// Form field types
export interface FormField<T = string> {
  value: T
  error?: string
  touched: boolean
  dirty: boolean
}

export interface FormState<T extends Record<string, any>> {
  fields: {
    [K in keyof T]: FormField<T[K]>
  }
  isValid: boolean
  isSubmitting: boolean
  errors: Partial<Record<keyof T, string>>
}