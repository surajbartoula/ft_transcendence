#!/bin/bash

# Create certs directory
mkdir -p certs

# Detect hostname
HOSTNAME=$(hostname)

# Detect LAN IP (macOS + Linux)
if command -v ipconfig &> /dev/null; then
    # macOS
    LAN_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "127.0.0.1")
else
    # Linux
    LAN_IP=$(hostname -I | awk '{print $1}')
fi

echo "Using hostname: $HOSTNAME"
echo "Using LAN IP: $LAN_IP"

# Create OpenSSL config file
cat > certs/openssl.cnf <<EOL
[ req ]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[ req_distinguished_name ]
C = US
ST = CA
L = San Francisco
O = Development
CN = $HOSTNAME

[ v3_req ]
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = localhost
DNS.2 = $HOSTNAME
IP.1 = 127.0.0.1
IP.2 = $LAN_IP
EOL

# Generate the certificate
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -config certs/openssl.cnf

# Set permissions
chmod 600 certs/key.pem
chmod 644 certs/cert.pem

echo "SSL certificates generated in ./certs directory"

# Display SANs for verification
echo ""
echo "Certificate details (SANs):"
openssl x509 -in certs/cert.pem -text -noout | grep -A 1 "Subject Alternative Name"
