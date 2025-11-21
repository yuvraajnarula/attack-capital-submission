import  prisma from "../../../lib/prisma";

export async function GET() {
  try {
    const accountFields = await prisma.account.fields;
    return Response.json({ accountFields });
  } catch (error) {
    return Response.json({ error: String(error) });
  }
}
