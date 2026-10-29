import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "./endpoint";

describe("isAllowedPushEndpoint", () => {
  it("accepts the real push services", () => {
    for (const u of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
      "https://FCM.GoogleAPIs.com./fcm/send/x",
    ]) expect(isAllowedPushEndpoint(u), u).toBe(true);
  });
  it("refuses internal, local and metadata addresses", () => {
    for (const u of ["https://localhost/x", "https://127.0.0.1/x", "https://169.254.169.254/latest/meta-data", "https://10.0.0.5/x", "https://[::1]/x", "https://db:5432/x", "https://internal.corp/x"]) {
      expect(isAllowedPushEndpoint(u), u).toBe(false);
    }
  });
  it("refuses look-alike hosts, credentials, ports and the wrong scheme", () => {
    for (const u of [
      "https://fcm.googleapis.com.evil.com/x", "https://evilfcm.googleapis.com/x", "https://fcm-googleapis.com/x",
      "https://user:pw@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "http://fcm.googleapis.com/x",
      "https://evil.com/?https://fcm.googleapis.com", "https://notify.windows.com.evil.com/x", "ftp://fcm.googleapis.com/x", "not a url", "",
    ]) expect(isAllowedPushEndpoint(u), u).toBe(false);
  });
});
