import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const shop = await prisma.shop.upsert({
    where: { name: process.env.DEFAULT_SHOP_NAME ?? "Default Shop" },
    update: {},
    create: { name: process.env.DEFAULT_SHOP_NAME ?? "Default Shop" },
  });

  const item = await prisma.item.upsert({
    where: { shopId_normalizedName: { shopId: shop.id, normalizedName: "rice" } },
    update: { name: "rice" },
    create: { shopId: shop.id, name: "rice", normalizedName: "rice" },
  });

  const customer = await prisma.customer.upsert({
    where: { shopId_normalizedName: { shopId: shop.id, normalizedName: "mary" } },
    update: { name: "mary" },
    create: { shopId: shop.id, name: "mary", normalizedName: "mary" },
  });

  await prisma.sale.create({
    data: {
      shopId: shop.id,
      itemId: item.id,
      customerId: customer.id,
      kind: "credit",
      quantity: 1,
      amount: 1200,
      dueDateText: "today",
    },
  });

  await prisma.payment.create({
    data: {
      shopId: shop.id,
      customerId: customer.id,
      amount: 500,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
