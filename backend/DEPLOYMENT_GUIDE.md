# Google App Engine Deployment Guide

This guide covers how to deploy your Node.js backend to Google App Engine (GAE), explaining the configuration files and the deployment process.

## 1. Configuration Files

### `app.yaml` (Required)
The `app.yaml` file is the main configuration file for your App Engine service. It tells Google Cloud how to run your application.

**Example `app.yaml`:**
```yaml
runtime: nodejs20  # Specifies the Node.js version
env: standard      # 'standard' scales to 0, 'flex' is always running

instance_class: F1 # F1 is the smallest/cheapest instance type

automatic_scaling:
  min_instances: 0 # Allows app to scale down to 0 when not in use (saves money)
  max_instances: 2 # Limits max instances to control costs
  target_cpu_utilization: 0.65

env_variables:
  NODE_ENV: 'production'
  MONGO_URI: 'your_mongo_connection_string'
  JWT_SECRET: 'your_secret_key'
```

### `Dockerfile` (Optional for Standard Env)
**Why use a Dockerfile?**
In the **App Engine Standard Environment** (which you are using with `runtime: nodejs20`), a `Dockerfile` is **NOT required**. Google automatically builds a container image based on your `package.json`.

**You ONLY need a Dockerfile if:**
1.  **Custom Runtime:** You need a system dependency that isn't included in the standard Node.js runtime (e.g., a specific graphics library or binary).
2.  **App Engine Flex:** You are using the Flexible environment which requires a Docker container.
3.  **Cloud Run:** You want to deploy to Cloud Run instead of App Engine.

**If you were to use one, it looks like this:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```
*For your current setup, you can ignore the Dockerfile if you stick to `runtime: nodejs20`.*

---

## 2. Pre-Deployment Checklist

1.  **Case Sensitivity:**
    *   Google Cloud servers run on Linux, which is **case-sensitive**.
    *   Ensure your `package.json` "start" script matches the **exact** filename.
    *   **Incorrect:** `"start": "node src/server.js"` (if file is `Server.js`)
    *   **Correct:** `"start": "node src/Server.js"`

2.  **Environment Variables:**
    *   Ensure all secrets (MONGO_URI, etc.) are in `app.yaml` under `env_variables`. Do **not** rely on a `.env` file in production unless you specifically copy it (which is not recommended for security).

---

## 3. Deployment Commands

Follow these steps to deploy your application.

### Step 1: Authenticate
Login to your Google Cloud account.
```powershell
gcloud auth login
```

### Step 2: Set Project
Tell gcloud which project you are working on.
```powershell
# Select Project id from project list 
gcloud projects list

# Example: gcloud config set project lesn-apis
gcloud config set project YOUR_PROJECT_ID
```

### Step 3: Deploy
Run the deploy command from the directory containing `app.yaml`.
```powershell
gcloud app deploy
```
*   It will ask for confirmation. Type `Y` and press Enter.
*   It will upload your files and build the application.

### Step 4: Check Logs (If errors occur)
If the site says "Service Unavailable", check the logs immediately.
```powershell
gcloud app logs tail -s default
```

---

## 4. Common Troubleshooting

| Error | Solution |
| :--- | :--- |
| **Permissions Error** | Ensure your user has `App Engine Deployer` role in IAM. Run `gcloud auth login` again. |
| **Service Unavailable** | Check logs. Often due to `start` script crashing or DB connection failing. |
| **Module not found** | Check file casing (`Server.js` vs `server.js`) in imports and `package.json`. |