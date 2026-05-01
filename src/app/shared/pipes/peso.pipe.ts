import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a number as Philippine peso. Tolerates strings & nulls.
 * Example: 1234.5 → ₱1,234.50
 */
@Pipe({ name: 'peso', standalone: true, pure: true })
export class PesoPipe implements PipeTransform {
  transform(value: number | string | null | undefined, withSymbol = true): string {
    const n = Number(value ?? 0);
    if (Number.isNaN(n)) return withSymbol ? '₱0.00' : '0.00';
    const formatted = n.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return withSymbol ? `₱${formatted}` : formatted;
  }
}
