import React from 'react';
import {
  Body,
  Head,
  Html,
  Preview,
  Container,
  // Tailwind // Optional: For using Tailwind CSS if configured - Removed unused import
} from '@react-email/components';

interface BaseLayoutProps {
  previewText: string;
  children: React.ReactNode;
}

const BaseLayout: React.FC<BaseLayoutProps> = ({ previewText, children }) => {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      {/* Optional: Wrap with Tailwind if using it for emails */}
      {/* <Tailwind> */}
        <Body style={main}>
          <Container style={container}>
            {/* You could add a header/logo here if desired */}
            {children}
            {/* You could add a footer here */}
          </Container>
        </Body>
      {/* </Tailwind> */}
    </Html>
  );
};

export default BaseLayout;

// Basic styles (can be expanded or replaced with Tailwind)
const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  width: '580px',
  maxWidth: '100%',
};