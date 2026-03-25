# Deploying the Recipe App to a Live Server with Apache Tomcat

This guide explains how to run the Recipe App on a live server using Apache Tomcat as a reverse proxy in front of the Node.js backend.

> **Why a reverse proxy?** Tomcat is a Java servlet container. This app is built on Node.js. The standard approach is to let Node.js handle application logic while Tomcat (or its HTTP connector) proxies incoming traffic to it. Tomcat listens on port 80/443 (public) and forwards requests to Node.js on port 3000 (private).

---

## Prerequisites

| Requirement | Version |
|---|---|
| Java (JDK or JRE) | 11 or later |
| Apache Tomcat | 9 or 10 |
| Node.js | 18 or later |
| npm | bundled with Node.js |

---

## 1. Install Java

```bash
# Debian/Ubuntu
sudo apt update
sudo apt install -y openjdk-17-jre-headless

# Verify
java -version
```

---

## 2. Install Apache Tomcat

```bash
# Download Tomcat (replace 10.1.x with the latest version from https://tomcat.apache.org)
wget https://dlcdn.apache.org/tomcat/tomcat-10/v10.1.39/bin/apache-tomcat-10.1.39.tar.gz

# Extract to /opt
sudo tar -xzf apache-tomcat-10.1.39.tar.gz -C /opt
sudo ln -s /opt/apache-tomcat-10.1.39 /opt/tomcat

# Make scripts executable
sudo chmod +x /opt/tomcat/bin/*.sh
```

---

## 3. Enable the Proxy Module in Tomcat

Tomcat's built-in HTTP connector can forward requests to Node.js using the **mod_proxy** approach via the `server.xml` configuration.

Edit `/opt/tomcat/conf/server.xml` and add a `Connector` and `Engine` with a proxy rule inside the `<Service>` block:

```xml
<Connector port="80" protocol="HTTP/1.1"
           connectionTimeout="20000"
           redirectPort="8443" />
```

Then add a `<Context>` entry in `/opt/tomcat/conf/Catalina/localhost/ROOT.xml` (create if it does not exist):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Context>
  <Valve className="org.apache.catalina.valves.rewrite.RewriteValve" />
</Context>
```

Create the rewrite rules file at `/opt/tomcat/conf/Catalina/localhost/rewrite.config`:

```
RewriteRule ^/(.*)$ http://localhost:3000/$1 [P]
```

> This proxies all requests from Tomcat (port 80) to Node.js (port 3000).

---

## 4. Install Node.js on the Server

```bash
# Using NodeSource (Debian/Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v
npm -v
```

---

## 5. Deploy the App Files

```bash
# Copy project files to the server (run from your local machine)
scp -r /path/to/recipes user@your-server-ip:/opt/recipes

# Or clone from a Git repository on the server
git clone https://github.com/your-username/recipes.git /opt/recipes
```

---

## 6. Install App Dependencies

```bash
cd /opt/recipes
npm install --omit=dev
```

---

## 7. Run Node.js as a Background Service (systemd)

Create a systemd service file so Node.js starts automatically and restarts on failure.

```bash
sudo nano /etc/systemd/system/recipes.service
```

Paste the following:

```ini
[Unit]
Description=Recipe App Node.js Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/recipes
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable recipes
sudo systemctl start recipes

# Check status
sudo systemctl status recipes
```

---

## 8. Start Tomcat

```bash
sudo /opt/tomcat/bin/startup.sh

# Check logs
tail -f /opt/tomcat/logs/catalina.out
```

To start Tomcat automatically on boot, create a systemd unit at `/etc/systemd/system/tomcat.service`:

```ini
[Unit]
Description=Apache Tomcat
After=network.target

[Service]
Type=forking
User=www-data
Environment=JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
Environment=CATALINA_HOME=/opt/tomcat
ExecStart=/opt/tomcat/bin/startup.sh
ExecStop=/opt/tomcat/bin/shutdown.sh
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable tomcat
sudo systemctl start tomcat
```

---

## 9. Open the Firewall

```bash
# Allow HTTP (and HTTPS if needed)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

---

## 10. Verify Deployment

Open a browser and navigate to:

```
http://your-server-ip/
```

You should see the Recipe App. To test the API:

```bash
curl -X POST http://your-server-ip/api/recipes \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","mealType":"snack","ingredients":["a"],"steps":["b"]}'
```

---

## File Permission Notes

The `recipes/` directory must be writable by the Node.js process user (`www-data`):

```bash
sudo chown -R www-data:www-data /opt/recipes
sudo chmod -R 755 /opt/recipes
sudo chmod -R 775 /opt/recipes/recipes
```

---

## Troubleshooting

| Problem | Check |
|---|---|
| Blank page | `sudo systemctl status recipes` — is Node.js running? |
| 502 Bad Gateway | Node.js not reachable on port 3000; check `PORT` env var |
| Tomcat not starting | `tail /opt/tomcat/logs/catalina.out` for Java errors |
| API returns 403 | File permissions on `recipes/` directory (see above) |
| Port 80 in use | Check `sudo lsof -i :80`; another process may be bound |
