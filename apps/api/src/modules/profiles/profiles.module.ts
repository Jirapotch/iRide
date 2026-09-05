import { Module } from "@nestjs/common";

import { ProfilesController } from "./profiles.controller";
import { TypeOrmProfileRepository } from "./typeorm-profile.repository";

@Module({
  controllers: [ProfilesController],
  providers: [TypeOrmProfileRepository],
})
export class ProfilesModule {}
