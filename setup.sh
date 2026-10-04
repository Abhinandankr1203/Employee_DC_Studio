#!/bin/bash
# DC Studio — Full Auto Setup Script
# Run this once inside the Linux VM terminal

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()  { echo -e "${GREEN}✔ $1${NC}"; }
msg() { echo -e "${YELLOW}→ $1${NC}"; }
err(){ echo -e "${RED}✘ $1${NC}"; }

echo ""
echo "============================================"
echo "   DC Studio — Automatic Setup"
echo "============================================"
echo ""

# ── 1. Install VirtualBox Guest Additions (needed for shared folder) ──────
msg "Installing VirtualBox Guest Additions..."
sudo apt-get update -y -qq
sudo apt-get install -y -qq virtualbox-guest-utils virtualbox-guest-dkms
sudo modprobe vboxsf 2>/dev/null || true
ok "Guest Additions installed"

# ── 2. Mount shared folder ────────────────────────────────────────────────
msg "Mounting shared folder from Windows..."
sudo mkdir -p /media/sf_dcstudio
sudo mount -t vboxsf dcstudio /media/sf_dcstudio 2>/dev/null || true

if [ -d "/media/sf_dcstudio" ] && [ "$(ls -A /media/sf_dcstudio 2>/dev/null)" ]; then
    ok "Shared folder mounted at /media/sf_dcstudio"
else
    err "Shared folder not visible yet — a reboot may be needed"
    echo "Run: sudo reboot — then run this script again"
    exit 1
fi

# ── 3. Start LAMP services ────────────────────────────────────────────────
msg "Starting Apache and MySQL..."
sudo systemctl start apache2
sudo systemctl start mysql
sudo systemctl enable apache2
sudo systemctl enable mysql
ok "Apache and MySQL are running"

# ── 4. Test Hello PHP ─────────────────────────────────────────────────────
msg "Creating Hello test page..."
echo "<?php echo '<h1>Hello from DC Studio!</h1>'; ?>" | sudo tee /var/www/html/index.php > /dev/null
ok "Test page created — open http://localhost to verify"

# ── 5. Copy all project files ─────────────────────────────────────────────
msg "Copying project files to /var/www/html/..."
sudo cp -r /media/sf_dcstudio/. /var/www/html/
msg "Copying PHP backend files..."
sudo cp -r /media/sf_dcstudio/php/. /var/www/html/
ok "All files copied"

# ── 6. Set correct permissions ────────────────────────────────────────────
msg "Setting file permissions..."
sudo chown -R www-data:www-data /var/www/html/
sudo chmod -R 755 /var/www/html/
sudo find /var/www/html/data -type f -exec chmod 664 {} \; 2>/dev/null || true
sudo find /var/www/html/uploads -type d -exec chmod 775 {} \; 2>/dev/null || true
ok "Permissions set"

# ── 7. Setup MySQL database ───────────────────────────────────────────────
msg "Creating database and tables..."
mysql -u root --password="" dcstudio < /var/www/html/schema.sql 2>/dev/null || \
mysql -u root dcstudio < /var/www/html/schema.sql 2>/dev/null || \
(mysql -u root --password="" -e "DROP DATABASE IF EXISTS dcstudio;" 2>/dev/null; \
 mysql -u root --password="" < /var/www/html/schema.sql 2>/dev/null) || \
mysql -u root < /var/www/html/schema.sql
ok "Database created with all tables and data"

# ── 8. Configure Apache mod_rewrite ───────────────────────────────────────
msg "Enabling URL routing..."
sudo a2enmod rewrite > /dev/null 2>&1
sudo sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf
sudo sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/sites-available/000-default.conf 2>/dev/null || true
sudo systemctl restart apache2
ok "Apache mod_rewrite enabled"

# ── 9. Install Node.js + Claude Code ──────────────────────────────────────
msg "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
sudo apt-get install -y nodejs > /dev/null 2>&1
ok "Node.js $(node --version) installed"

msg "Installing Claude Code..."
sudo npm install -g @anthropic-ai/claude-code > /dev/null 2>&1
ok "Claude Code installed"

# ── 10. Verify everything ─────────────────────────────────────────────────
echo ""
echo "============================================"
echo "         SETUP COMPLETE!"
echo "============================================"
echo ""
echo -e "${GREEN}✔ Apache:${NC}  $(sudo systemctl is-active apache2)"
echo -e "${GREEN}✔ MySQL:${NC}   $(sudo systemctl is-active mysql)"
echo -e "${GREEN}✔ Node.js:${NC} $(node --version)"
echo ""
echo "  Open browser → http://localhost"
echo "  Login email  → admin@dcstudio.com"
echo "  Password     → Admin@123"
echo ""
echo "  To start Claude Code: cd /var/www/html && claude"
echo ""
