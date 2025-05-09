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
  Section,
} from '@react-email/components';

// Reusing styles from Client template
import { main, container, heading, paragraph, hr, footer } from './BookingConfirmationClient';

// Import the input type from the API route (adjust path if necessary - assuming same level for now)
// Assuming the interface is exported from the route file or defined in a shared types file.
// If it's not exported, we might need to duplicate it or move it to a shared types file.
// For now, let's assume it's available or duplicate its definition here.
interface BookingInput {
    service_id: number;
    start_time: string;
    end_time: string;
    pet_ids: number[];
}

// Define structure for booking detail
interface BookingDetail {
  serviceName: string;
  date: string;
  time: string;
  pets: string;
}

// Define structure for error detail
interface ErrorDetail {
  input: BookingInput; // <-- Use specific type
  error: string;
}

interface BookingSummaryAdminProps {
  clientName: string;
  clientEmail: string;
  bookings: BookingDetail[];
  errors: ErrorDetail[];
}

export const BookingSummaryAdmin: React.FC<BookingSummaryAdminProps> = ({
  clientName,
  clientEmail,
  bookings,
  errors,
}) => {
  const successfulCount = bookings.length;
  const failedCount = errors.length;
  const totalAttempted = successfulCount + failedCount;

  return (
    <Html>
      <Head />
      <Preview>Booking Summary for {clientName} ({successfulCount}/{totalAttempted} successful)</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Booking Attempt Summary</Heading>
          <Text style={paragraph}>
            Client **{clientName}** ({clientEmail}) attempted to make {totalAttempted} booking(s).
            <br />
            **Successful: {successfulCount}** | **Failed: {failedCount}**
          </Text>
          <Hr style={hr} />

          {/* Successful Bookings Section */}
          {successfulCount > 0 && (
            <Section>
              <Heading style={{ ...heading, fontSize: '20px', textAlign: 'left', paddingLeft: '40px' }}>
                Successful Bookings ({successfulCount})
              </Heading>
              {bookings.map((booking, index) => (
                <Section key={`succ-${index}`} style={{ marginBottom: '15px', paddingLeft: '40px' }}>
                  <Text style={{ ...paragraph, padding: 0, fontWeight: 'bold' }}>
                    #{index + 1}: {booking.serviceName}
                  </Text>
                  <Text style={{ ...paragraph, padding: 0, paddingLeft: '15px' }}>
                    Date: {booking.date}<br/>
                    Time: {booking.time}<br/>
                    Pets: {booking.pets}
                  </Text>
                </Section>
              ))}
              <Hr style={hr} />
            </Section>
          )}

          {/* Failed Bookings Section */}
          {failedCount > 0 && (
            <Section>
              <Heading style={{ ...heading, fontSize: '20px', textAlign: 'left', paddingLeft: '40px', color: '#dc3545' }}> {/* Red heading for errors */}
                Failed Attempts ({failedCount})
              </Heading>
              {errors.map((errorItem, index) => {
                // Create the descriptive string first, explicitly casting all numbers
                const attemptIndexStr = String(index + 1); // Cast index too
                const serviceIdStr = String(errorItem.input?.service_id ?? 'N/A');
                const startTimeStr = String(errorItem.input?.start_time ?? 'N/A');
                // Use all string variables in the template literal
                const attemptDescription = `Attempt #${attemptIndexStr}: Service ${serviceIdStr}, Time ${startTimeStr}`;
                return (
                  <Section key={`err-${index}`} style={{ marginBottom: '15px', paddingLeft: '40px' }}>
                    <Text style={{ ...paragraph, padding: 0, fontWeight: 'bold' }}>
                      {attemptDescription} {/* Use the pre-formatted string */}
                    </Text>
                    <Text style={{ ...paragraph, padding: 0, paddingLeft: '15px', color: '#dc3545' }}>
                      Error: {errorItem.error}
                    </Text>
                    {/* Optionally display more input details */}
                    {/* <Text style={{...paragraph, padding: 0, paddingLeft: '15px', fontSize: '12px'}}>Input: {JSON.stringify(errorItem.input)}</Text> */}
                  </Section>
                );
              })}
              <Hr style={hr} />
            </Section>
          )}

          <Text style={footer}>Bonnie&apos;s Doggy Daycare Admin</Text>
        </Container>
      </Body>
    </Html>
  );
};

export default BookingSummaryAdmin;