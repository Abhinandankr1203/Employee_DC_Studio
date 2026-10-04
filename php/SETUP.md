# DC Studio – PHP Setup Guide

## Step 1 — Start LAMP services
```bash
sudo systemctl start apache2
sudo systemctl start mysql
```

## Step 2 — Create the MySQL database
```bash
mysql -u root -p < /var/www/html/schema.sql
```
(Press Enter when it asks for password if blank)

## Step 3 — Copy all files to the web root
```bash
sudo cp -r /path/to/php/. /var/www/html/
sudo cp -r /path/to/js /var/www/html/
sudo cp -r /path/to/css /var/www/html/
sudo cp /path/to/index.html /var/www/html/
sudo cp /path/to/*.png /var/www/html/
sudo chown -R www-data:www-data /var/www/html/
```

## Step 4 — Enable mod_rewrite (required for .htaccess routing)
```bash
sudo a2enmod rewrite
sudo systemctl restart apache2
```

## Step 5 — Allow .htaccess in Apache config
```bash
sudo nano /etc/apache2/sites-available/000-default.conf
```
Find `<Directory /var/www/html>` and change `AllowOverride None` to `AllowOverride All`, then:
```bash
sudo systemctl restart apache2
```

## Step 6 — Test
Open browser → http://localhost
Login: admin@dcstudio.com / Admin@123

## Default Login Credentials
| Email | Password | Role |
|-------|----------|------|
| admin@dcstudio.com | Admin@123 | Admin |
| rahul@dcstudio.com | (check users.json) | Manager |
| priya@dcstudio.com | (check users.json) | Employee |
