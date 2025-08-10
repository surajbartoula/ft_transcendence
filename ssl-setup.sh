#!/bin/bash

# Create certs directory
mkdir -p certs

# Generate a self-signed certificate with all service names
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes \
  -subj "/C=US/ST=CA/L=San Francisco/O=Development/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:*.localhost,DNS:auth-service,DNS:user-service,DNS:chat-service,DNS:game-service,DNS:gateway-service,IP:127.0.0.1" \
  -addext "keyUsage=digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=serverAuth,clientAuth"

echo "SSL certificates generated in ./certs directory"
echo "cert.pem - Certificate file"
echo "key.pem - Private key file"

# Set proper permissions
chmod 600 certs/key.pem
chmod 644 certs/cert.pem

echo "Certificate permissions set correctly"

# Display certificate info for verification
echo ""
echo "Certificate details:"
openssl x509 -in certs/cert.pem -text -noout | grep -A 1 "Subject Alternative Name"