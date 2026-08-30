# 🛠️ Complete Environment Setup & API Key Acquisition Guide

This comprehensive guide walks you through setting up all environment variables for both the **Backend (`server`)** and **Frontend (`client`)** of CareerForge AI, along with step-by-step instructions on **how to obtain all required and optional API keys**.

---

## 📋 Table of Contents
1. [Quick Summary of Environment Variables](#1-quick-summary-of-environment-variables)
2. [Client Environment Setup (`client/.env.local`)](#2-client-environment-setup-clientenvlocal)
3. [Server Environment Setup (`server/.env`)](#3-server-environment-setup-serverenv)
4. [Step-by-Step: How to Obtain Every API Key & Credential](#4-step-by-step-how-to-obtain-every-api-key--credential)
   - [A. Google Gemini API Key](#a-google-gemini-api-key-free)
   - [B. OpenRouter API Key](#b-openrouter-api-key-free--paid-options)
   - [C. MongoDB Connection URI (Atlas)](#c-mongodb-connection-uri-mongodb-atlas-free)
   - [D. Cloudinary Storage API Credentials](#d-cloudinary-storage-credentials-free)
   - [E. Redis Connection URL (Upstash Redis)](#e-redis-connection-url-upstash-redis-free)
   - [F. JWT Secret Generation](#f-jwt-secret-generation)
5. [Understanding Fallback Modes (Zero-Config)](#5-understanding-fallback-modes-zero-config)
6. [Verification & Health Check](#6-verification--health-check)

---

## 1. Quick Summary of Environment Variables

| Variable | Scope | Required? | Default / Fallback |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Client | **Recommended** | `http://localhost:5000/api` |
| `NEXT_PUBLIC_SOCKET_URL` | Client | **Recommended** | `http://localhost:5000` |
| `PORT` | Server | Optional | `5000` |
| `NODE_ENV` | Server | Optional | `development` |
| `CLIENT_URL` | Server | Optional | `http://localhost:3000` |
| `JWT_SECRET` | Server | **Required in Prod** | Default dev string provided |
| `MONGODB_URI` | Server | Optional | `mongodb-memory-server` (In-Memory) |
| `GEMINI_API_KEY` | Server | Optional | Falls back to OpenRouter / Deterministic Rule Engine |
| `GEMINI_MODEL` | Server | Optional | `gemini-1.5-flash` |
| `OPENROUTER_API_KEY` | Server | Optional | Falls back to Gemini / Deterministic Rule Engine |
| `OPENROUTER_MODEL` | Server | Optional | `meta-llama/llama-3.3-70b-instruct:free` |
| `CLOUDINARY_CLOUD_NAME` | Server | Optional | Local file system (`uploads/`) |
| `CLOUDINARY_API_KEY` | Server | Optional | Local file system (`uploads/`) |
| `CLOUDINARY_API_SECRET` | Server | Optional | Local file system (`uploads/`) |
| `REDIS_URL` | Server | Optional | In-Memory BullMQ fallback worker |

---

## 2. Client Environment Setup (`client/.env.local`)

### Step 1: Navigate to the `client` directory
```bash
cd client
```

### Step 2: Create `.env.local`
You can copy `.env.example` to `.env.local`:

**On Windows (PowerShell):**
```powershell
Copy-Item .env.example .env.local
```
**On Linux/macOS:**
```bash
cp .env.example .env.local
```

### Step 3: Populate `.env.local`
```env
# URL for Express REST API Gateway
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# URL for Real-Time Socket.IO Server
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

> **Note**: For production deployments (e.g., Vercel), replace `http://localhost:5000` with your deployed backend server URL.

---

## 3. Server Environment Setup (`server/.env`)

### Step 1: Navigate to the `server` directory
```bash
cd server
```

### Step 2: Create `.env`
You can copy `.env.example` to `.env`:

**On Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```
**On Linux/macOS:**
```bash
cp .env.example .env
```

### Step 3: Populate `.env`
```env
# ==============================================================================
# Server Configuration
# ==============================================================================
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
JWT_SECRET=your_super_secret_random_64_char_key_here

# ==============================================================================
# Database (Leave blank to use automatic in-memory MongoDB)
# ==============================================================================
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/careerforge?retryWrites=true&w=majority

# ==============================================================================
# AI Provider: Google Gemini (Recommended primary provider)
# ==============================================================================
GEMINI_API_KEY=AIzaSy...your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash

# ==============================================================================
# AI Provider: OpenRouter (Fallback / Alternative provider)
# ==============================================================================
OPENROUTER_API_KEY=sk-or-v1-...your_openrouter_api_key
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free

# ==============================================================================
# Cloudinary Storage (Leave blank to store uploads in server/uploads/)
# ==============================================================================
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# ==============================================================================
# Redis Queue (Leave blank to use in-memory asynchronous worker)
# ==============================================================================
REDIS_URL=rediss://default:your_password@your-redis-host.upstash.io:6379
```

---

## 4. Step-by-Step: How to Obtain Every API Key & Credential

### A. Google Gemini API Key (Free)
Google Gemini provides a generous free tier for developers with high throughput.

1. **Visit Google AI Studio**: Go to [https://aistudio.google.com/](https://aistudio.google.com/).
2. **Sign In**: Log in using any standard Google account.
3. **Get API Key**:
   - Click on the **"Get API key"** button on the top left navigation menu.
   - Click **"Create API key"**.
   - Choose **"Create API key in new project"** (or select an existing Google Cloud project).
4. **Copy the Key**:
   - Copy the generated key (starts with `AIzaSy...`).
5. **Paste into `server/.env`**:
   ```env
   GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   GEMINI_MODEL=gemini-1.5-flash
   ```

---

### B. OpenRouter API Key (Free & Paid Options)
OpenRouter provides a unified API to access models from Meta (Llama), Anthropic (Claude), Mistral, and others.

1. **Visit OpenRouter**: Go to [https://openrouter.ai/](https://openrouter.ai/).
2. **Sign Up / Sign In**: Click **Sign In** and connect with Google, GitHub, or Email.
3. **Navigate to Keys**:
   - Click on your profile icon in the top right corner and select **"Keys"** (or navigate to [https://openrouter.ai/keys](https://openrouter.ai/keys)).
4. **Create a Key**:
   - Click **"Create Key"**.
   - Give it a descriptive name (e.g. `CareerForge-Local`).
   - (Optional) Set a credit limit if you added paid balance, or leave default.
   - Click **"Create"**.
5. **Copy the Key**:
   - Copy the key immediately (starts with `sk-or-v1-...`). It will not be shown again.
6. **Paste into `server/.env`**:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
   ```

---

### C. MongoDB Connection URI (MongoDB Atlas - Free)
If you want persistent data storage rather than the default in-memory database:

1. **Visit MongoDB Atlas**: Go to [https://www.mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register).
2. **Create an Account / Sign In**.
3. **Create a Free Cluster**:
   - Select the **M0 Free** cluster tier.
   - Select your preferred cloud provider (AWS / Google Cloud) and closest region.
   - Click **"Create Deployment"**.
4. **Set Up Security & Credentials**:
   - **Database User**: Create a username (e.g. `careerforge_user`) and a secure password. *Note down the password!*
   - **Network Access (IP Whitelist)**: Under **"Network Access"** -> **"IP Access List"**, click **"Add IP Address"** -> choose **"Allow Access from Anywhere"** (`0.0.0.0/0`) for local testing.
5. **Get Connection String**:
   - Go to **"Database"** -> Click **"Connect"** next to your cluster.
   - Choose **"Drivers"** (Node.js).
   - Copy the connection string format:
     ```text
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
6. **Replace `<username>` and `<password>` and append database name**:
   ```env
   MONGODB_URI=mongodb+srv://careerforge_user:YourStrongPassword123@cluster0.abcde.mongodb.net/careerforge?retryWrites=true&w=majority
   ```

---

### D. Cloudinary Storage Credentials (Free)
Cloudinary provides free cloud storage for user profile pictures and resume documents.

1. **Visit Cloudinary**: Go to [https://cloudinary.com/users/register_free](https://cloudinary.com/users/register_free).
2. **Sign Up**: Register for a free account.
3. **Open the Dashboard**:
   - Once logged in, go to the **Cloudinary Console Dashboard** ([https://console.cloudinary.com/pm](https://console.cloudinary.com/pm)).
4. **Locate Product Environment Credentials**:
   - In the **"Product Environment Credentials"** box on the dashboard, you will find:
     - **Cloud Name** (e.g. `dxy7abc12`)
     - **API Key** (e.g. `123456789012345`)
     - **API Secret** (click the eye icon or "Copy API Secret")
5. **Paste into `server/.env`**:
   ```env
   CLOUDINARY_CLOUD_NAME=dxy7abc12
   CLOUDINARY_API_KEY=123456789012345
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret_here
   ```

---

### E. Redis Connection URL (Upstash Redis - Free)
If you want persistent background jobs with BullMQ instead of the in-memory fallback queue:

1. **Visit Upstash**: Go to [https://upstash.com/](https://upstash.com/).
2. **Sign In**: Log in with GitHub or Google.
3. **Create Database**:
   - Click **"Create Database"** under the **Redis** tab.
   - Enter a name (e.g., `careerforge-redis`).
   - Select the region closest to you.
   - Click **"Create"**.
4. **Copy Redis URI**:
   - Scroll down to the **"Connect your database"** section.
   - Select the **"ioredis"** or **"Node"** tab, or find the **`UPSTASH_REDIS_REST_URL` / `REDIS_URL`**.
   - Copy the connection string starting with `rediss://...`:
     ```text
     rediss://default:xxxxxxxxxxxxxxxx@your-instance.upstash.io:6379
     ```
5. **Paste into `server/.env`**:
   ```env
   REDIS_URL=rediss://default:xxxxxxxxxxxxxxxx@your-instance.upstash.io:6379
   ```

---

### F. JWT Secret Generation
The JWT secret is used to cryptographically sign authentication tokens.

You can generate a secure 64-character random hex string directly in your terminal:

**Using Node.js (cross-platform):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Using OpenSSL (Linux / Git Bash / macOS):**
```bash
openssl rand -hex 32
```

Copy the resulting string and paste it into `server/.env`:
```env
JWT_SECRET=4a8f9c2d1e0b5a7c3e9f8a1d2c4b6e8a0f2d4b6c8e0a2d4f6a8c0e2b4d6f8a0c
```

---

## 5. Understanding Fallback Modes (Zero-Config)

CareerForge AI is resiliently built to work out of the box even without external accounts:

```
┌─────────────────────────┬───────────────────────────┬───────────────────────────────────────────┐
│ Feature                 │ Provided Cloud Service    │ Automatic Fallback if Left Empty          │
├─────────────────────────┼───────────────────────────┼───────────────────────────────────────────┤
│ AI Parsing & Tailoring  │ Google Gemini / OpenRouter│ Deterministic Rule & STAR Fallback Engine │
│ Database Persistence    │ MongoDB Atlas Cloud       │ In-Memory MongoDB (`mongodb-memory-server`)│
│ File & Resume Uploads   │ Cloudinary CDN            │ Local Disk (`server/uploads/`)            │
│ Task & Pipeline Queues  │ Upstash / Redis BullMQ    │ In-Memory Microtask Job Dispatcher        │
└─────────────────────────┴───────────────────────────┴───────────────────────────────────────────┘
```

---

## 6. Verification & Health Check

To verify that your environment variables and services are configured correctly:

### 1. Start Server
```bash
cd server
npm run dev
```

### 2. Start Client
```bash
cd client
npm run dev
```

### 3. Check System Health Endpoint
Open your browser or make a request to the backend health endpoint:
```text
http://localhost:5000/api/health
```

You should receive a JSON response showing the active environment, database connectivity, and provider statuses:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-08-30T07:30:00.000Z",
    "environment": "development",
    "services": {
      "database": "connected (mongodb-memory-server / atlas)",
      "queue": "ready (in-memory / redis)",
      "aiProvider": "gemini / openrouter / deterministic"
    }
  }
}
```
