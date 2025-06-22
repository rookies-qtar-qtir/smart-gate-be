import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { UsersModule } from './users/users.module';
import { AccessLogsModule } from './access-logs/access-logs.module';
import { TfjsModule } from './tfjs/tfjs.module';

@Module({
  imports: [UsersModule, AccessLogsModule, TfjsModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
