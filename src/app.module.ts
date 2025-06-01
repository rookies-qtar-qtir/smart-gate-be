import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { Mongoose } from 'mongoose';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }), 
    MongooseModule.forRoot(process.env.DB_URI as string),
    UserModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
