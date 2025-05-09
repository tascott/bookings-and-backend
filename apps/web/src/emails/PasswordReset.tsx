import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import * as React from 'react';

// Import shared styles (adjust path if needed)
import { main, container, paragraph, button as buttonStyle, footer } from './BookingConfirmationClient';

interface PasswordResetEmailProps {
  userName?: string;
  resetLink?: string;
}

export const PasswordReset = ({
  userName = 'there', // Default name
  resetLink = 'https://example.com', // Default link (should be replaced)
}: PasswordResetEmailProps) => {
  const previewText = `Reset your password`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={paragraph}>Hi {userName},</Text>
          <Text style={paragraph}>
            Someone requested a password reset for your account. If this was you, click the button below to set a new password.
          </Text>
          <Button style={buttonStyle} href={resetLink}>
            Reset Password
          </Button>
          <Text style={paragraph}>
            If you didn&apos;t request this, please ignore this email. Your password won&apos;t be changed unless you access the link above and create a new one.
          </Text>
          <Text style={{ ...paragraph, ...footer }}>
            Bonnie&apos;s Dog Daycare
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default PasswordReset;