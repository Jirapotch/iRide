import type { EntityManager } from "typeorm";

export type ActorContext =
  | { readonly role: "anon" }
  | { readonly role: "authenticated"; readonly userId: string }
  | { readonly role: "service_role"; readonly userId?: string };

export interface TransactionSource {
  readonly transaction: <T>(
    work: (manager: EntityManager) => Promise<T>,
  ) => Promise<T>;
}

export async function withActorTransaction<T>(
  dataSource: TransactionSource,
  actor: ActorContext,
  work: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  return dataSource.transaction(async (manager) => {
    await manager.query("select set_config('role', $1, true)", [actor.role]);
    await manager.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({
        ...(actor.role === "anon" || actor.userId === undefined
          ? {}
          : { sub: actor.userId }),
        role: actor.role,
      }),
    ]);
    return work(manager);
  });
}
