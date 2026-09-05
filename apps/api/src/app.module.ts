import { Module } from "@nestjs/common";

import { DatabaseModule } from "./database/database.module";
import { CompatibilityModule } from "./modules/compatibility/compatibility.module";
import { HealthModule } from "./modules/health/health.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";

const profileModules =
  process.env.IRIDE_PROFILE_BACKEND === "supabase-compatibility"
    ? []
    : [ProfilesModule];

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    ...profileModules,
    CompatibilityModule,
    JobsModule,
  ],
})
export class AppModule {}
