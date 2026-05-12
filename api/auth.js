export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }

  const params = new URLSearchParams(body);
  const password = params.get("password");
  const correctPassword = process.env.SITE_PASSWORD;

  if (password === correctPassword) {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 2);
    res.setHeader(
      "Set-Cookie",
      `pilot-auth=ok; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires.toUTCString()}`
    );
    res.writeHead(302, { Location: "/" });
    res.end();
  } else {
    res.writeHead(302, { Location: "/password.html?error=1" });
    res.end();
  }
}
