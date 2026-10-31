#!/bin/bash
# chain.sh HOST: build $S/tls/bundle-HOST.pem = the proxy's CA bundle plus the leaf's missing intermediate, fetched
# from the CA's own AIA "CA Issuers" URL (completing a chain the server didn't send; no verification is skipped)
S=/tmp/claude-0/-home-user-SLATE/c8b0b159-b4a5-540a-bbd6-18661cbe240c/scratchpad; H=$1; cd $S/tls
echo | openssl s_client -connect $H:443 -servername $H -proxy ${HTTPS_PROXY#http://} 2>/dev/null | openssl x509 -outform PEM > leaf-$H.pem
u=$(openssl x509 -in leaf-$H.pem -noout -ext authorityInfoAccess 2>/dev/null | grep -o 'CA Issuers - URI:[^ ]*' | sed 's/CA Issuers - URI://')
echo "issuer: $(openssl x509 -in leaf-$H.pem -noout -issuer)"; echo "aia: $u"
curl -s -m 30 -o int-$H.der "$u"
(openssl x509 -inform DER -in int-$H.der -out int-$H.pem 2>/dev/null || openssl pkcs7 -inform DER -in int-$H.der -print_certs -out int-$H.pem 2>/dev/null || cp int-$H.der int-$H.pem)
cat /root/.ccr/ca-bundle.crt int-$H.pem > bundle-$H.pem; echo "bundle-$H.pem"
