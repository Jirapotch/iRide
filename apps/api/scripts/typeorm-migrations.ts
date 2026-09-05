import dataSource from "../src/database/data-source";

const action = process.argv[2];

try {
  await dataSource.initialize();
  if (action === "show") {
    const pending = await dataSource.showMigrations();
    console.info(pending ? "TypeORM migrations are pending." : "TypeORM migrations are current.");
  } else if (action === "run") {
    const migrations = await dataSource.runMigrations({ transaction: "each" });
    console.info(`Applied ${migrations.length} TypeORM migration(s).`);
  } else if (action === "revert") {
    await dataSource.undoLastMigration({ transaction: "each" });
    console.info("Reverted the latest TypeORM migration.");
  } else {
    throw new Error("Expected migration action: show, run, or revert.");
  }
} finally {
  if (dataSource.isInitialized) await dataSource.destroy();
}
