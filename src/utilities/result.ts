interface BaseResult {
  readonly didSucceed: boolean;
}

export interface FailureResult<Reason> extends BaseResult {
  readonly didSucceed: false;
  readonly reason: Reason;
}

export interface SuccessfulResult<Result> extends BaseResult {
  readonly didSucceed: true;
  readonly result: Result;
}

export type Result<Type, FailureReason> = FailureResult<FailureReason> | SuccessfulResult<Type>;
