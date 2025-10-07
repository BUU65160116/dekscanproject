import { getCreditsForToday } from "../services/warp.service";

(async () => {
  const result = await getCreditsForToday(1); // แทนเลขโต๊ะที่มีออเดอร์วันนี้
  console.log("credits today:", result);
})();
