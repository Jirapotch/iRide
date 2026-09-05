const action = process.argv[2];

async function main() {
  if (action !== "show" && action !== "run" && action !== "revert") {
    throw new Error("Expected migration action: show, run, or revert.");
  }

  const { default: dataSource } = await import("../src/database/data-source");

  try {
    await dataSource.initialize();
    if (action === "show") {
      const pending = await dataSource.showMigrations();
      console.info(pending ? "TypeORM migrations are pending." : "TypeORM migrations are current.");
    } else if (action === "run") {
      const migrations = await dataSource.runMigrations({ transaction: "each" });
      console.info(`Applied ${migrations.length} TypeORM migration(s).`);
    } else {
      await dataSource.undoLastMigration({ transaction: "each" });
      console.info("Reverted the latest TypeORM migration.");
    }
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
