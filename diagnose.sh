#!/bin/bash
echo "====== DC Studio Diagnostics ======"
echo ""

echo "--- Apache status ---"
sudo systemctl is-active apache2

echo "--- MySQL status ---"
sudo systemctl is-active mysql

echo "--- Files in /var/www/html ---"
ls /var/www/html/

echo "--- PHP files in /var/www/html/api ---"
ls /var/www/html/api/ 2>/dev/null || echo "api/ folder NOT FOUND"

echo "--- Database check ---"
mysql -u root --password="" -e "USE dcstudio; SELECT id,email,role FROM users;" 2>/dev/null || \
mysql -u root -e "USE dcstudio; SELECT id,email,role FROM users;" 2>/dev/null || \
echo "Database ERROR - not set up"

echo "--- Test login API ---"
curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dcstudio.com","password":"Admin@123"}' 2>/dev/null || echo "API call failed"

echo "--- .htaccess check ---"
cat /var/www/html/.htaccess 2>/dev/null || echo ".htaccess NOT FOUND"

echo "--- mod_rewrite check ---"
apache2ctl -M 2>/dev/null | grep rewrite || echo "rewrite module NOT enabled"

echo "--- PHP version ---"
php --version 2>/dev/null || echo "PHP not found"

echo ""
echo "====== Done ======"
