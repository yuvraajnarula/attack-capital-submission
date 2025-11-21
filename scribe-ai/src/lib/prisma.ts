// import { PrismaClient } from '../generated/prisma/client'
// import { PrismaPg } from '@prisma/adapter-pg'

// const globalForPrisma = global as unknown as {
//     prisma: PrismaClient
// }

// const adapter = new PrismaPg({
//   connectionString: process.env.DATABASE_URL,
// })

// const prisma = globalForPrisma.prisma || new PrismaClient({
//   adapter,
// })

// if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// export default prisma

import "dotenv/config"
import { PrismaClient } from '../generated/prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const prismaClientSingleton = () => {
  return new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL!,
  }).$extends(withAccelerate())
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma