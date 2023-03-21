interface BaseResult {
  readonly didSucceed: boolean;
}

export interface FailureResult<Reason> extends BaseResult {
  readonly didSucceed: false;
  readonly reason: Reason;
}

export type SuccessfulResult<Result> = Result extends undefined
  ? BaseResult & { readonly didSucceed: true }
  : BaseResult & { readonly didSucceed: true; readonly result: Result };

export type Result<Type, FailureReason> = FailureResult<FailureReason> | SuccessfulResult<Type>;
