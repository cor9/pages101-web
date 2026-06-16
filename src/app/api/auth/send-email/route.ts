import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ 
  region: process.env.SES_REGION || process.env.AWS_REGION || "us-east-1" 
});

export async function POST(req: Request) {
  try {
    const { email, token_hash, redirect_to, type } = await req.json();

    // Construct the verification/confirmation URL
    const confirmUrl = `https://pages.childactor101.com/auth/confirm?token_hash=${token_hash}&type=${type}&next=${redirect_to ?? "/dashboard"}`;

    await ses.send(
      new SendEmailCommand({
        Source: "Pages101 <noreply@childactor101.com>",
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: "Your Pages101 sign-in link" },
          Body: {
            Html: {
              Data: `
                <p>Hi,</p>
                <p>Click the link below to sign in to Pages101. This link expires in 1 hour.</p>
                <p><a href="${confirmUrl}" style="background:#C8553D;color:#fff;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:700;font-family:Inter,sans-serif;display:inline-block">Sign in to Pages101</a></p>
                <p style="color:#999;font-size:12px">If you didn't request this, ignore this email.</p>
              `
            }
          }
        }
      })
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error sending auth email via SES:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      { status: 500 }
    );
  }
}
