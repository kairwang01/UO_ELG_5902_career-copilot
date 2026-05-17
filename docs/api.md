
# Career CoPilot API Documentation

Welcome to the Career CoPilot API! Our API allows you to integrate powerful career-focused AI tools directly into your applications, websites, or services.

## Getting Started

To get started, you'll need an API key. You can generate and manage your API keys from your Account Settings page after signing up for a plan.

### Authentication

All API requests must be authenticated using a Bearer token in the `Authorization` header.

`Authorization: Bearer YOUR_API_KEY`

Replace `YOUR_API_KEY` with the key you generated in your account settings.

### API Endpoint

All requests are `POST` requests made to a single endpoint:

`https://tchwdtylvdijcqfcuenf.supabase.co/functions/v1/api`

The body of your `POST` request must be a JSON object containing two properties:
- `endpoint`: The name of the API method you want to call.
- `payload`: An object containing the parameters for that endpoint.

## Client-Side SDK (JavaScript/TypeScript)

We provide a simple client-side SDK to make integration easier.

### Installation
```bash
# This is a conceptual package name. For now, you can copy the SDK file.
npm install @careercopilot/sdk 
```

### Usage
```javascript
import { CareerCopilotAPI } from '@careercopilot/sdk'; // Or import from './services/careerCopilotApi.ts'

const client = new CareerCopilotAPI('YOUR_API_KEY');

async function analyze() {
  try {
    const analysis = await client.analyzeResume({
      resumeText: "John Doe - Software Engineer...",
      marketName: "United States"
    });
    console.log(analysis);
  } catch (error) {
    console.error(error.message);
  }
}

analyze();
```

---

## API Reference

### 1. `analyzeResume`

Analyzes a resume text for ATS compliance, keywords, and overall quality for a specific job market.

**Endpoint Name:** `analyzeResume`

**Payload:**
- `resumeText` (string, required): The full text content of the resume.
- `marketName` (string, required): The target job market. Supported markets include 'Canada', 'United States', 'United Kingdom', etc.

**Example Request (`curl`)**
```bash
curl -X POST 'https://tchwdtylvdijcqfcuenf.supabase.co/functions/v1/api' \
-H 'Authorization: Bearer YOUR_API_KEY' \
-H 'Content-Type: application/json' \
-d '{
  "endpoint": "analyzeResume",
  "payload": {
    "resumeText": "John Doe, Software Engineer with 5 years of experience...",
    "marketName": "Canada"
  }
}'
```

**Example Response (200 OK)**
```json
{
  "score": 88,
  "summary": "This is a strong resume for a mid-level software engineer...",
  "strengths": [
    "Quantifiable achievements",
    "Clear project descriptions"
  ],
  "improvements": [
    {
      "area": "Skills Section",
      "suggestion": "Consider adding a 'Core Competencies' section at the top..."
    }
  ],
  "keywords": [
    "React", "Node.js", "TypeScript", "AWS", "CI/CD"
  ]
}
```

---

### 2. `generateCoverLetter`

Generates a tailored cover letter based on a candidate's resume and a specific job description.

**Endpoint Name:** `generateCoverLetter`

**Payload:**
- `resumeText` (string, required): The full text content of the candidate's resume.
- `jobDescription` (string, required): The full text of the job description they are applying for.

**Example Request (JavaScript SDK)**
```javascript
const result = await client.generateCoverLetter({
  resumeText: "John Doe - Software Engineer...",
  jobDescription: "We are looking for a Senior React Developer..."
});
console.log(result.letter);
```

**Example Response (200 OK)**
```json
{
  "letter": "Dear Hiring Manager,\n\nI am writing to express my keen interest in the Senior React Developer position..."
}
```

---

## Error Handling

The API uses standard HTTP status codes to indicate the success or failure of a request.

- `200 OK`: The request was successful.
- `400 Bad Request`: The request body is malformed or a required parameter is missing. The response body will contain an `error` message.
- `401 Unauthorized`: Your API key is missing or invalid.
- `500 Internal Server Error`: Something went wrong on our end.

**Example Error Response**
```json
{
  "error": "Invalid API Key"
}
```
