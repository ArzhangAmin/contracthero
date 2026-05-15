import {
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

const UTF8_ENCODING = 'utf8';

/**
 * Validates that the UTF-8 byte length of a string is at most `max` bytes.
 *
 * This is distinct from `@MaxLength`, which counts UTF-16 code units and
 * therefore under-counts multi-byte characters (e.g. emoji, CJK). Useful
 * anywhere we depend on a downstream byte-based limit (e.g. bcrypt's
 * 72-byte input cap).
 */
export function MaxByteLength(
  max: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'maxByteLength',
      target: target.constructor,
      propertyName: propertyName.toString(),
      constraints: [max],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'string') {
            return false;
          }
          const [limit] = args.constraints as [number];
          return Buffer.byteLength(value, UTF8_ENCODING) <= limit;
        },
        defaultMessage(args: ValidationArguments): string {
          const [limit] = args.constraints as [number];
          return `${args.property} must be at most ${limit} bytes when encoded as UTF-8`;
        },
      },
    });
  };
}
