import React from 'react';
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Hr,
} from '@react-email/components';

interface BookingConfirmationClientProps {
  clientName: string;
  serviceName: string;
  bookingDate: string; // e.g., "Wednesday, May 14, 2025"
  bookingTime: string; // e.g., "10:00 AM - 12:00 PM"
  pets: string[];      // Array of pet names
}

export const BookingConfirmationClient: React.FC<BookingConfirmationClientProps> = ({
  clientName,
  serviceName,
  bookingDate,
  bookingTime,
  pets
}) => (
  <Html>
    <Head />
    <Preview>Your {serviceName} Booking Confirmation</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>Booking Confirmed!</Heading>
        <Text style={paragraph}>Hi {clientName},</Text>
        <Text style={paragraph}>
          Your booking for **{serviceName}** has been confirmed.
        </Text>
        <Text style={paragraph}>
          **Date:** {bookingDate}<br/>
          **Time:** {bookingTime}<br/>
          **Pet(s):** {pets.join(', ')}
        </Text>
        <Hr style={hr} />
        <Text style={footer}>Bonnie&apos;s Doggy Daycare</Text>
      </Container>
    </Body>
  </Html>
);

export default BookingConfirmationClient;

// Basic Styles - Export them for reuse
export const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  textAlign: 'center' as const,
};

export const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  border: '1px solid #f0f0f0',
  borderRadius: '4px',
};

export const heading = {
  fontSize: '28px',
  fontWeight: 'bold',
  marginTop: '48px',
  textAlign: 'center' as const,
  color: '#333',
};

export const paragraph = {
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left' as const,
  color: '#525f7f',
  padding: '0 40px',
};

export const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
};

export const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  textAlign: 'center' as const,
};

// --- Add Button Style ---
export const button = {
  backgroundColor: '#5e7ce2', // Example color, adjust as needed
  borderRadius: '3px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 20px',
};
// ----------------------