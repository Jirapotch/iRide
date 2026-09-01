export type PromotionState = {
  readonly role: "user" | "admin";
  readonly status: "locked" | "active" | "suspended";
  readonly transitionId: string | null;
  readonly action: string | null;
};

export type PromotionAdapter = {
  readonly begin: (userId: string) => Promise<{ readonly token: string; readonly previousStatus: PromotionState["status"] }>;
  readonly finalize: (input: { readonly userId: string; readonly token: string }) => Promise<void>;
  readonly getState: (userId: string) => Promise<PromotionState | null>;
  readonly setBan: (userId: string, duration: "none" | "876000h") => Promise<void>;
};

export function promoteWithSaga(adapter: PromotionAdapter, userId: string): Promise<PromotionState>;
