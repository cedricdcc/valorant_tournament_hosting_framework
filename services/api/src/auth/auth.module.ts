import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UsersRepository } from './users.repository.js';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: Pool,
      useFactory: () => new Pool({ connectionString: process.env.DATABASE_URL }),
    },
    {
      provide: UsersRepository,
      useFactory: (pool: Pool) => new UsersRepository(pool),
      inject: [Pool],
    },
    {
      provide: AuthService,
      useFactory: (usersRepository: UsersRepository) => new AuthService(usersRepository),
      inject: [UsersRepository],
    },
  ],
})
export class AuthModule {}
