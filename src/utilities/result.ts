interface BaseResult {
  readonly didSucceed: boolean;
}

interface FailureResult extends BaseResult {
  readonly didSucceed: false;
  readonly reason: string;
}

export interface SuccessfulResult<Result> extends BaseResult {
  readonly didSucceed: true;
  readonly result: Result;
}

export type Result<Type> = FailureResult | SuccessfulResult<Type>;
