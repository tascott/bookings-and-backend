import React from 'react';
import {
  // Body, // Handled by BaseLayout
  Button,
  Container,
  // Head, // Handled by BaseLayout
  Heading,
  // Html, // Handled by BaseLayout
  // Preview, // Handled by BaseLayout
  Text,
} from "@react-email/components";
// Correct the import path for BaseLayout again
import BaseLayout from './BaseLayout';

interface WelcomeEmailProps {
  userName?: string | null; // Optional user name
  siteUrl?: string; // URL to link back to
}

export const WelcomeEmail: React.FC<WelcomeEmailProps> = ({
  userName = 'there', // Default greeting if name is not provided
  siteUrl = '#' // Default link if siteUrl is not provided
}) => {
  // Use HTML entity for apostrophe
  const previewText = `Welcome to Bonnie&apos;s Dog Daycare!`;

  return (
    <BaseLayout previewText={previewText}>
      <Heading style={{ textAlign: 'center', marginBottom: '20px' }}>
        Welcome Aboard, {userName}!
      </Heading>
      <Text>
        Thank you for signing up with Bonnie&apos;s Dog Daycare & Grooming.
      </Text>
      <Text>
        We&apos;re excited to have you and your furry friend join our family.
        You can now manage your bookings and profile through our online portal.
      </Text>
      <Container style={{ textAlign: 'center', marginTop: '30px' }}>
        <Button
          href={siteUrl}
          style={{
            backgroundColor: '#007bff',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '5px',
            textDecoration: 'none',
            fontSize: '16px'
          }}
        >
          Visit Your Dashboard
        </Button>
      </Container>
      <Text style={{ marginTop: '30px', fontSize: '12px', color: '#666' }}>
        If you have any questions, feel free to contact us.
      </Text>
    </BaseLayout>
  );
};

export default WelcomeEmail;