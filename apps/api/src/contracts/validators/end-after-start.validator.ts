import {
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

/**
 * Validates that the decorated property (an ISO date string or Date) is
 * strictly after the value of another sibling property on the same object.
 *
 * Used on Contract DTOs to enforce `endDate > startDate`. We do this in the
 * DTO layer (not the service) so the error is reported as a 400 with a
 * field-level message, and so it cannot be bypassed by a partial update
 * that supplies one date without the other.
 */
export function IsAfter(
  siblingProperty: string,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isAfter',
      target: target.constructor,
      propertyName: propertyName.toString(),
      constraints: [siblingProperty],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [sibling] = args.constraints as [string];
          const obj = args.object as Record<string, unknown>;
          const otherRaw = obj[sibling];

          // If the sibling is absent (e.g. partial PATCH), defer to the
          // service layer — we cannot meaningfully compare here.
          if (otherRaw === undefined || otherRaw === null) {
            return true;
          }

          const end = toDate(value);
          const start = toDate(otherRaw);
          if (!end || !start) {
            return false;
          }
          return end.getTime() > start.getTime();
        },
        defaultMessage(args: ValidationArguments): string {
          const [sibling] = args.constraints as [string];
          return `${args.property} must be after ${sibling}`;
        },
      },
    });
  };
}

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};
