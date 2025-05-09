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

// Reusing styles from Client template
import { main, container, heading, paragraph, hr, footer } from './BookingConfirmationClient';

interface BookingConfirmationAdminProps {
  clientName: string;
  clientEmail: string; // Add client email for admin
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  pets: string[];
}

export const BookingConfirmationAdmin: React.FC<BookingConfirmationAdminProps> = ({
  clientName,
  clientEmail,
  serviceName,
  bookingDate,
  bookingTime,
  pets
}) => (
  <Html>
    <Head />
    <Preview>New {serviceName} Booking for {clientName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>New Booking Notification</Heading>
        <Text style={paragraph}>
A new booking has been made:
        </Text>
        <Text style={paragraph}>
          **Client:** {clientName} ({clientEmail})<br/>
          **Service:** {serviceName}<br/>
          **Date:** {bookingDate}<br/>
          **Time:** {bookingTime}<br/>
          **Pet(s):** {pets.join(', ')}
        </Text>
        {/* Optional: Add link to booking details in admin panel */}
        <Hr style={hr} />
        <Text style={footer}>Bonnie&apos;s Doggy Daycare Admin</Text>
      </Container>
    </Body>
  </Html>
);

export default BookingConfirmationAdmin;