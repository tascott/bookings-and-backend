import React from 'react';
import {
  Button,
  Container,
  Heading,
  Text,
} from "@react-email/components";
import BaseLayout from './BaseLayout'; // Assuming BaseLayout is in the same directory

interface BookingCancellationClientProps {
  userName?: string | null;
  serviceName: string;
  bookingDate: string; // Format: e.g., "Monday, July 29th, 2024"
  bookingTime: string; // Format: e.g., "10:00 AM - 11:00 AM"
  reason?: string | null; // Optional reason if cancellation initiated by admin/staff
  siteUrl?: string;
}

export const BookingCancellationClient: React.FC<BookingCancellationClientProps> = ({
  userName = 'there',
  serviceName,
  bookingDate,
  bookingTime,
  reason = null,
  siteUrl = '#'
}) => {
  const previewText = `Your booking for ${serviceName} has been cancelled.`;

  return (
    <BaseLayout previewText={previewText}>
      <Heading style={{ textAlign: 'center', marginBottom: '20px' }}>
        Booking Cancellation Notification
      </Heading>
      <Text>Hi {userName},</Text>
      <Text>
        This email confirms that your booking for **{serviceName}** on
        **{bookingDate}** at **{bookingTime}** has been cancelled.
      </Text>
      {reason && (
        <Text>
          Reason for cancellation: {reason}
        </Text>
      )}
      <Text>
        If you believe this was in error, or if you would like to make a new booking,
        please visit our website or contact us directly.
      </Text>
      <Container style={{ textAlign: 'center', marginTop: '30px' }}>
        <Button
          href={siteUrl}
          style={{
            backgroundColor: '#dc3545', // Red color for cancellation context
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '5px',
            textDecoration: 'none',
            fontSize: '16px'
          }}
        >
          Visit Website
        </Button>
      </Container>
    </BaseLayout>
  );
};

export default BookingCancellationClient;