import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({
  region: process.env.SES_REGION || process.env.AWS_REGION || "us-east-1"
});

function getSourceAddress() {
  return process.env.SES_FROM_ADDRESS?.trim() || "Pages101 <noreply@childactor101.com>";
}

export async function sendPages101Email({
  to,
  subject,
  html,
  replyTo
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  await ses.send(
    new SendEmailCommand({
      Source: getSourceAddress(),
      Destination: { ToAddresses: [to] },
      ReplyToAddresses: replyTo ? [replyTo] : undefined,
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: html }
        }
      }
    })
  );
}
