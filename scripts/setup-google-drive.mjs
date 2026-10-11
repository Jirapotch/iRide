import http from "node:http";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const folderId =
  process.env.GOOGLE_DRIVE_FOLDER_ID ?? "1mFCIBIJHkQjYn4y_gg0GRkiELEatHMf0";
const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID,
  clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const pickerKey = process.env.GOOGLE_DRIVE_PICKER_API_KEY,
  projectNumber = process.env.GOOGLE_DRIVE_PROJECT_NUMBER;
if (!clientId || !clientSecret || !pickerKey || !projectNumber)
  throw new Error(
    "Set GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_PICKER_API_KEY and GOOGLE_DRIVE_PROJECT_NUMBER in .env.local first. See README.",
  );
const origin = "http://127.0.0.1:8787",
  redirectUri = origin + "/callback";
const state = randomBytes(32).toString("hex"),
  session = randomBytes(32).toString("hex");
let tokens = null,
  finished = false;
function send(response, status, text, type = "text/html") {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(text);
}
async function limitedBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 4000) throw new Error("Body too large");
  }
  return body;
}
const server = http.createServer(async (request, response) => {
  try {
    if (request.headers.host !== "127.0.0.1:8787") {
      send(response, 403, "Invalid host");
      return;
    }
    const url = new URL(request.url, origin);
    if (request.method === "GET" && url.pathname === "/") {
      send(
        response,
        200,
        '<!doctype html><meta charset="utf-8"><title>iRide Drive setup</title><body style="background:#17181b;color:#eee;font:18px system-ui;padding:48px"><h1>Connect iRide image</h1><p>Owner setup only. Website visitors will not need to log in.</p><p>Folder: ' +
          folderId +
          '</p><a style="color:#f5b64f" href="/authorize">Connect Google Drive →</a></body>',
      );
      return;
    }
    if (url.pathname === "/authorize" && request.method === "GET") {
      const query = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/drive.file",
        access_type: "offline",
        prompt: "consent",
        state,
      });
      response.writeHead(302, {
        Location: "https://accounts.google.com/o/oauth2/v2/auth?" + query,
        "Set-Cookie":
          "iride-setup=" + session + "; HttpOnly; SameSite=Lax; Path=/",
      });
      response.end();
      return;
    }
    const cookie = request.headers.cookie
      ?.split("; ")
      .includes("iride-setup=" + session);
    if (!cookie || finished) {
      send(response, 403, "Setup session required.");
      return;
    }
    if (url.pathname === "/callback" && request.method === "GET") {
      if (
        url.searchParams.get("state") !== state ||
        !url.searchParams.get("code")
      )
        throw new Error("Invalid OAuth response");
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          code: url.searchParams.get("code"),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!tokenResponse.ok) throw new Error("Google authorization failed");
      tokens = await tokenResponse.json();
      if (!tokens.refresh_token)
        throw new Error(
          "No refresh token returned. Revoke the previous app grant and reconnect with offline consent.",
        );
      response.writeHead(302, { Location: "/picker" });
      response.end();
      return;
    }
    if (url.pathname === "/picker" && request.method === "GET" && tokens) {
      const config = JSON.stringify({
        accessToken: tokens.access_token,
        key: pickerKey,
        project: projectNumber,
        folder: folderId,
      }).replaceAll("<", "\\u003c");
      send(
        response,
        200,
        '<!doctype html><meta charset="utf-8"><title>iRide folder permission</title><body style="background:#17181b;color:#eee;font:18px system-ui;padding:48px"><h1>Select iRide image</h1><p>Select the existing target folder to grant this app access.</p><button id="choose">Choose folder</button><p id="status"></p><script src="https://apis.google.com/js/api.js"></script><script>const config=' +
          config +
          ';document.getElementById("choose").onclick=()=>gapi.load("picker",()=>{const view=new google.picker.DocsView(google.picker.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true);new google.picker.PickerBuilder().setAppId(config.project).setDeveloperKey(config.key).setOAuthToken(config.accessToken).addView(view).setCallback(async(data)=>{if(data.action!==google.picker.Action.PICKED)return;const id=data.docs[0].id;if(id!==config.folder){document.getElementById("status").textContent="Select the configured iRide image folder.";return;}const response=await fetch("/finish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({folderId:id})});document.getElementById("status").textContent=await response.text();}).build().setVisible(true);});</script></body>',
      );
      return;
    }
    if (url.pathname === "/finish" && request.method === "POST" && tokens) {
      if (request.headers.origin !== origin) throw new Error("Invalid origin");
      const input = JSON.parse(await limitedBody(request));
      if (input.folderId !== folderId) throw new Error("Wrong folder");
      const metadata = await fetch(
        "https://www.googleapis.com/drive/v3/files/" +
          folderId +
          "?fields=id,mimeType,capabilities(canAddChildren)",
        {
          headers: { Authorization: "Bearer " + tokens.access_token },
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!metadata.ok)
        throw new Error(
          "The app cannot access this folder. Select it in Google Picker.",
        );
      const folder = await metadata.json();
      if (
        folder.mimeType !== "application/vnd.google-apps.folder" ||
        !folder.capabilities?.canAddChildren
      )
        throw new Error("Folder is not writable.");
      const values = {
        GOOGLE_DRIVE_CLIENT_ID: clientId,
        GOOGLE_DRIVE_CLIENT_SECRET: clientSecret,
        GOOGLE_DRIVE_REFRESH_TOKEN: tokens.refresh_token,
        GOOGLE_DRIVE_FOLDER_ID: folderId,
      };
      await writeFile(
        ".env.drive.local",
        Object.entries(values)
          .map(([key, value]) => key + "=" + JSON.stringify(value))
          .join("\n") + "\n",
        { mode: 0o600 },
      );
      finished = true;
      tokens = null;
      send(
        response,
        200,
        "Connected. Credentials saved to ignored .env.drive.local. Restart the local web server. Add the same four variables to Vercel production via its encrypted environment settings.",
        "text/plain",
      );
      console.log(
        "Drive folder verified. Saved .env.drive.local; no credentials printed.",
      );
      return;
    }
    send(response, 404, "Not found", "text/plain");
  } catch {
    send(
      response,
      400,
      "Setup could not complete. Check OAuth configuration, folder permissions and retry from the start.",
      "text/plain",
    );
  }
});
server.listen(8787, "127.0.0.1", () =>
  console.log("Owner setup: " + origin + " — OAuth callback: " + redirectUri),
);
