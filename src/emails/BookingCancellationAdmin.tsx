import React from 'react';
import {
  // Container, // Not used directly here
  Heading,
  Text,
} from "@react-email/components";
import BaseLayout from './BaseLayout';

interface BookingCancellationAdminProps {
  clientName?: string | null;
  clientEmail?: string | null;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  cancelledBy: string; // e.g., "Client", "Admin", "Staff (Staff Name)"
  reason?: string | null;
}

export const BookingCancellationAdmin: React.FC<BookingCancellationAdminProps> = ({
  clientName = 'N/A',
  clientEmail = 'N/A',
  serviceName,
  bookingDate,
  bookingTime,
  cancelledBy,
  reason = null,
}) => {
  const previewText = `Booking Cancellation Alert: ${serviceName} for ${clientName}`;

  return (
    <BaseLayout previewText={previewText}>
      <Heading style={{ textAlign: 'center', marginBottom: '20px', color: '#dc3545' }}>
        Booking Cancellation Alert
      </Heading>
      <Text>A booking has been cancelled:</Text>
      <Text style={detailItem}><strong>Client:</strong> {clientName} ({clientEmail})</Text>
      <Text style={detailItem}><strong>Service:</strong> {serviceName}</Text>
      <Text style={detailItem}><strong>Date:</strong> {bookingDate}</Text>
      <Text style={detailItem}><strong>Time:</strong> {bookingTime}</Text>
      <Text style={detailItem}><strong>Cancelled By:</strong> {cancelledBy}</Text>
      {reason && (
        <Text style={detailItem}><strong>Reason:</strong> {reason}</Text>
      )}
      <Text style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        This is an automated notification.
      </Text>
    </BaseLayout>
  );
};

export default BookingCancellationAdmin;

// Simple style for detail items
const detailItem = {
  margin: '4px 0',
};