#!/bin/bash

# Create certs directory
mkdir -p certs

# Generate a simple self-signed certificate in one command
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -days 365 -nodes \
  -subj "/C=US/ST=CA/L=San Francisco/O=Development/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1" \
  -addext "keyUsage=digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=serverAuth"

echo "SSL certificates generated in ./certs directory"
echo "cert.pem - Certificate file" 
echo "key.pem - Private key file"

# Set proper permissions
chmod 600 certs/key.pem
chmod 644 certs/cert.pem

echo "Certificate permissions set correctly"