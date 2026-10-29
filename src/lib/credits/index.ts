/** Credit math in integer tenths so half-year (2.5) courses add up exactly. No framework imports. */

export function toTenths(value: number | string | { toString(): string }): number {
  const n = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(n)) throw new Error(`Not a credit value: ${String(value)}`);
  return Math.round(n * 10);
}

export const fromTenths = (tenths: number): number => tenths / 10;

export function sumCredits(values: (number | string | { toString(): string })[]): number {
  return fromTenths(values.reduce<number>((acc, v) => acc + toTenths(v), 0));
}

export const addCredits = (a: number, b: number): number => sumCredits([a, b]);

export const formatCredits = (credits: number): string => String(fromTenths(toTenths(credits)));
