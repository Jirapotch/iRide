import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";

import { createRuntimeDataSourceOptions } from "./typeorm.config";

@Injectable()
export class RuntimeDatabaseService implements OnModuleDestroy {
  private dataSourcePromise: Promise<DataSource> | undefined;

  transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.getDataSource().then((dataSource) => dataSource.transaction(work));
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.dataSourcePromise) return;
    const dataSource = await this.dataSourcePromise;
    if (dataSource.isInitialized) await dataSource.destroy();
  }

  private getDataSource(): Promise<DataSource> {
    if (!this.dataSourcePromise) {
      const databaseUrl = process.env.DATABASE_URL?.trim();
      if (!databaseUrl) {
        throw new Error("DATABASE_URL is required for the API database runtime.");
      }
      this.dataSourcePromise = new DataSource(
        createRuntimeDataSourceOptions({ databaseUrl }),
      ).initialize();
    }
    return this.dataSourcePromise;
  }
}
