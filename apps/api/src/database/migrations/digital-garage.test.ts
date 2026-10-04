import { describe, expect, it, vi } from "vitest";
import { DigitalGarage20261004120000 } from "./20261004120000-digital-garage";
import { createMigrationDataSourceOptions } from "../typeorm.config";
describe("digital garage migration", () => {
  it("registers the forward migration in the actual TypeORM runner", () => {
    const options = createMigrationDataSourceOptions({
      migrationDatabaseUrl: "postgresql://localhost/test",
    });
    expect(options.migrations).toContain(DigitalGarage20261004120000);
  });
  it("loads the shared SQL through the production runner", async () => {
    const query = vi.fn();
    await new DigitalGarage20261004120000().up({
      hasTable: async () => false,
      query,
    } as never);
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("vehicle_transfers_one_pending_idx");
    expect(sql).toContain("foreign key (record_id, vehicle_id)");
    expect(sql).toContain(
      "grant select on public.vehicle_documents, public.vehicle_transfers to authenticated",
    );
  });
  it("does not reapply an already installed Supabase migration", async () => {
    const query = vi.fn();
    await new DigitalGarage20261004120000().up({
      hasTable: async () => true,
      query,
    } as never);
    expect(query).not.toHaveBeenCalled();
  });
  it("refuses a destructive rollback of ownership and private history", async () => {
    await expect(new DigitalGarage20261004120000().down()).rejects.toThrow(
      "forward migration",
    );
  });
});
