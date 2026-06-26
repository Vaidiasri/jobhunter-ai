import { prisma } from "./prisma";

export async function getOrCreateSettings() {
  return prisma.userSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}
