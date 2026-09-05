import { Global, Module } from "@nestjs/common";

import { RuntimeDatabaseService } from "./runtime-database.service";

@Global()
@Module({
  providers: [RuntimeDatabaseService],
  exports: [RuntimeDatabaseService],
})
export class DatabaseModule {}
