export type DataResult<T> =
  | { readonly status: "success"; readonly data: T }
  | { readonly status: "error" };

export async function captureData<T>(
  read: () => Promise<T>,
): Promise<DataResult<T>> {
  try {
    return { status: "success", data: await read() };
  } catch {
    return { status: "error" };
  }
}
