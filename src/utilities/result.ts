interface BaseResult {
  readonly didSucceed: boolean;
}

interface SuccessfulResult<Result> extends BaseResult {
  readonly didSucceed: true;
  readonly result: Result;
}

interface FailureResult extends BaseResult {
  readonly didSucceed: false;
  readonly reason: string;
}

export type Result<Type> = FailureResult | SuccessfulResult<Type>;
