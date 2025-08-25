// Import the types we need
import type { Email } from './index';

// Test utility types
export interface MockEmail extends Email {
  readonly __testId: string;
}

export type TestScenario = {
  readonly name: string;
  readonly input: unknown;
  readonly expected: unknown;
  readonly shouldThrow?: boolean;
};
