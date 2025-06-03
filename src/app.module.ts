import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { UsersModule } from './users/users.module';
import { AccessLogsModule } from './access-logs/access-logs.module';

@Module({
  imports: [UsersModule, AccessLogsModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
