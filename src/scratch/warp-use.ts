import { consumeOneCredit, getCreditsForToday } from "../services/warp.service";

(async () => {
  console.log("ก่อนใช้:", await getCreditsForToday(1));
  const r = await consumeOneCredit(1, { message: "hello world!" });
  console.log("หลังใช้:", r);
})();
