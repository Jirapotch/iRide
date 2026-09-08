export type DataErrorCategory =
  | "unavailable"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "validation"
  | "unknown";

export interface DataFailure {
  readonly category: DataErrorCategory;
}

export type DataResult<T> =
  | { readonly status: "success"; readonly data: T }
  | { readonly status: "error"; readonly error: DataFailure };

export async function captureData<T>(
  read: () => Promise<T>,
): Promise<DataResult<T>> {
  try {
    return { status: "success", data: await read() };
  } catch (error) {
    return { status: "error", error: classifyDataFailure(error) };
  }
}

function classifyDataFailure(error: unknown): DataFailure {
  const status = readHttpStatus(error);
  if (status === 401) return { category: "unauthorized" };
  if (status === 403) return { category: "forbidden" };
  if (status === 404) return { category: "not-found" };
  if (status !== null && status >= 400 && status < 500) {
    return { category: "validation" };
  }
  if ((status !== null && status >= 500) || error instanceof TypeError) {
    return { category: "unavailable" };
  }
  return { category: "unknown" };
}

function readHttpStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return null;
  }
  return typeof error.status === "number" && Number.isInteger(error.status)
    ? error.status
    : null;
}
