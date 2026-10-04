import { Module } from "@nestjs/common";
import { GarageController } from "./garage.controller";
import { TypeOrmGarageRepository } from "./typeorm-garage.repository";
@Module({
  controllers: [GarageController],
  providers: [TypeOrmGarageRepository],
})
export class GarageModule {}
