import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({
  region: process.env.SES_REGION || process.env.AWS_REGION || "us-east-1"
});

function getSourceAddress() {
  return process.env.SES_FROM_ADDRESS?.trim() || "Pages101 <noreply@childactor101.com>";
}

// Same sending address, different display name ("Corey at Child Actor 101").
function getSourceWithName(name: string) {
  const configured = getSourceAddress();
  const address = configured.match(/<([^>]+)>/)?.[1] ?? configured;
  return `${name.replace(/[<>"]/g, "")} <${address}>`;
}

export async function sendPages101Email({
  to,
  subject,
  html,
  replyTo,
  fromName
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  fromName?: string;
}) {
  await ses.send(
    new SendEmailCommand({
      Source: fromName ? getSourceWithName(fromName) : getSourceAddress(),
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
