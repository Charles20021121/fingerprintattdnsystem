#!/bin/bash
openssl req -x509 -nodes -newkey rsa:2048 -keyout server.key -out server.crt -days 365 \
    -subj "/CN=ESP32/O=Your Company/C=TW"

# 轉換為 C/C++ 頭文件格式
echo "#ifndef CERT_H" > cert.h
echo "#define CERT_H" >> cert.h
echo "" >> cert.h
echo "// Server Certificate" >> cert.h
echo "static const char server_crt[] = \\" >> cert.h
cat server.crt | while read line; do
    echo "\"$line\\n\" \\" >> cert.h
done
echo ";" >> cert.h
echo "" >> cert.h
echo "static const int server_crt_len = sizeof(server_crt);" >> cert.h
echo "" >> cert.h
echo "// Server Private Key" >> cert.h
echo "static const char server_key[] = \\" >> cert.h
cat server.key | while read line; do
    echo "\"$line\\n\" \\" >> cert.h
done
echo ";" >> cert.h
echo "" >> cert.h
echo "static const int server_key_len = sizeof(server_key);" >> cert.h
echo "" >> cert.h
echo "#endif" >> cert.h 