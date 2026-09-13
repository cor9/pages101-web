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
  replyTo,
  from
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  // Override the sender for emails that are not Pages101-branded (e.g. Child
  // Actor 101 Open Call). Must be an address under a verified SES identity.
  from?: string;
}) {
  await ses.send(
    new SendEmailCommand({
      Source: from ?? getSourceAddress(),
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
