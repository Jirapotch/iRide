import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const migration = await readFile(
  new URL(
    "../supabase/migrations/20261011165416_personal_garage.sql",
    import.meta.url,
  ),
  "utf8",
);
test("Garage baseline: permissions, cross-vehicle covers, service totals and upload/delete interlocks", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;",
    );
    await db.exec(migration);
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select * from vehicles"),
      /permission denied/,
    );
    await db.exec("reset role");
    const v = (
      await db.query(
        "insert into vehicles(name) values('My ride') returning id",
      )
    ).rows[0].id;
    const other = (
      await db.query(
        "insert into vehicles(name) values('Other ride') returning id",
      )
    ).rows[0].id;
    await db.exec("set role service_role");
    assert.equal(
      (await db.query("select garage_schema_version() as version")).rows[0]
        .version,
      "personal-garage-v1",
    );
    const photo = (
      await db.query(
        "select * from reserve_vehicle_photo($1,'car.jpg','image/jpeg',100)",
        [v],
      )
    ).rows[0];
    await assert.rejects(
      db.query("select begin_vehicle_delete($1)", [v]),
      /UPLOAD_IN_PROGRESS/,
    );
    await db.query("select finish_vehicle_photo($1,'drive-file')", [photo.id]);
    assert.equal(
      (await db.query("select cover_photo_id from vehicles where id=$1", [v]))
        .rows[0].cover_photo_id,
      photo.id,
    );
    await assert.rejects(
      db.query("update vehicles set cover_photo_id=$1 where id=$2", [
        photo.id,
        other,
      ]),
      /cover_belongs_to_vehicle/,
    );
    await db.query(
      "insert into service_records(vehicle_id,title,occurred_on,cost) select $1,'Oil','2026-10-11',10.50 from generate_series(1,1001)",
      [v],
    );
    assert.equal(
      Number(
        (await db.query("select vehicle_service_total($1) as total", [v]))
          .rows[0].total,
      ),
      10510.5,
    );
    await db.query("select begin_vehicle_delete($1)", [v]);
    await assert.rejects(
      db.query("select reserve_vehicle_photo($1,'late.jpg','image/jpeg',100)", [
        v,
      ]),
      /VEHICLE_DELETING/,
    );
    await assert.rejects(
      db.query("delete from vehicles where id=$1", [v]),
      /vehicle_photos_vehicle_id_fkey/,
    );
    await db.query("select remove_vehicle_photo($1)", [photo.id]);
    await db.query("delete from vehicles where id=$1", [v]);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from service_records where vehicle_id=$1",
          [v],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
