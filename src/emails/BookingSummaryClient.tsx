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
  Section, // Use Section for each booking item
} from '@react-email/components';

// Reusing styles from Client template
import { main, container, heading, paragraph, hr, footer } from './BookingConfirmationClient';

// Define structure for a single booking detail in the summary
interface BookingDetail {
  serviceName: string;
  date: string; // e.g., "Wednesday, May 14, 2025"
  time: string; // e.g., "10:00 AM - 12:00 PM"
  pets: string; // Comma-separated pet names
}

interface BookingSummaryClientProps {
  clientName: string;
  bookings: BookingDetail[]; // Array of booking details
  // Optionally add errors[] if you want to inform the client about failures
}

export const BookingSummaryClient: React.FC<BookingSummaryClientProps> = ({
  clientName,
  bookings,
}) => {
  const bookingCount = bookings.length;
  const serviceNames = [...new Set(bookings.map(b => b.serviceName))].join(', '); // Get unique service names

  return (
    <Html>
      <Head />
      <Preview>Your Booking Summary for {serviceNames}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Booking Summary</Heading>
          <Text style={paragraph}>Hi {clientName},</Text>
          <Text style={paragraph}>
            We&apos;ve confirmed {bookingCount} booking(s) for you. Here are the details:
          </Text>
          <Hr style={hr} />
          {bookings.map((booking, index) => (
            <Section key={index} style={{ marginBottom: '20px' }}>
              <Text style={{ ...paragraph, paddingLeft: '40px', paddingRight: '40px', marginBottom: '10px' }}>
                <strong>Booking #{index + 1}: {booking.serviceName}</strong>
              </Text>
              <Text style={{ ...paragraph, paddingLeft: '60px', paddingRight: '40px' }}> {/* Indent details */}
                <strong>Date:</strong> {booking.date}<br/>
                <strong>Time:</strong> {booking.time}<br/>
                <strong>Pet(s):</strong> {booking.pets}
              </Text>
            </Section>
          ))}
          <Hr style={hr} />
          <Text style={footer}>Bonnie&apos;s Doggy Daycare</Text>
        </Container>
      </Body>
    </Html>
  );
};

export default BookingSummaryClient;