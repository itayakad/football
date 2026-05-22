import 'dotenv/config';
import { prisma } from './db';
import { seedPlayCatalog } from './seed';

// Populates ONLY the Play catalog. Safe to run against a dev DB that has
// existing teams/seasons/schemes — it does not touch any other table.
seedPlayCatalog()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
