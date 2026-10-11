import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { resetApplicationObjects } from "./lib/cutover.mjs";
test("legacy restrictive owners are removed before Auth deletion; managed schemas survive", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create schema auth;create schema storage;create schema private;create table auth.users(id uuid primary key);create table storage.buckets(id text primary key);insert into storage.buckets values('internal');create table public.profiles(id uuid primary key references auth.users(id) on delete cascade);create table public.vehicles(id uuid primary key,owner_id uuid references profiles(id) on delete restrict);create table private.audit(id int);create type public.legacy_enum as enum ('active');create function public.old_rpc() returns int language sql as 'select 1';create view public.old_view as select * from profiles;",
    );
    const owner = "6d34bc84-8116-4ee5-b6db-c9204b90139b";
    await db.query("insert into auth.users values($1)", [owner]);
    await db.query("insert into profiles values($1)", [owner]);
    await db.query("insert into vehicles values($1,$1)", [owner]);
    await assert.rejects(
      db.query("delete from auth.users"),
      /foreign key constraint/,
    );
    await resetApplicationObjects(db);
    await db.query("delete from auth.users");
    assert.equal(
      (await db.query("select count(*)::int n from auth.users")).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("select id from storage.buckets")).rows[0].id,
      "internal",
    );
    assert.equal(
      (
        await db.query(
          "select to_regclass('public.vehicles') v,to_regclass('private.audit') a,to_regprocedure('public.old_rpc()') r,to_regtype('public.legacy_enum') t",
        )
      ).rows[0].v,
      null,
    );
    assert.deepEqual(
      (
        await db.query(
          "select to_regclass('private.audit') a,to_regprocedure('public.old_rpc()') r,to_regtype('public.legacy_enum') t",
        )
      ).rows[0],
      { a: null, r: null, t: null },
    );
  } finally {
    await db.close();
  }
});
