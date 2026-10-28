import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  const mode = process.env.SIGNUP_MODE_DEFAULT || "DOMAIN_ALLOWLIST";
  await db.appSetting.upsert({
    where: { key: "signupMode" },
    create: { key: "signupMode", value: mode },
    update: {},
  });

  // Staff and current students. The four sending-district domains are added later by an admin.
  await db.allowedDomain.upsert({
    where: { domain: "pascack.org" },
    create: { domain: "pascack.org", cohort: "CURRENT", label: "Pascack students and staff" },
    update: {},
  });
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
